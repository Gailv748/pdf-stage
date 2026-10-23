#!/usr/bin/env bash
# 构建 Windows 安装程序（NSIS）：x64 与 x86 各一个 .exe
# 依赖：makensis（apt install nsis）与已打包的应用目录 windows/dist/PDF展台-windows-*
set -e
cd "$(dirname "$0")"

VER="1.0.0"
INST="installer"

[ -x "$(command -v makensis)" ] || { echo "缺少 makensis，请先 apt install nsis"; exit 1; }

# 打包目录不存在就先跑便携版构建
if [ ! -d "dist/PDF展台-windows-x64" ] || [ ! -d "dist/PDF展台-windows-x86" ]; then
  echo "[0/3] 应用目录缺失，先执行 windows/build.sh"
  bash build.sh
fi

cp ../assets/icon.ico "$INST/icon.ico"
python3 "$INST/make-art.py"

# NSIS 需要 UTF-8 BOM 才能正确识别源码里的中文
SRC="$INST/installer.nsi"
UTF="$INST/.installer.utf8.nsi"
python3 - "$SRC" "$UTF" <<'PY'
import sys
data = open(sys.argv[1], 'rb').read()
if not data.startswith(b'\xef\xbb\xbf'):
    data = b'\xef\xbb\xbf' + data
open(sys.argv[2], 'wb').write(data)
PY

for ARCH in x64 x86; do
  if [ "$ARCH" = "x64" ]; then SRC_DIR="PDF展台-windows-x64"; else SRC_DIR="PDF展台-windows-x86"; fi
  echo "[1/3] 编译 $ARCH 安装包"
  makensis -V2 \
    -DARCH="$ARCH" \
    -DAPP_SRC="$(cd dist && pwd)/$SRC_DIR" \
    -DOUTFILE="$(pwd)/dist/PDFStage-Setup-$VER-$ARCH.exe" \
    "$UTF" 2>&1 | grep -E "Error|error|Warning|warning|Output:|Total size" || true
  [ -f "dist/PDFStage-Setup-$VER-$ARCH.exe" ] || { echo "错误：$ARCH 安装包未生成"; exit 1; }
done

rm -f "$UTF"
echo "OK:"
ls -lh dist/PDFStage-Setup-*.exe
