#!/usr/bin/env bash
# 构建 Android APK（arm64-v8a 平板 / x86 平板 通用，纯 Java + WebView，无原生库）
# 依赖：Android SDK (build-tools + platform) 与 JDK
set -e
cd "$(dirname "$0")"

# d8 在 JDK 21+ 下会抛 NPE，优先使用 JDK 17 / 11
major=""
[ -n "$JAVA_HOME" ] && major="$("$JAVA_HOME/bin/java" -version 2>&1 | sed -n 's/.*version "\([0-9]*\).*/\1/p' | head -1)"
if [ -z "$JAVA_HOME" ] || [ "${major:-99}" -ge 21 ]; then
  for v in 17 11; do
    p="$HOME/.local/share/mise/installs/java/$v"
    if [ -x "$p/bin/javac" ]; then
      export JAVA_HOME="$p"
      export PATH="$JAVA_HOME/bin:$PATH"
      break
    fi
  done
fi

SDK="${ANDROID_SDK:-$HOME/android-sdk}"
BT="$(ls -d "$SDK"/build-tools/* 2>/dev/null | sort -V | tail -1)"
PLATFORM="$(ls -d "$SDK"/platforms/android-* 2>/dev/null | sort -V | tail -1)/android.jar"
[ -x "$BT/aapt2" ] || { echo "缺少 build-tools，请先运行 tools/install-sdk.sh"; exit 1; }
[ -f "$PLATFORM" ] || { echo "缺少 android.jar"; exit 1; }

VERSION="${1:-1.0}"
OUT="dist/PDF展台-android-universal-arm64-x86-v$VERSION.apk"

rm -rf build dist assets/web
mkdir -p build/gen build/classes build/dex dist assets
cp -r ../web assets/web

echo "[1/6] aapt2 compile + link"
"$BT/aapt2" compile --dir res -o build/res.zip
"$BT/aapt2" link -o build/base.apk \
  --manifest AndroidManifest.xml \
  -I "$PLATFORM" \
  -A assets \
  --java build/gen \
  --min-sdk-version 21 --target-sdk-version 34 \
  --version-code 1 --version-name "$VERSION" \
  build/res.zip

echo "[2/6] javac"
javac -encoding UTF-8 -source 8 -target 8 -nowarn \
  -bootclasspath "$PLATFORM" -classpath "$PLATFORM" \
  -d build/classes \
  $(find src build/gen -name '*.java')

echo "[3/6] d8"
"$BT/d8" --lib "$PLATFORM" --min-api 21 --release \
  --output build/dex $(find build/classes -name '*.class')

echo "[4/6] 打包 dex"
cp build/base.apk build/unsigned.apk
(cd build && zip -q -j unsigned.apk dex/classes.dex)

echo "[5/6] zipalign"
"$BT/zipalign" -f -p 4 build/unsigned.apk build/aligned.apk

echo "[6/6] 签名"
if [ ! -f debug.keystore ]; then
  keytool -genkeypair -keystore debug.keystore -storepass android -keypass android \
    -alias androiddebugkey -dname "CN=PDF Stage, OU=App, O=PDFStage, L=CN, S=CN, C=CN" \
    -keyalg RSA -keysize 2048 -validity 10950
fi
"$BT/apksigner" sign --ks debug.keystore --ks-pass pass:android --key-pass pass:android \
  --v1-signing-enabled true --v2-signing-enabled true \
  --out "$OUT" build/aligned.apk

echo "[校验] 签名与压缩包完整性"
"$BT/apksigner" verify "$OUT" || { echo "错误：签名校验失败"; exit 1; }
python3 - "$OUT" <<'PY' || { echo "错误：APK 压缩包损坏"; exit 1; }
import sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
assert z.testzip() is None
print('zip entries', len(z.infolist()), 'ok')
PY

echo "OK: $OUT"
cp "$OUT" "dist/PDFStage-Android-universal-v$VERSION.apk"
ls -lh "$OUT" "dist/PDFStage-Android-universal-v$VERSION.apk"
sha256sum "$OUT"
