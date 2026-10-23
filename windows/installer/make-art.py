#!/usr/bin/env python3
"""生成 NSIS 安装向导的品牌位图（侧栏 164x314、页眉 150x57）。"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ICON = os.path.join(ROOT, 'assets', 'icon.png')
FONT_B = '/usr/share/fonts/opentype/noto-cjk-otf/NotoSansCJKsc-Bold.otf'
FONT_R = '/usr/share/fonts/opentype/noto-cjk-otf/NotoSansCJKsc-Regular.otf'

BG_TOP = (16, 19, 26)
BG_BOT = (26, 34, 48)
BLUE = (47, 155, 255)
DIM = (140, 156, 172)
TXT = (238, 241, 245)


def font(path, size):
    return ImageFont.truetype(path, size)


def vertical_gradient(w, h, top, bot):
    img = Image.new('RGB', (1, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        d.point((0, y), tuple(round(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    return img.resize((w, h), Image.BILINEAR)


def glow(size, center, radius, color, alpha):
    w, h = size
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = center
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=color + (alpha,))
    return layer.filter(ImageFilter.GaussianBlur(radius * 0.55))


def sidebar(scale=4):
    w, h = 164, 314
    S = scale
    img = vertical_gradient(w * S, h * S, BG_TOP, BG_BOT).convert('RGBA')
    img.alpha_composite(glow((w * S, h * S), (0.03 * w * S, -0.02 * h * S), 0.5 * w * S, BLUE, 70))
    img.alpha_composite(glow((w * S, h * S), (0.85 * w * S, 0.95 * h * S), 0.42 * w * S, (229, 72, 77), 26))

    d = ImageDraw.Draw(img)
    # 顶部细蓝线
    d.rectangle([0, 0, w * S, 2 * S], fill=BLUE)

    icon = Image.open(ICON).convert('RGBA').resize((54 * S, 54 * S), Image.LANCZOS)
    img.alpha_composite(icon, (18 * S, 26 * S))

    d.text((18 * S, 92 * S), 'PDF 展台', font=font(FONT_B, 21 * S), fill=TXT)
    d.text((18 * S, 122 * S), 'PDF Stage · 桌面版', font=font(FONT_R, 9 * S), fill=(122, 140, 158))

    # 分隔线
    d.rectangle([18 * S, 146 * S, 18 * S + 62 * S, 146 * S + 2 * S], fill=BLUE)

    feats = ['批注可画到页面外', '橡皮跟手分段擦除', '双页对比 · 128 页秒开']
    y = 172
    for item in feats:
        d.ellipse([19 * S, (y + 4) * S, 23 * S, (y + 8) * S], fill=(64, 166, 255))
        d.text((29 * S, y * S), item, font=font(FONT_R, 9 * S), fill=(196, 208, 220))
        y += 21

    # 底部信息
    d.rectangle([0, 268 * S, w * S, 268 * S + 1 * S], fill=(42, 51, 64))
    d.text((18 * S, 278 * S), 'Windows 7 / 8 / 10 / 11', font=font(FONT_R, 7.5 * S), fill=(112, 126, 140))
    d.text((18 * S, 292 * S), '本地处理 · 不上传文件', font=font(FONT_R, 7.5 * S), fill=(88, 101, 115))

    return img.resize((w, h), Image.LANCZOS).convert('RGB')


def header(scale=6):
    w, h = 150, 57
    S = scale
    img = vertical_gradient(w * S, h * S, (18, 21, 27), (28, 35, 47)).convert('RGBA')
    img.alpha_composite(glow((w * S, h * S), (0.1 * w * S, 0.05 * h * S), 0.55 * w * S, BLUE, 58))
    d = ImageDraw.Draw(img)
    d.rectangle([0, h * S - 2 * S, w * S, h * S], fill=BLUE)
    icon = Image.open(ICON).convert('RGBA').resize((26 * S, 26 * S), Image.LANCZOS)
    img.alpha_composite(icon, (10 * S, 14 * S))
    d.text((42 * S, 14 * S), 'PDF 展台', font=font(FONT_B, 12 * S), fill=TXT)
    d.text((42 * S, 33 * S), '安装程序', font=font(FONT_R, 7.5 * S), fill=(126, 141, 158))
    return img.resize((w, h), Image.LANCZOS).convert('RGB')


if __name__ == '__main__':
    sb = sidebar()
    sb.save(os.path.join(HERE, 'sidebar.bmp'), 'BMP')
    hr = header()
    hr.save(os.path.join(HERE, 'header.bmp'), 'BMP')
    print('wrote sidebar.bmp %sx%s, header.bmp %sx%s' % (sb.width, sb.height, hr.width, hr.height))
