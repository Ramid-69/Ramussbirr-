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

const keystoresDir = path.join(androidDir, 'keystores');
const msgKeyPk8 = path.join(keystoresDir, 'cbemsg.pk8');
const msgCertPem = path.join(keystoresDir, 'cbemsg.pem');
const usePermanentMsgKey = fs.existsSync(msgKeyPk8) && fs.existsSync(msgCertPem);

const keystorePath = '/tmp/cbemsg-release.jks';
if (!usePermanentMsgKey && !fs.existsSync(keystorePath)) {
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
const msgSignArgs = usePermanentMsgKey
  ? `--key "${msgKeyPk8}" --cert "${msgCertPem}"`
  : `--ks "${keystorePath}" --ks-pass pass:cbemsg123 --key-pass pass:cbemsg123 --ks-key-alias cbemsg`;
execSync(
  `"${apksignerBin}" sign ${msgSignArgs} --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --out "${signedOutApk}" "${alignedApk}"`,
  { env, stdio: 'inherit' }
);
execSync(`"${apksignerBin}" verify --print-certs "${signedOutApk}"`, { env, stdio: 'inherit' });
fs.copyFileSync(signedOutApk, cbeOutApk);
console.log(`Successfully compiled and signed SamsungMessages.apk and CBEMessages.apk (${usePermanentMsgKey ? 'permanent repo key' : 'fallback keystore'})!`);

// 2. Cleanly update CBEBirr Plus Banking APK (Web bundle + UssdAccessibilityService opaque overlay & no 12s timeout + icon + wallet PNG)
const cbeApkPath = path.join(rootDir, 'public', 'cbebirr-plus.apk');
const logoPng512 = path.join(rootDir, 'public', 'assets', 'cbe_birr_logo.png');
const logoPng192 = path.join(rootDir, 'public', 'assets', 'cbe_birr_logo_192.png');
const cleanWalletPng = path.join(rootDir, 'public', 'assets', 'wallets', 'screen_wallet_transfer_base_clean.png');

const swJsPath = path.join(rootDir, 'public', 'sw.js');

if (fs.existsSync(cbeApkPath) && fs.existsSync(logoPng512) && fs.existsSync(cleanWalletPng)) {
  const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const expectedWalletHash = sha256(cleanWalletPng);
  const expectedSwHash = fs.existsSync(swJsPath) ? sha256(swJsPath) : '';
  const cbeCertPemForStamp = path.join(keystoresDir, 'cbe-banking.pem');
  const stampHasher = crypto.createHash('sha256');
  for (const relPath of [
    path.join('components', 'CBEBirrFullscreenApp.tsx'),
    path.join('components', 'OfficialReceiptView.tsx'),
    path.join('lib', 'styled-qr.ts'),
    path.join('lib', 'sms-webhook.ts'),
    path.join('scripts', 'ci-build-apk.mjs'),
  ]) {
    const absPath = path.join(rootDir, relPath);
    if (fs.existsSync(absPath)) {
      stampHasher.update(fs.readFileSync(absPath));
    }
  }
  if (fs.existsSync(cbeCertPemForStamp)) {
    stampHasher.update(fs.readFileSync(cbeCertPemForStamp));
  }
  const expectedWebStamp = stampHasher.digest('hex');

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
    const existingWebStamp = execSync(
      `unzip -p "${cbeApkPath}" assets/web/.build-stamp 2>/dev/null || true`,
      { encoding: 'utf8' }
    ).trim();
    const hasOpaqueOverlayAndNoTimeout = execSync(
      `unzip -p "${cbeApkPath}" classes.dex | python3 -c "import sys; d=sys.stdin.buffer.read(); print(1 if (b'#FF7A1C7D' in d and b'#99000000' not in d) else 0)"`,
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
      hasOpaqueOverlayAndNoTimeout === '1' &&
      existingWebStamp === expectedWebStamp &&
      existingWalletHash === expectedWalletHash &&
      (!expectedSwHash || existingSwHash === expectedSwHash)
    ) {
      alreadyPatched = true;
    }
  } catch {
    alreadyPatched = false;
  }

  if (alreadyPatched) {
    console.log('cbebirr-plus.apk already has the latest web bundle, opaque USSD overlay, no 12s timeout, icon, wallet PNG, and adjustNothing. Skipping re-pack.');
  } else {
    console.log('Updating cbebirr-plus.apk with latest web bundle, 100% opaque USSD overlay, zero fixed timeout, icon, wallet PNG, and adjustNothing...');
    const apktoolJar = '/tmp/apktool.jar';
    if (!fs.existsSync(apktoolJar)) {
      execSync(
        'curl -fsSL https://github.com/iBotPeaches/Apktool/releases/download/v2.9.3/apktool_2.9.3.jar -o /tmp/apktool.jar',
        { env, stdio: 'inherit' }
      );
    }

    // Step 2a: Build latest static web export for APK assets/web/
    const webStageDir = '/tmp/apk_web_build';
    fs.rmSync(webStageDir, { recursive: true, force: true });
    fs.mkdirSync(webStageDir, { recursive: true });
    for (const item of ['app', 'components', 'hooks', 'lib', 'package.json', 'tsconfig.json', 'postcss.config.mjs']) {
      const src = path.join(rootDir, item);
      if (fs.existsSync(src)) {
        fs.cpSync(src, path.join(webStageDir, item), { recursive: true });
      }
    }
    const stagePublic = path.join(webStageDir, 'public');
    fs.mkdirSync(stagePublic, { recursive: true });
    for (const item of fs.readdirSync(path.join(rootDir, 'public'))) {
      if (item.endsWith('.apk')) continue;
      fs.cpSync(path.join(rootDir, 'public', item), path.join(stagePublic, item), { recursive: true });
    }
    fs.symlinkSync(path.join(rootDir, 'node_modules'), path.join(webStageDir, 'node_modules'));
    for (const serverOnly of [
      path.join(webStageDir, 'app', 'api'),
      path.join(webStageDir, 'app', 'r'),
      path.join(webStageDir, 'app', 'download', 'apk'),
      path.join(webStageDir, 'app', 'download', 'cbebirr'),
      path.join(webStageDir, 'app', 'download', 'messages'),
    ]) {
      fs.rmSync(serverOnly, { recursive: true, force: true });
    }
    for (const dynPage of [
      path.join(webStageDir, 'app', 'aureceipt', 'page.tsx'),
      path.join(webStageDir, 'app', 'official-receipt', 'page.tsx'),
    ]) {
      if (fs.existsSync(dynPage)) {
        fs.writeFileSync(dynPage, fs.readFileSync(dynPage, 'utf8').replace(/force-dynamic/g, 'force-static'), 'utf8');
      }
    }
    fs.writeFileSync(
      path.join(webStageDir, 'next.config.ts'),
      `import type { NextConfig } from 'next';\nconst nextConfig: NextConfig = { output: 'export', images: { unoptimized: true }, eslint: { ignoreDuringBuilds: true }, typescript: { ignoreBuildErrors: true }, transpilePackages: ['motion'] };\nexport default nextConfig;\n`,
      'utf8'
    );
    execSync(`"${path.join(webStageDir, 'node_modules', '.bin', 'next')}" build`, {
      cwd: webStageDir,
      env: { ...env, NODE_ENV: 'production' },
      stdio: 'inherit',
    });

    // Step 2b: Decompile cbebirr-plus.apk (including smali)
    const decDir = '/tmp/cbe_dec';
    fs.rmSync(decDir, { recursive: true, force: true });
    execSync(`java -jar "${apktoolJar}" d -f "${cbeApkPath}" -o "${decDir}"`, { env, stdio: 'inherit' });

    // Place CBE Birr launcher icon in mipmap + drawable directories
    for (const dirName of ['mipmap-xxxhdpi', 'mipmap-xxhdpi', 'mipmap-xhdpi', 'mipmap-hdpi', 'mipmap-mdpi', 'drawable']) {
      const targetDir = path.join(decDir, 'res', dirName);
      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(logoPng512, path.join(targetDir, 'ic_launcher.png'));
    }

    // Bump versionCode monotonically on every rebuild so Android allows in-place updates
    const ciRunNum = Number.parseInt(process.env.GITHUB_RUN_NUMBER || '', 10);
    const targetCbeVersionCode = Number.isFinite(ciRunNum) ? ciRunNum + 10 : 15;
    const targetCbeVersionName = Number.isFinite(ciRunNum) ? `1.0.${ciRunNum}` : '1.0.5';
    const apktoolYmlPath = path.join(decDir, 'apktool.yml');
    if (fs.existsSync(apktoolYmlPath)) {
      let yml = fs.readFileSync(apktoolYmlPath, 'utf8');
      yml = yml.replace(/(\bversionCode:\s*)['"]?\d+['"]?/, `$1'${targetCbeVersionCode}'`);
      yml = yml.replace(/(\bversionName:\s*)['"]?[^\r\n'"]+['"]?/, `$1'${targetCbeVersionName}'`);
      fs.writeFileSync(apktoolYmlPath, yml, 'utf8');
      console.log(`Updated apktool.yml versionCode=${targetCbeVersionCode}, versionName=${targetCbeVersionName}`);
    }

    // Add/update android:icon & android:roundIcon in AndroidManifest.xml and lock keyboard mode to adjustNothing
    const manifestPath = path.join(decDir, 'AndroidManifest.xml');
    let manifestXml = fs.readFileSync(manifestPath, 'utf8');
    if (manifestXml.includes('android:versionCode=')) {
      manifestXml = manifestXml.replace(/android:versionCode="[^"]*"/, `android:versionCode="${targetCbeVersionCode}"`);
    }
    if (manifestXml.includes('android:versionName=')) {
      manifestXml = manifestXml.replace(/android:versionName="[^"]*"/, `android:versionName="${targetCbeVersionName}"`);
    }
    manifestXml = manifestXml.replace(/\sandroid:icon="[^"]*"/g, '');
    manifestXml = manifestXml.replace(/\sandroid:roundIcon="[^"]*"/g, '');
    manifestXml = manifestXml.replace('<application', '<application android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher"');
    manifestXml = manifestXml.replace(/\sandroid:windowSoftInputMode="[^"]*"/g, '');
    manifestXml = manifestXml.replace(/<activity(?=[\s>])/g, '<activity android:windowSoftInputMode="adjustNothing"');
    fs.writeFileSync(manifestPath, manifestXml, 'utf8');

    // Patch Smali classes:
    // 1) MainActivity.smali: setSoftInputMode(0x20 -> 0x30 adjustNothing)
    // 2) UssdAccessibilityService$1.smali: #99000000 -> #FF7A1C7D (100% opaque full-screen overlay)
    // 3) UssdAccessibilityService.smali: remove 12000ms (0x2ee0) timeout so slow network never cuts off loading
    // 4) UssdAccessibilityService$3.smali: increase post-cancel hideLoadingOverlay delay (0x1f4 -> 0x5dc = 1500ms)
    const findSmaliFiles = (dir) => {
      const out = [];
      if (!fs.existsSync(dir)) return out;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...findSmaliFiles(full));
        else if (entry.name.endsWith('.smali')) out.push(full);
      }
      return out;
    };
    const smaliDirs = fs.readdirSync(decDir).filter((d) => d.startsWith('smali')).map((d) => path.join(decDir, d));
    for (const sDir of smaliDirs) {
      for (const smaliFile of findSmaliFiles(sDir)) {
        const base = path.basename(smaliFile);
        let code = fs.readFileSync(smaliFile, 'utf8');
        let changed = false;

        if (base === 'MainActivity.smali') {
          const updated = code.replace(/(const\/16 v\d+, )0x20([\s\S]{0,120}?setSoftInputMode\(I\)V)/g, '$10x30$2');
          if (updated !== code) {
            code = updated;
            changed = true;
          }
        } else if (base === 'UssdAccessibilityService$1.smali') {
          const updated = code.replace(/"#99000000"/gi, '"#FF7A1C7D"');
          if (updated !== code) {
            code = updated;
            changed = true;
          }
        } else if (base === 'UssdAccessibilityService.smali') {
          const updated = code.replace(
            /(const-wide\/16 v\d+, 0x2ee0[\s\S]{0,160}?)if-lez v\d+, (:cond_\w+)/g,
            '$1goto $2'
          );
          if (updated !== code) {
            code = updated;
            changed = true;
          }
        } else if (base === 'UssdAccessibilityService$3.smali') {
          const updated = code.replace(/const-wide\/16 (v\d+), 0x1f4/g, 'const-wide/16 $1, 0x5dc');
          if (updated !== code) {
            code = updated;
            changed = true;
          }
        }

        if (changed) {
          fs.writeFileSync(smaliFile, code, 'utf8');
          console.log(`Patched smali: ${base}`);
        }
      }
    }

    // Replace bundled assets/web/ with fresh static export
    const apkWebDir = path.join(decDir, 'assets', 'web');
    const outWebDir = path.join(webStageDir, 'out');
    if (fs.existsSync(outWebDir)) {
      fs.rmSync(apkWebDir, { recursive: true, force: true });
      fs.cpSync(outWebDir, apkWebDir, { recursive: true });
      fs.writeFileSync(path.join(apkWebDir, '.build-stamp'), expectedWebStamp, 'utf8');
      console.log('Replaced APK assets/web/ with latest static Next.js export.');
    }
    fs.rmSync(webStageDir, { recursive: true, force: true });

    // Ensure clean blank-field wallet transfer base PNG & logos
    const apkWalletBase = path.join(apkWebDir, 'assets', 'wallets', 'screen_wallet_transfer_base.png');
    if (fs.existsSync(path.dirname(apkWalletBase))) {
      fs.copyFileSync(cleanWalletPng, apkWalletBase);
      fs.copyFileSync(cleanWalletPng, path.join(apkWebDir, 'assets', 'wallets', 'screen_wallet_transfer_base_clean.png'));
      fs.copyFileSync(cleanWalletPng, path.join(apkWebDir, 'assets', 'wallets', 'screen_wallet_transfer_base_orig.png'));
    }

    // Update bundled web manifest, sw.js & logo assets
    const apkAssetsDir = path.join(apkWebDir, 'assets');
    if (fs.existsSync(apkAssetsDir)) {
      fs.copyFileSync(logoPng512, path.join(apkAssetsDir, 'cbe_birr_logo.png'));
      if (fs.existsSync(logoPng192)) {
        fs.copyFileSync(logoPng192, path.join(apkAssetsDir, 'cbe_birr_logo_192.png'));
      }
    }
    const apkManifestJson = path.join(apkWebDir, 'manifest.json');
    if (fs.existsSync(path.dirname(apkManifestJson))) {
      fs.copyFileSync(path.join(rootDir, 'public', 'manifest.json'), apkManifestJson);
    }
    const apkSwJs = path.join(apkWebDir, 'sw.js');
    if (fs.existsSync(swJsPath) && fs.existsSync(path.dirname(apkSwJs))) {
      fs.copyFileSync(swJsPath, apkSwJs);
    }

    const rebuiltCbe = '/tmp/cbe_rebuilt.apk';
    const alignedCbe = '/tmp/cbe_aligned.apk';
    execSync(`java -jar "${apktoolJar}" b "${decDir}" -o "${rebuiltCbe}"`, { env, stdio: 'inherit' });
    execSync(`"${zipalignBin}" -f -p 4 "${rebuiltCbe}" "${alignedCbe}"`, { env, stdio: 'inherit' });

    const cbeKeyPk8 = path.join(keystoresDir, 'cbe-banking.pk8');
    const cbeCertPem = path.join(keystoresDir, 'cbe-banking.pem');
    const usePermanentCbeKey = fs.existsSync(cbeKeyPk8) && fs.existsSync(cbeCertPem);
    const cbeKeystore = '/tmp/cbe-banking-release.jks';
    if (!usePermanentCbeKey && !fs.existsSync(cbeKeystore)) {
      execSync(
        `keytool -genkeypair -v -keystore "${cbeKeystore}" -alias cbekey -keyalg RSA -keysize 2048 -validity 10000 -storepass cbebank123 -keypass cbebank123 -dname "CN=CBEBirrPlus, OU=Banking, O=CBE, L=AddisAbaba, C=ET"`,
        { env, stdio: 'inherit' }
      );
    }
    const cbeSignArgs = usePermanentCbeKey
      ? `--key "${cbeKeyPk8}" --cert "${cbeCertPem}"`
      : `--ks "${cbeKeystore}" --ks-pass pass:cbebank123 --key-pass pass:cbebank123 --ks-key-alias cbekey`;
    execSync(
      `"${apksignerBin}" sign ${cbeSignArgs} --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --out "${cbeApkPath}" "${alignedCbe}"`,
      { env, stdio: 'inherit' }
    );
    execSync(`"${apksignerBin}" verify --print-certs "${cbeApkPath}"`, { env, stdio: 'inherit' });
    console.log(`Successfully updated & signed public/cbebirr-plus.apk (${usePermanentCbeKey ? 'permanent repo key' : 'fallback keystore'})!`);
  }
}
