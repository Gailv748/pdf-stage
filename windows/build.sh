#!/usr/bin/env bash
# 构建 Windows 便携版（Win7 / 8 / 8.1 / 10 / 11 通用）
# Electron 22.3.27 是最后一个仍支持 Windows 7 / 8 / 8.1 的版本
set -e
cd "$(dirname "$0")"

APP_NAME="PDF展台"
ELECTRON_VER="22.3.27"

rm -rf app/web dist build
mkdir -p build
cp -r ../web app/web
cp ../assets/icon.png build/icon.png
cp ../assets/icon.ico app/icon.ico
cp ../assets/icon.png app/icon.png

PACK_ARGS="--platform=win32 --electron-version=$ELECTRON_VER --out=dist --overwrite --app-version=1.0.0 --executable-name=PDFStage --asar --prune=true --win32metadata.FileDescription=PDF展台 --win32metadata.ProductName=PDF展台"

for ARCH in x64 ia32; do
  npx --yes @electron/packager app "$APP_NAME" $PACK_ARGS --arch=$ARCH --icon=app/icon.ico || \
  npx --yes @electron/packager app "$APP_NAME" $PACK_ARGS --arch=$ARCH
  SUFFIX="x64"; [ "$ARCH" = "ia32" ] && SUFFIX="x86"
  mkdir -p dist
  (cd dist && mv "$APP_NAME-win32-$ARCH" "$APP_NAME-windows-$SUFFIX" && \
    zip -qr "$APP_NAME-windows-$SUFFIX-portable.zip" "$APP_NAME-windows-$SUFFIX")
done

echo "OK: dist/"
ls -lh dist/*.zip
