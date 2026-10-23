#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 512px PNG 转成 macOS .icns（纯 Python，无需 macOS 工具）"""
import struct
import sys
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else '/workspace/pdf-stage/assets/icon.png'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/workspace/pdf-stage/mac/build/icon.icns'

# icns 类型 -> 边长
SIZES = [
    (b'icp4', 16), (b'icp5', 32), (b'icp6', 64),
    (b'ic07', 128), (b'ic08', 256), (b'ic09', 512), (b'ic10', 1024),
]

im = Image.open(SRC).convert('RGBA')
chunks = b''
for kind, size in SIZES:
    frame = im.resize((size, size), Image.LANCZOS)
    tmp = '/tmp/icns-%d.png' % size
    frame.save(tmp, 'PNG')
    data = open(tmp, 'rb').read()
    chunks += kind + struct.pack('>I', len(data) + 8) + data

body = b'icns' + struct.pack('>I', len(chunks) + 8) + chunks
open(OUT, 'wb').write(body)
print('ICNS', OUT, len(body), 'bytes')
