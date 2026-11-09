#!/bin/bash
set -e

echo "=== Building Samsung Messages APK ==="
rm -rf android-messages/gen android-messages/bin
mkdir -p android-messages/gen android-messages/bin/classes

# 1. Generate R.java
echo "1. Generating R.java..."
aapt package -f -m \
  -J android-messages/gen \
  -M android-messages/AndroidManifest.xml \
  -S android-messages/res \
  -I /usr/lib/android-sdk/platforms/android-23/android.jar

# 2. Compile Java sources
echo "2. Compiling Java sources with javac..."
javac -source 8 -target 8 \
  -cp /usr/lib/android-sdk/platforms/android-23/android.jar \
  -d android-messages/bin/classes \
  android-messages/src/com/samsung/messages/cbe/*.java \
  android-messages/gen/com/samsung/messages/cbe/*.java

# 3. Convert to Dalvik DEX
echo "3. Converting to DEX with dalvik-exchange..."
/usr/bin/dalvik-exchange --dex \
  --output=android-messages/bin/classes.dex \
  android-messages/bin/classes

# 4. Package resources and Manifest into APK base (including assets/messages.html)
echo "4. Packaging APK base with aapt..."
aapt package -f \
  -M android-messages/AndroidManifest.xml \
  -S android-messages/res \
  -A android-messages/assets \
  -I /usr/lib/android-sdk/platforms/android-23/android.jar \
  -F android-messages/bin/unsigned.apk

# 5. Add classes.dex to APK
echo "5. Adding classes.dex..."
cd android-messages/bin
aapt add unsigned.apk classes.dex
cd ../..

# 6. Zipalign APK
echo "6. Running zipalign..."
zipalign -f -p 4 android-messages/bin/unsigned.apk android-messages/bin/aligned.apk

# 7. Generate release key if not exists
if [ ! -f android-messages/keystore.jks ]; then
  echo "Generating keystore..."
  keytool -genkeypair -v \
    -keystore android-messages/keystore.jks \
    -alias android \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass android \
    -keypass android \
    -dname "CN=Messages, OU=Samsung, O=Samsung, L=Seoul, ST=Seoul, C=KR"
fi

# 8. Sign APK with apksigner (v1 & v2 signatures)
echo "7. Signing APK..."
apksigner sign \
  --ks android-messages/keystore.jks \
  --ks-pass pass:android \
  --key-pass pass:android \
  --out public/SamsungMessages.apk \
  android-messages/bin/aligned.apk

# 9. Verify APK
echo "8. Verifying APK signature..."
apksigner verify --verbose public/SamsungMessages.apk

echo "=== Build Complete! public/SamsungMessages.apk is ready ==="
ls -lh public/SamsungMessages.apk
