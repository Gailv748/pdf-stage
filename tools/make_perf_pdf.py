# -*- coding: utf-8 -*-
"""生成 128 页 16:9 横屏性能测试 PDF（中文字体嵌入）。"""
import math
from reportlab.lib.pagesizes import landscape
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

CN_FONT = '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc'
pdfmetrics.registerFont(TTFont('CN', CN_FONT, subfontIndex=0))
FONT = 'CN'

W, H = 960, 540
OUT = '/workspace/pdf-stage/sample/性能测试-128页-横屏.pdf'
TOTAL = 128

c = canvas.Canvas(OUT, pagesize=(W, H))
c.setTitle('PDF 展台 · 128 页横屏性能测试')

ACCENTS = ['#2f9bff', '#16a085', '#e67e22', '#8e44ad', '#c0392b']


def cover():
    c.setFillColorRGB(0.10, 0.11, 0.13)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont(FONT, 40)
    c.drawString(56, H - 118, 'PDF 展台 · 性能测试')
    c.setFont(FONT, 20)
    c.setFillColorRGB(0.72, 0.76, 0.82)
    c.drawString(56, H - 150, '128 页 · 16:9 横屏 · 用于翻页 / 批注 / 缩略图 / 导出性能测试')
    c.setStrokeColorRGB(0.18, 0.6, 1)
    c.setLineWidth(4)
    c.line(56, H - 176, 200, H - 176)
    c.setFillColorRGB(0.52, 0.56, 0.62)
    c.setFont(FONT, 13)
    c.drawString(56, 54, '建议测试：连续快速翻页、缩略图抽屉、双页对比、批注与导出')
    c.showPage()


def content(idx):
    c.setFillColorRGB(1, 1, 1)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    accent = ACCENTS[idx % len(ACCENTS)]

    # 顶部色带
    c.setFillColorRGB(0.13, 0.14, 0.16)
    c.rect(0, H - 64, W, 64, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont(FONT, 22)
    c.drawString(44, H - 42, '第 %d 页 · 性能测试章节 %d' % (idx, (idx - 2) // 12 + 1))
    c.setFont(FONT, 12)
    c.setFillColorRGB(0.62, 0.66, 0.72)
    c.drawRightString(W - 44, H - 41, 'PDF 展台 · 128 页横屏文档')

    # 左侧正文
    c.setFillColorRGB(0.14, 0.15, 0.18)
    c.setFont(FONT, 16)
    c.drawString(44, H - 102, '课堂演示要点')
    c.setFont(FONT, 11.5)
    c.setFillColorRGB(0.30, 0.32, 0.36)
    lines = [
        '这是一份用于检验阅读器性能的横屏文档，页面比例 16:9。',
        '连续翻页时，渲染应当保持顺畅，页码与缩略图同步更新。',
        '可以在页面空白处书写批注，笔迹按页面坐标保存。',
        '放大、适应宽度与双页对比时，笔迹位置应保持一致。',
        '本页包含矢量图形与文字，用于模拟真实课件的绘制负载。',
    ]
    y = H - 130
    for t in lines:
        c.drawString(44, y, t)
        y -= 22

    # 右侧柱状图
    x0, base, bw = 560, 150, 44
    c.setFillColorRGB(0.97, 0.98, 1)
    c.setStrokeColorRGB(0.88, 0.90, 0.94)
    c.roundRect(536, 96, 380, 300, 8, fill=1, stroke=1)
    c.setFillColorRGB(0.45, 0.48, 0.54)
    c.setFont(FONT, 10)
    c.drawCentredString(726, 368, '模拟数据')
    for i in range(7):
        h = 40 + 150 * abs(math.sin(idx * 0.7 + i * 0.9))
        c.setFillColorRGB(0.18 + i * 0.02, 0.55 - i * 0.015, 0.95 - i * 0.05)
        c.rect(x0 + i * 50, base, bw, h, fill=1, stroke=0)
        c.setFillColorRGB(0.55, 0.58, 0.63)
        c.setFont(FONT, 8)
        c.drawCentredString(x0 + i * 50 + bw / 2, base - 14, 'P%d' % (i + 1))
    c.setStrokeColorRGB(0.85, 0.87, 0.9)
    c.line(x0 - 8, base, x0 + 7 * 50 - 6, base)

    # 左侧进度条
    c.setFillColorRGB(0.93, 0.95, 0.98)
    c.roundRect(44, 96, 460, 74, 6, fill=1, stroke=0)
    c.setFillColorRGB(0.16, 0.17, 0.20)
    c.setFont(FONT, 11)
    c.drawString(62, 146, '文档进度')
    pct = idx / TOTAL
    c.setFillColorRGB(0.88, 0.90, 0.94)
    c.roundRect(62, 118, 420, 10, 5, fill=1, stroke=0)
    c.setFillColorRGB(0.18, 0.6, 1)
    c.roundRect(62, 118, max(6, 420 * pct), 10, 5, fill=1, stroke=0)
    c.setFillColorRGB(0.45, 0.48, 0.53)
    c.setFont(FONT, 9)
    c.drawRightString(482, 99, '%d / %d' % (idx, TOTAL))

    # 页脚
    c.setFillColorRGB(0.55, 0.57, 0.61)
    c.setFont(FONT, 9)
    c.drawString(44, 40, 'PDF 展台 · 性能测试文档 · 16:9')
    c.drawRightString(W - 44, 40, '%d / %d' % (idx, TOTAL))
    c.setStrokeColorRGB(0.9, 0.91, 0.93)
    c.setLineWidth(0.6)
    c.line(44, 66, W - 44, 66)
    c.showPage()


cover()
for i in range(2, TOTAL + 1):
    content(i)

c.save()
print(OUT, TOTAL)
