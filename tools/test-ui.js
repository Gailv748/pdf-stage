/* UI 冒烟测试 + 截图 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const OUT = '/workspace/pdf-stage/tools/shots';
const PDF = '/workspace/pdf-stage/sample/演示课件.pdf';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: '/root/.cache/puppeteer/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 820, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(OUT, '01-empty.png') });

  // 打开示例 PDF
  const input = await page.$('#fileInput');
  await input.uploadFile(PDF);
  await page.waitForFunction(() => window.PDFSTAGE_READY === undefined ? true : true);
  await new Promise(r => setTimeout(r, 1800));
  await page.screenshot({ path: path.join(OUT, '02-open.png') });

  const info = await page.evaluate(() => ({
    page: document.querySelector('#pageNow').textContent,
    all: document.querySelector('#pageAll').textContent,
    zoom: document.querySelector('#zoomTxt').textContent,
    sheet: document.querySelector('#sheetA').getBoundingClientRect()
  }));
  console.log('OPEN', JSON.stringify(info));

  // 批注：进入画笔并手写
  await page.click('[data-mode=pen]');
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(OUT, '03-pen-pop.png') });

  const box = await page.evaluate(() => {
    const r = document.querySelector('#sheetA').getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.mouse.move(box.x + box.w * 0.2, box.y + box.h * 0.72);
  await page.mouse.down();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    await page.mouse.move(
      box.x + box.w * (0.2 + 0.55 * t),
      box.y + box.h * (0.72 - 0.10 * Math.sin(t * Math.PI * 2))
    );
  }
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(OUT, '04-anno.png') });

  const strokeCount = await page.evaluate(() => document.querySelectorAll('#inkA path').length);
  console.log('STROKES', strokeCount);

  // 撤销
  await page.click('[data-act=undo]');
  await new Promise(r => setTimeout(r, 300));
  console.log('AFTER UNDO', await page.evaluate(() => document.querySelectorAll('#inkA path').length));

  // 对比教学
  await page.click('[data-act=compare]');
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT, '05-compare.png') });
  console.log('COMPARE panes', await page.evaluate(() => !document.querySelector('#paneB').hidden));

  await page.click('[data-act=compare]');
  await new Promise(r => setTimeout(r, 600));

  // 缩略图
  await page.click('[data-act=thumbs]');
  await new Promise(r => setTimeout(r, 1600));
  await page.screenshot({ path: path.join(OUT, '06-thumbs.png') });
  await page.click('#drawerClose');

  // 画面调节
  await page.click('[data-act=adjust]');
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(OUT, '07-adjust.png') });
  await page.keyboard.press('Escape');

  // 设置
  await page.click('[data-act=settings]');
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(OUT, '08-settings.png') });
  await page.keyboard.press('Escape');

  // 菜单
  await page.click('[data-act=menu]');
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(OUT, '09-menu.png') });
  await page.keyboard.press('Escape');

  // 翻页 + 放大
  await page.keyboard.press('ArrowRight');
  await new Promise(r => setTimeout(r, 900));
  await page.click('#zoomIn');
  await new Promise(r => setTimeout(r, 900));
  await page.screenshot({ path: path.join(OUT, '10-page2-zoom.png') });
  console.log('PAGE', await page.evaluate(() => document.querySelector('#pageNow').textContent + '/' + document.querySelector('#zoomTxt').textContent));

  // 展开（沉浸）
  await page.click('[data-act=immerse]');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT, '11-immersed.png') });
  await page.keyboard.press('Escape');

  // 小屏 1024x600
  await page.setViewport({ width: 1024, height: 600, deviceScaleFactor: 1 });
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => document.querySelector('#zoomIn') && null);
  await page.screenshot({ path: path.join(OUT, '12-1024.png') });

  console.log('ERRORS', JSON.stringify(errors.slice(0, 10)));
  await browser.close();
})();
