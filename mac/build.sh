#!/usr/bin/env bash
# 构建 macOS 版：Intel(x64) + Apple Silicon(arm64)，输出 .app 压缩包
set -e
cd "$(dirname "$0")"

APP_NAME="PDF展台"
ELECTRON_VER="22.3.27"

rm -rf app dist build
mkdir -p app build
cp ../windows/app/main.js ../windows/app/preload.js ../windows/app/package.json app/
cp ../assets/icon.png app/icon.png
cp -r ../web app/web
python3 ../tools/make-icns.py ../assets/icon.png build/icon.icns

PACK_ARGS="--platform=darwin --electron-version=$ELECTRON_VER --out=dist --overwrite --app-version=1.0.0 --asar --prune=true --icon=build/icon.icns"

for ARCH in x64 arm64; do
  npx --yes @electron/packager app "$APP_NAME" $PACK_ARGS --arch=$ARCH
  SUFFIX="intel"; [ "$ARCH" = "arm64" ] && SUFFIX="apple-silicon"
  (cd dist && mv "$APP_NAME-darwin-$ARCH" "$APP_NAME-macos-$SUFFIX" && \
    # packager 在 Linux 上不会自动写入图标，这里补一份
    cp ../build/icon.icns "$APP_NAME-macos-$SUFFIX/$APP_NAME.app/Contents/Resources/icon.icns" && \
    sed -i 's|<string>electron.icns</string>|<string>icon.icns</string>|' \
      "$APP_NAME-macos-$SUFFIX/$APP_NAME.app/Contents/Info.plist" && \
    zip -qry "$APP_NAME-macos-$SUFFIX.zip" "$APP_NAME-macos-$SUFFIX")
done

echo "OK: dist/"
ls -lh dist/*.zip
