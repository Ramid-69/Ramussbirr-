#!/bin/bash
set -e

echo "=== Building CBEBirr Plus APK ==="
rm -rf android/gen android/bin
mkdir -p android/gen android/bin/classes

# 1. Generate R.java
echo "1. Generating R.java..."
aapt package -f -m \
  -J android/gen \
  -M android/app/src/main/AndroidManifest.xml \
  -S android/app/src/main/res \
  -I /usr/lib/android-sdk/platforms/android-23/android.jar

# 2. Compile Java sources
echo "2. Compiling Java sources with javac..."
javac -source 8 -target 8 \
  -cp /usr/lib/android-sdk/platforms/android-23/android.jar \
  -d android/bin/classes \
  android/app/src/main/java/com/cbe/cbebirrtransfer/*.java \
  android/gen/com/cbe/cbebirrtransfer/*.java

# 3. Convert to Dalvik DEX
echo "3. Converting to DEX with dalvik-exchange..."
/usr/bin/dalvik-exchange --dex \
  --output=android/bin/classes.dex \
  android/bin/classes

# 4. Package resources and Manifest into APK base
echo "4. Packaging APK base with aapt..."
aapt package -f \
  -M android/app/src/main/AndroidManifest.xml \
  -S android/app/src/main/res \
  -I /usr/lib/android-sdk/platforms/android-23/android.jar \
  -F android/bin/unsigned.apk

# 5. Add classes.dex to APK
echo "5. Adding classes.dex..."
cd android/bin
aapt add unsigned.apk classes.dex
cd ../..

# 6. Zipalign APK
echo "6. Running zipalign..."
zipalign -f -p 4 android/bin/unsigned.apk android/bin/aligned.apk

# 7. Sign APK with apksigner (v1 & v2 signatures) using release keystore
echo "7. Signing APK..."
apksigner sign \
  --ks android-messages/keystore.jks \
  --ks-pass pass:android \
  --key-pass pass:android \
  --out public/cbebirr-plus.apk \
  android/bin/aligned.apk

# 8. Verify APK
echo "8. Verifying APK signature..."
apksigner verify --verbose public/cbebirr-plus.apk

echo "=== Build Complete! public/cbebirr-plus.apk is ready ==="
ls -lh public/cbebirr-plus.apk
