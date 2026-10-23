# -*- coding: utf-8 -*-
"""生成一份用于演示/测试的中文 PDF。"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# 使用嵌入式中文字体，保证 pdf.js 直接渲染（不依赖 CMap / 系统字体）
CN_FONT = '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc'
pdfmetrics.registerFont(TTFont('CN', CN_FONT, subfontIndex=0))
FONT = 'CN'

W, H = A4
OUT = '/workspace/pdf-stage/sample/演示课件.pdf'

c = canvas.Canvas(OUT, pagesize=A4)
c.setTitle('PDF 展台演示课件')

CHAPTERS = [
    ('第一章  视频展台与文档阅读', [
        '在课堂教学中，教师经常需要把纸质资料、课件与练习题展示给学生。',
        'PDF 展台把「展台」的操作习惯带进数字文档：移动、批注、橡皮、撤销，',
        '以及一键双页对比、画面调节与导出，都可以在同一个工具条内完成。',
        '',
        '本章要点：',
        '1. 工具条分区与常用操作路径；',
        '2. 批注笔的颜色与粗细选择；',
        '3. 批注的本地保存与导出。',
    ]),
    ('第二章  批注与手写', [
        '点击「批注」进入手写模式，页面上任意位置都可以书写。',
        '笔迹按页面坐标保存，缩放、适应宽度之后依然保持原来的位置。',
        '「橡皮」按笔画擦除，「撤销」可以回退最近一次操作。',
        '',
        '建议：板书演示时使用较粗的笔迹，讲解细节时改用细笔。',
    ]),
    ('第三章  对比教学', [
        '点击右侧「对比教学」，画面自动左右分栏，显示相邻两页。',
        '左右两页可以分别批注，翻页时保持同步，适合例题与解答对照。',
        '',
        '对比模式同样是逐页渲染，放大后依然清晰。',
    ]),
    ('第四章  画面调节与护眼', [
        '「画面调节」提供亮度、对比度与饱和度三个滑杆。',
        '「护眼」按钮为页面叠加暖色滤镜，长时间阅读更舒适。',
        '所有调节只影响显示，不会改变导出文件的内容。',
    ]),
    ('第五章  截图与导出', [
        '「截图」把当前页面（含批注）保存为 PNG 图片。',
        '「导出」把整份文档按页渲染，并把批注烧录进新的 PDF。',
        '导出的文件可以直接分发给学生，对方无需安装本软件。',
    ]),
    ('第六章  快捷键', [
        'Ctrl+O  打开文件        Ctrl+S  保存批注',
        '← / →    上一页 / 下一页    + / -   放大 / 缩小',
        'V 移动    P 批注    E 橡皮    B 书签    F 展开',
        'Ctrl+Z  撤销            Esc  退出展开',
    ]),
]


def cover():
    c.setFillColorRGB(0.12, 0.12, 0.13)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont(FONT, 34)
    c.drawString(28 * mm, H - 62 * mm, 'PDF 展台')
    c.setFont(FONT, 17)
    c.setFillColorRGB(0.78, 0.78, 0.8)
    c.drawString(28 * mm, H - 76 * mm, '仿希沃视频展台界面的 PDF 阅读器')
    c.setStrokeColorRGB(0.18, 0.6, 1)
    c.setLineWidth(3)
    c.line(28 * mm, H - 86 * mm, 88 * mm, H - 86 * mm)
    c.setFont(FONT, 11)
    c.setFillColorRGB(0.6, 0.6, 0.62)
    c.drawString(28 * mm, 28 * mm, '演示课件 · 共 7 页 · 可直接用于批注测试')
    c.showPage()


def body(title, lines, idx):
    c.setFillColorRGB(1, 1, 1)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColorRGB(0.1, 0.1, 0.12)
    c.setFont(FONT, 20)
    c.drawString(24 * mm, H - 30 * mm, title)
    c.setStrokeColorRGB(0.18, 0.6, 1)
    c.setLineWidth(2)
    c.line(24 * mm, H - 35 * mm, 50 * mm, H - 35 * mm)

    y = H - 50 * mm
    c.setFont(FONT, 12.5)
    c.setFillColorRGB(0.22, 0.22, 0.24)
    for line in lines:
        c.drawString(24 * mm, y, line)
        y -= 9 * mm

    # 简易图示区
    c.setFillColorRGB(0.95, 0.96, 0.98)
    c.setStrokeColorRGB(0.85, 0.87, 0.9)
    c.roundRect(24 * mm, 40 * mm, W - 48 * mm, 80 * mm, 4 * mm, fill=1, stroke=1)
    c.setFillColorRGB(0.55, 0.58, 0.62)
    c.setFont(FONT, 10)
    c.drawCentredString(W / 2, 84 * mm, '图示区域（可用于测试批注与截图）')
    for i in range(4):
        c.setFillColorRGB(0.8, 0.84, 0.9)
        c.rect(34 * mm + i * 33 * mm, 52 * mm, 22 * mm, 22 * mm, fill=1, stroke=0)

    c.setFillColorRGB(0.55, 0.55, 0.58)
    c.setFont(FONT, 9)
    c.drawRightString(W - 24 * mm, 20 * mm, 'PDF 展台 · 第 %d 页' % idx)
    c.showPage()


cover()
for i, (t, ls) in enumerate(CHAPTERS, start=2):
    body(t, ls, i)

c.save()
print(OUT)
