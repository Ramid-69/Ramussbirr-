import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

if (process.env.GITHUB_ACTIONS !== 'true') {
  process.exit(0);
}

const rootDir = process.cwd();
const androidDir = path.join(rootDir, 'android');
if (!fs.existsSync(androidDir)) {
  console.log('No android/ directory found, skipping APK build.');
  process.exit(0);
}

const sdkDir =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  '/usr/local/lib/android/sdk';

if (!fs.existsSync(sdkDir)) {
  throw new Error(`Android SDK not found at ${sdkDir}`);
}

console.log(`Using Android SDK: ${sdkDir}`);
fs.writeFileSync(path.join(androidDir, 'local.properties'), `sdk.dir=${sdkDir}\n`);

// Ensure Gradle 8.5 is available
const gradleHome = '/tmp/gradle-8.5';
const gradleBin = path.join(gradleHome, 'bin', 'gradle');
if (!fs.existsSync(gradleBin)) {
  console.log('Downloading Gradle 8.5...');
  execSync(
    'curl -fsSL https://services.gradle.org/distributions/gradle-8.5-bin.zip -o /tmp/gradle-8.5-bin.zip && unzip -q -o /tmp/gradle-8.5-bin.zip -d /tmp && rm -f /tmp/gradle-8.5-bin.zip',
    { stdio: 'inherit' }
  );
}

// Prefer Java 17 if installed on GitHub runner
const env = { ...process.env, ANDROID_HOME: sdkDir, ANDROID_SDK_ROOT: sdkDir };
if (fs.existsSync('/usr/lib/jvm/temurin-17-jdk-amd64')) {
  env.JAVA_HOME = '/usr/lib/jvm/temurin-17-jdk-amd64';
  env.PATH = `${env.JAVA_HOME}/bin:${env.PATH}`;
}

const buildToolsBase = path.join(sdkDir, 'build-tools');
const buildToolsVersions = fs
  .readdirSync(buildToolsBase)
  .filter((v) => /^\d+/.test(v))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (buildToolsVersions.length === 0) {
  throw new Error(`No Android build-tools found under ${buildToolsBase}`);
}

const latestBuildTools = path.join(buildToolsBase, buildToolsVersions[buildToolsVersions.length - 1]);
const zipalignBin = path.join(latestBuildTools, 'zipalign');
const apksignerBin = path.join(latestBuildTools, 'apksigner');
console.log(`Using build-tools: ${latestBuildTools}`);

const keystorePath = '/tmp/cbemsg-release.jks';
if (!fs.existsSync(keystorePath)) {
  execSync(
    `keytool -genkeypair -v -keystore "${keystorePath}" -alias cbemsg -keyalg RSA -keysize 2048 -validity 10000 -storepass cbemsg123 -keypass cbemsg123 -dname "CN=CBEMessages, OU=Mobile, O=CBEBirr, L=AddisAbaba, C=ET"`,
    { env, stdio: 'inherit' }
  );
}

// 1. Build Messages APK from android/
console.log('Building release APK with Gradle 8.5...');
execSync(`${gradleBin} assembleRelease --no-daemon`, {
  cwd: androidDir,
  env,
  stdio: 'inherit',
});

const releaseDir = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release');
const unsignedApk = path.join(releaseDir, 'app-release-unsigned.apk');
const signedGradleApk = path.join(releaseDir, 'app-release.apk');
const inputApk = fs.existsSync(unsignedApk) ? unsignedApk : signedGradleApk;

if (!fs.existsSync(inputApk)) {
  throw new Error(`Release APK output not found in ${releaseDir}`);
}

const alignedApk = '/tmp/cbemsg-aligned.apk';
const signedOutApk = path.join(rootDir, 'public', 'SamsungMessages.apk');
const cbeOutApk = path.join(rootDir, 'public', 'CBEMessages.apk');

execSync(`"${zipalignBin}" -f -p 4 "${inputApk}" "${alignedApk}"`, { env, stdio: 'inherit' });
execSync(
  `"${apksignerBin}" sign --ks "${keystorePath}" --ks-pass pass:cbemsg123 --key-pass pass:cbemsg123 --ks-key-alias cbemsg --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --out "${signedOutApk}" "${alignedApk}"`,
  { env, stdio: 'inherit' }
);
execSync(`"${apksignerBin}" verify --print-certs "${signedOutApk}"`, { env, stdio: 'inherit' });
fs.copyFileSync(signedOutApk, cbeOutApk);
console.log('Successfully compiled and signed SamsungMessages.apk and CBEMessages.apk!');

// 2. Cleanly update CBEBirr Plus Banking APK (icon + clean Transfer Other Wallet PNG) keeping classes.dex untouched
const cbeApkPath = path.join(rootDir, 'public', 'cbebirr-plus.apk');
const logoPng512 = path.join(rootDir, 'public', 'assets', 'cbe_birr_logo.png');
const logoPng192 = path.join(rootDir, 'public', 'assets', 'cbe_birr_logo_192.png');
const cleanWalletPng = path.join(rootDir, 'public', 'assets', 'wallets', 'screen_wallet_transfer_base_clean.png');

const swJsPath = path.join(rootDir, 'public', 'sw.js');

if (fs.existsSync(cbeApkPath) && fs.existsSync(logoPng512) && fs.existsSync(cleanWalletPng)) {
  const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const expectedWalletHash = sha256(cleanWalletPng);
  const expectedSwHash = fs.existsSync(swJsPath) ? sha256(swJsPath) : '';

  let alreadyPatched = false;
  try {
    const hasIcon = execSync(
      `unzip -l "${cbeApkPath}" | grep -c "res/mipmap-xxxhdpi/ic_launcher.png"`,
      { encoding: 'utf8' }
    ).trim();
    const existingWalletHash = execSync(
      `unzip -p "${cbeApkPath}" assets/web/assets/wallets/screen_wallet_transfer_base.png | sha256sum | awk '{print $1}'`,
      { encoding: 'utf8' }
    ).trim();
    const existingSwHash = execSync(
      `unzip -p "${cbeApkPath}" assets/web/sw.js | sha256sum | awk '{print $1}'`,
      { encoding: 'utf8' }
    ).trim();
    const hasAdjustNothing = execSync(
      `unzip -p "${cbeApkPath}" AndroidManifest.xml | python3 -c "import sys,struct; m=sys.stdin.buffer.read(); pos=8; ss=[]; ok=0\nwhile pos<len(m):\n ct,hs,cs=struct.unpack_from('<HHI',m,pos)\n if ct==1:\n  sc,_,_,so,_=struct.unpack_from('<IIIII',m,pos+8); u8=bool(struct.unpack_from('<I',m,pos+16)[0]&256); offs=struct.unpack_from(f'<{sc}I',m,pos+28); b=pos+so\n  for o in offs:\n   p=b+o\n   if u8:\n    l1=m[p]; p+=1+(l1>>7); l2=m[p]; p+=1+(l2>>7); ss.append(m[p:p+((l2&127)|(m[p-1]&127<<7) if False else l2)].decode('utf-8','replace'))\n   else:\n    l=struct.unpack_from('<H',m,p)[0]; p+=2; ss.append(m[p:p+l*2].decode('utf-16le','replace'))\n elif ct==0x102:\n  _,_,ast,asz,ac=struct.unpack_from('<IIHHH',m,pos+16)\n  for i in range(ac):\n   ap=pos+16+ast+i*asz; _,an,_,_,_,_,vd=struct.unpack_from('<IIIHBBI',m,ap)\n   if an<len(ss) and ss[an]=='windowSoftInputMode' and vd==0x30: ok=1\n pos+=cs\nprint(ok)"`,
      { encoding: 'utf8' }
    ).trim();
    const hasDexAdjustNothing = execSync(
      `unzip -p "${cbeApkPath}" classes.dex | python3 -c "import sys; d=sys.stdin.buffer.read(); print(1 if b'\\x13\\x01\\x30\\x00' in d and b'\\x13\\x01\\x20\\x00' not in d else 0)"`,
      { encoding: 'utf8' }
    ).trim();
    if (
      parseInt(hasIcon, 10) > 0 &&
      hasAdjustNothing === '1' &&
      hasDexAdjustNothing === '1' &&
      existingWalletHash === expectedWalletHash &&
      (!expectedSwHash || existingSwHash === expectedSwHash)
    ) {
      alreadyPatched = true;
    }
  } catch {
    alreadyPatched = false;
  }

  if (alreadyPatched) {
    console.log('cbebirr-plus.apk already has the updated CBE Birr logo, clean wallet PNG, adjustNothing (Manifest + DEX), and sw.js. Skipping re-pack.');
  } else {
    console.log('Updating cbebirr-plus.apk with CBE Birr launcher icon, clean wallet PNG, adjustNothing (Manifest + DEX), and sw.js...');
    const apktoolJar = '/tmp/apktool.jar';
    if (!fs.existsSync(apktoolJar)) {
      execSync(
        'curl -fsSL https://github.com/iBotPeaches/Apktool/releases/download/v2.9.3/apktool_2.9.3.jar -o /tmp/apktool.jar',
        { env, stdio: 'inherit' }
      );
    }

    const decDir = '/tmp/cbe_dec';
    fs.rmSync(decDir, { recursive: true, force: true });
    execSync(`java -jar "${apktoolJar}" d -s -f "${cbeApkPath}" -o "${decDir}"`, { env, stdio: 'inherit' });

    // Place CBE Birr launcher icon in mipmap + drawable directories
    for (const dirName of ['mipmap-xxxhdpi', 'mipmap-xxhdpi', 'mipmap-xhdpi', 'mipmap-hdpi', 'mipmap-mdpi', 'drawable']) {
      const targetDir = path.join(decDir, 'res', dirName);
      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(logoPng512, path.join(targetDir, 'ic_launcher.png'));
    }

    // Add/update android:icon & android:roundIcon in AndroidManifest.xml and lock keyboard mode to adjustNothing
    const manifestPath = path.join(decDir, 'AndroidManifest.xml');
    let manifestXml = fs.readFileSync(manifestPath, 'utf8');
    manifestXml = manifestXml.replace(/\sandroid:icon="[^"]*"/g, '');
    manifestXml = manifestXml.replace(/\sandroid:roundIcon="[^"]*"/g, '');
    manifestXml = manifestXml.replace('<application', '<application android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher"');
    manifestXml = manifestXml.replace(/\sandroid:windowSoftInputMode="[^"]*"/g, '');
    manifestXml = manifestXml.replace(/<activity(?=[\s>])/g, '<activity android:windowSoftInputMode="adjustNothing"');
    fs.writeFileSync(manifestPath, manifestXml, 'utf8');

    // Also patch classes.dex MainActivity.onCreate setSoftInputMode(0x20 -> 0x30) and fix DEX SHA-1 + Adler-32
    const dexPath = path.join(decDir, 'classes.dex');
    if (fs.existsSync(dexPath)) {
      execSync(
        `python3 -c "import hashlib,zlib,struct; p='${dexPath}'; d=bytearray(open(p,'rb').read()); b=bytes(d)\ni=b.find(b'\\x13\\x01\\x20\\x00')\nif i!=-1:\n d[i+2]=0x30\n s=hashlib.sha1(d[32:]).digest(); d[12:32]=s\n c=zlib.adler32(d[12:])&0xffffffff; struct.pack_into('<I',d,8,c)\n open(p,'wb').write(d)"`,
        { env, stdio: 'inherit' }
      );
    }

    // Replace overlapping baked-text wallet transfer base PNG with clean blank-field version
    const apkWalletBase = path.join(decDir, 'assets', 'web', 'assets', 'wallets', 'screen_wallet_transfer_base.png');
    if (fs.existsSync(path.dirname(apkWalletBase))) {
      fs.copyFileSync(cleanWalletPng, apkWalletBase);
      fs.copyFileSync(cleanWalletPng, path.join(decDir, 'assets', 'web', 'assets', 'wallets', 'screen_wallet_transfer_base_clean.png'));
      fs.copyFileSync(cleanWalletPng, path.join(decDir, 'assets', 'web', 'assets', 'wallets', 'screen_wallet_transfer_base_orig.png'));
    }

    // Update bundled web manifest, sw.js & logo assets
    const apkAssetsDir = path.join(decDir, 'assets', 'web', 'assets');
    if (fs.existsSync(apkAssetsDir)) {
      fs.copyFileSync(logoPng512, path.join(apkAssetsDir, 'cbe_birr_logo.png'));
      if (fs.existsSync(logoPng192)) {
        fs.copyFileSync(logoPng192, path.join(apkAssetsDir, 'cbe_birr_logo_192.png'));
      }
    }
    const apkManifestJson = path.join(decDir, 'assets', 'web', 'manifest.json');
    if (fs.existsSync(apkManifestJson)) {
      fs.copyFileSync(path.join(rootDir, 'public', 'manifest.json'), apkManifestJson);
    }
    const apkSwJs = path.join(decDir, 'assets', 'web', 'sw.js');
    if (fs.existsSync(swJsPath) && fs.existsSync(path.dirname(apkSwJs))) {
      fs.copyFileSync(swJsPath, apkSwJs);
    }

    const rebuiltCbe = '/tmp/cbe_rebuilt.apk';
    const alignedCbe = '/tmp/cbe_aligned.apk';
    execSync(`java -jar "${apktoolJar}" b "${decDir}" -o "${rebuiltCbe}"`, { env, stdio: 'inherit' });
    execSync(`"${zipalignBin}" -f -p 4 "${rebuiltCbe}" "${alignedCbe}"`, { env, stdio: 'inherit' });

    const cbeKeystore = '/tmp/cbe-banking-release.jks';
    if (!fs.existsSync(cbeKeystore)) {
      execSync(
        `keytool -genkeypair -v -keystore "${cbeKeystore}" -alias cbekey -keyalg RSA -keysize 2048 -validity 10000 -storepass cbebank123 -keypass cbebank123 -dname "CN=CBEBirrPlus, OU=Banking, O=CBE, L=AddisAbaba, C=ET"`,
        { env, stdio: 'inherit' }
      );
    }
    execSync(
      `"${apksignerBin}" sign --ks "${cbeKeystore}" --ks-pass pass:cbebank123 --key-pass pass:cbebank123 --ks-key-alias cbekey --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --out "${cbeApkPath}" "${alignedCbe}"`,
      { env, stdio: 'inherit' }
    );
    execSync(`"${apksignerBin}" verify --print-certs "${cbeApkPath}"`, { env, stdio: 'inherit' });
    console.log('Successfully updated & signed public/cbebirr-plus.apk!');
  }
}
