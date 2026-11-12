import os, sys, struct, hashlib, subprocess, tempfile, zipfile

KEY_DIR = os.path.expanduser("~/.android_keys")
os.makedirs(KEY_DIR, exist_ok=True)
KEY_FILE = os.path.join(KEY_DIR, "debug.key")
CERT_FILE = os.path.join(KEY_DIR, "debug.crt")
PUB_FILE = os.path.join(KEY_DIR, "debug.pub.der")

# 1. Ensure permanent persistent key & certificate
if not os.path.exists(KEY_FILE) or not os.path.exists(CERT_FILE):
    print("Generating persistent Android debug key...")
    subprocess.run(["openssl", "genrsa", "-out", KEY_FILE, "2048"], check=True)
    subprocess.run([
        "openssl", "req", "-new", "-x509", "-key", KEY_FILE, "-out", CERT_FILE,
        "-days", "10000", "-subj", "/CN=Android Debug/O=Android/C=US"
    ], check=True)
    subprocess.run([
        "openssl", "rsa", "-in", KEY_FILE, "-pubout", "-outform", "DER", "-out", PUB_FILE
    ], check=True)
else:
    if not os.path.exists(PUB_FILE):
        subprocess.run([
            "openssl", "rsa", "-in", KEY_FILE, "-pubout", "-outform", "DER", "-out", PUB_FILE
        ], check=True)

with open(CERT_FILE, "rb") as f:
    cert_pem = f.read()

# Convert cert to DER
cert_der_proc = subprocess.run(["openssl", "x509", "-in", CERT_FILE, "-outform", "DER"], check=True, capture_output=True)
cert_der = cert_der_proc.stdout

with open(PUB_FILE, "rb") as f:
    pub_der = f.read()

def sign_apk(apk_path):
    print(f"\n--- Signing {apk_path} ---")
    # Read APK and strip existing APK signing block if present
    with open(apk_path, "rb") as f:
        apk_data = f.read()

    eocd_idx = apk_data.rfind(b"PK\x05\x06")
    if eocd_idx < 0:
        raise ValueError("Invalid zip file")
    
    cd_size, cd_offset = struct.unpack("<II", apk_data[eocd_idx+12:eocd_idx+20])
    
    # Check if there is an existing APK signing block before cd_offset
    has_sig_block = False
    if cd_offset >= 16 and apk_data[cd_offset-16:cd_offset] == b"APK Sig Block 42":
        block_size = struct.unpack("<Q", apk_data[cd_offset-24:cd_offset-16])[0]
        block_start = cd_offset - 8 - block_size
        print(f"Stripping old APK signing block of size {block_size}...")
        # Zip data without signing block
        clean_apk = apk_data[:block_start] + apk_data[cd_offset:]
        # Update EOCD cd_offset
        new_eocd_idx = len(clean_apk) - (len(apk_data) - eocd_idx)
        clean_apk = bytearray(clean_apk)
        struct.pack_into("<I", clean_apk, new_eocd_idx + 16, block_start)
        clean_apk = bytes(clean_apk)
    else:
        clean_apk = apk_data

    # Now let unpack clean_apk, re-generate clean v1 signature (META-INF)
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_clean = os.path.join(tmpdir, "clean.apk")
        with open(tmp_clean, "wb") as f:
            f.write(clean_apk)
        
        # Read all files except META-INF
        entries = {}
        with zipfile.ZipFile(tmp_clean, "r") as z:
            for info in z.infolist():
                if info.filename.startswith("META-INF/"):
                    continue
                entries[info.filename] = z.read(info.filename)
        
        # Generate MANIFEST.MF
        manifest_lines = [
            "Manifest-Version: 1.0",
            "Created-By: 1.0 (Android Signer)",
            ""
        ]
        import base64
        file_hashes = {}
        for name in sorted(entries.keys()):
            h = base64.b64encode(hashlib.sha256(entries[name]).digest()).decode("ascii")
            file_hashes[name] = h
            manifest_lines.append(f"Name: {name}")
            manifest_lines.append(f"SHA-256-Digest: {h}")
            manifest_lines.append("")
        
        manifest_bytes = "\r\n".join(manifest_lines).encode("utf-8")
        
        # Generate ANDROID.SF
        sf_lines = [
            "Signature-Version: 1.0",
            "Created-By: 1.0 (Android Signer)",
            f"SHA-256-Digest-Manifest: {base64.b64encode(hashlib.sha256(manifest_bytes).digest()).decode('ascii')}",
            ""
        ]
        for name in sorted(entries.keys()):
            entry_section = f"Name: {name}\r\nSHA-256-Digest: {file_hashes[name]}\r\n\r\n".encode("utf-8")
            h = base64.b64encode(hashlib.sha256(entry_section).digest()).decode("ascii")
            sf_lines.append(f"Name: {name}")
            sf_lines.append(f"SHA-256-Digest: {h}")
            sf_lines.append("")
        
        sf_bytes = "\r\n".join(sf_lines).encode("utf-8")
        
        # Sign ANDROID.SF to create ANDROID.RSA (PKCS#7)
        sf_file = os.path.join(tmpdir, "ANDROID.SF")
        rsa_file = os.path.join(tmpdir, "ANDROID.RSA")
        with open(sf_file, "wb") as f:
            f.write(sf_bytes)
        
        subprocess.run([
            "openssl", "smime", "-sign", "-in", sf_file, "-inkey", KEY_FILE,
            "-signer", CERT_FILE, "-outform", "DER", "-out", rsa_file,
            "-nodetach", "-binary", "-noattr"
        ], check=True)
        with open(rsa_file, "rb") as f:
            rsa_bytes = f.read()

        # Re-pack the APK as an aligned zip file
        out_zip_path = os.path.join(tmpdir, "v1_signed.apk")
        with zipfile.ZipFile(out_zip_path, "w", zipfile.ZIP_DEFLATED) as z_out:
            # First write AndroidManifest.xml (compressed)
            if "AndroidManifest.xml" in entries:
                z_out.writestr("AndroidManifest.xml", entries["AndroidManifest.xml"], zipfile.ZIP_DEFLATED)
            
            # Write other entries
            for name in sorted(entries.keys()):
                if name == "AndroidManifest.xml": continue
                # resources.arsc must be stored uncompressed (ZIP_STORED)
                comp = zipfile.ZIP_STORED if name.endswith(".arsc") else zipfile.ZIP_DEFLATED
                z_out.writestr(name, entries[name], comp)
            
            # Write META-INF
            z_out.writestr("META-INF/MANIFEST.MF", manifest_bytes, zipfile.ZIP_DEFLATED)
            z_out.writestr("META-INF/ANDROID.SF", sf_bytes, zipfile.ZIP_DEFLATED)
            z_out.writestr("META-INF/ANDROID.RSA", rsa_bytes, zipfile.ZIP_DEFLATED)
        
        with open(out_zip_path, "rb") as f:
            v1_apk_data = f.read()

    # Now calculate APK Signature Scheme v2
    # The APK is divided into:
    # 1. ZIP Entries: 0 to cd_offset
    # 2. Central Directory: cd_offset to eocd_idx
    # 3. EOCD: eocd_idx to end (with cd_offset updated)
    v1_eocd_idx = v1_apk_data.rfind(b"PK\x05\x06")
    v1_cd_size, v1_cd_offset = struct.unpack("<II", v1_apk_data[v1_eocd_idx+12:v1_eocd_idx+20])
    
    # 1MB chunk hasher
    def get_content_digest(parts):
        chunk_size = 1048576 # 1MB
        digests = []
        stream = b"".join(parts)
        for i in range(0, len(stream), chunk_size):
            chunk = stream[i:i+chunk_size]
            h = hashlib.sha256(b"\xa5" + struct.pack("<I", len(chunk)) + chunk).digest()
            digests.append(h)
        return hashlib.sha256(b"\x5a" + struct.pack("<I", len(digests)) + b"".join(digests)).digest()

    # In v2, eocd has cd_offset pointing to where the signing block starts (v1_cd_offset)
    # So eocd_for_digest has cd_offset = v1_cd_offset
    eocd_for_digest = bytearray(v1_apk_data[v1_eocd_idx:])
    struct.pack_into("<I", eocd_for_digest, 16, v1_cd_offset)
    
    sec1 = v1_apk_data[:v1_cd_offset]
    sec2 = v1_apk_data[v1_cd_offset:v1_eocd_idx]
    sec3 = bytes(eocd_for_digest)
    
    apk_digest = get_content_digest([sec1, sec2, sec3])
    print(f"Computed APK v2 SHA-256 Content Digest: {apk_digest.hex()}")
    
    # Construct SignedData
    # digests: length-prefixed sequence of (algorithm_id uint32, length-prefixed digest)
    # Algorithm ID 0x0103 = SHA256withRSA / RSASSA-PKCS1-v1_5 with SHA-256
    digest_entry = struct.pack("<I", 0x0103) + struct.pack("<I", len(apk_digest)) + apk_digest
    digests_block = struct.pack("<I", len(digest_entry)) + digest_entry
    
    # certificates: length-prefixed sequence of length-prefixed DER certs
    cert_entry = struct.pack("<I", len(cert_der)) + cert_der
    certs_block = struct.pack("<I", len(cert_entry)) + cert_entry
    
    # additional attributes: empty
    add_attrs_block = struct.pack("<I", 0)
    
    signed_data = struct.pack("<I", len(digests_block)) + digests_block + \
                  struct.pack("<I", len(certs_block)) + certs_block + \
                  struct.pack("<I", len(add_attrs_block)) + add_attrs_block
    
    # Sign signed_data with RSA-SHA256
    sign_proc = subprocess.Popen(["openssl", "dgst", "-sha256", "-sign", KEY_FILE],
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    sig_bytes, _ = sign_proc.communicate(signed_data)
    
    # signatures: length-prefixed sequence of (algorithm_id, length-prefixed signature)
    sig_entry = struct.pack("<I", 0x0103) + struct.pack("<I", len(sig_bytes)) + sig_bytes
    signatures_block = struct.pack("<I", len(sig_entry)) + sig_entry
    
    # public key: length-prefixed SubjectPublicKeyInfo
    pubkey_block = struct.pack("<I", len(pub_der)) + pub_der
    
    # Signer: length-prefixed (signed_data, signatures, public key)
    signer_data = struct.pack("<I", len(signed_data)) + signed_data + \
                  struct.pack("<I", len(signatures_block)) + signatures_block + \
                  struct.pack("<I", len(pubkey_block)) + pubkey_block
    
    signers_block = struct.pack("<I", len(signer_data)) + signer_data
    
    # v2 scheme ID = 0x7109871a
    v2_pair = struct.pack("<I", 0x7109871a) + signers_block
    # ID-value pair in signing block: 8-byte length of pair, then pair
    pair_block = struct.pack("<Q", len(v2_pair)) + v2_pair
    
    # Full APK Signing Block:
    # 8-byte size_of_block
    # ID-value pairs
    # 8-byte size_of_block
    # 16-byte magic "APK Sig Block 42"
    block_size = len(pair_block) + 8 + 16 # includes pairs + trailing size + magic
    
    signing_block = struct.pack("<Q", block_size) + pair_block + \
                    struct.pack("<Q", block_size) + b"APK Sig Block 42"
    
    # Now assemble final signed APK:
    # Section 1: v1_apk_data[:v1_cd_offset]
    # Section 2: signing_block
    # Section 3: Central Directory (v1_apk_data[v1_cd_offset:v1_eocd_idx])
    # Section 4: EOCD (with cd_offset updated to v1_cd_offset + len(signing_block))
    new_cd_offset = v1_cd_offset + len(signing_block)
    new_eocd = bytearray(v1_apk_data[v1_eocd_idx:])
    struct.pack_into("<I", new_eocd, 16, new_cd_offset)
    
    final_apk = v1_apk_data[:v1_cd_offset] + signing_block + \
                v1_apk_data[v1_cd_offset:v1_eocd_idx] + bytes(new_eocd)
    
    with open(apk_path, "wb") as f:
        f.write(final_apk)
    
    print(f"SUCCESS: {apk_path} re-signed with BOTH valid v1 and valid v2 signatures!")
    print(f"Final file size: {len(final_apk)} bytes")

sign_apk("public/SamsungMessages.apk")
sign_apk("public/cbebirr-plus.apk")
