#!/usr/bin/env bash
# 构建 Linux 版（x64 便携包，附 .desktop 启动器与图标）
set -e
cd "$(dirname "$0")"

APP_NAME="PDF展台"
ELECTRON_VER="22.3.27"
PKG="pdf-stage-linux-x64"

rm -rf app dist build
mkdir -p app build
cp ../windows/app/main.js ../windows/app/preload.js ../windows/app/package.json app/
cp ../assets/icon.png app/icon.png
cp -r ../web app/web
cp ../assets/icon.png build/icon.png

npx --yes @electron/packager app "$APP_NAME" \
  --platform=linux --arch=x64 --electron-version=$ELECTRON_VER \
  --out=dist --overwrite --app-version=1.0.0 --asar --prune=true \
  --executable-name=PDFStage --icon=build/icon.png

mkdir -p "dist/$PKG"
mv "dist/$APP_NAME-linux-x64" "dist/$PKG/app"
cp ../assets/icon.png "dist/$PKG/icon.png"

cat > "dist/$PKG/PDF展台.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=PDF 展台
Comment=仿希沃视频展台界面的 PDF 阅读器
Exec=PDFStage %f
Icon=pdf-stage
Terminal=false
Categories=Office;Viewer;
MimeType=application/pdf;
EOF

cat > "dist/$PKG/安装到应用菜单.sh" <<'EOF'
#!/usr/bin/env bash
# 把本程序注册到当前用户的应用菜单
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.local/share/applications"
ICON="$HOME/.local/share/icons"
mkdir -p "$DEST" "$ICON"
cp "$HERE/icon.png" "$ICON/pdf-stage.png"
sed "s|Exec=PDFStage|Exec=$HERE/app/PDFStage|" "$HERE/PDF展台.desktop" > "$DEST/pdf-stage.desktop"
update-desktop-database "$DEST" 2>/dev/null || true
echo "已安装：$DEST/pdf-stage.desktop"
EOF
chmod +x "dist/$PKG/安装到应用菜单.sh" "dist/$PKG/app/PDFStage"

cat > "dist/$PKG/启动.sh" <<'EOF'
#!/usr/bin/env bash
# 便携启动脚本：不依赖应用菜单
HERE="$(cd "$(dirname "$0")" && pwd)"
exec "$HERE/app/PDFStage" "$@"
EOF
chmod +x "dist/$PKG/启动.sh"

(cd dist && tar czf "PDF展台-linux-x64-portable.tar.gz" "$PKG")

echo "OK: dist/"
ls -lh dist/*.tar.gz
