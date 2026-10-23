const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = '/workspace/pdf-stage/site/assets';

async function drawLine(page, r, fx1, fy1, fx2, fy2, steps) {
  const x1 = r.x + r.w * fx1, y1 = r.y + r.h * fy1;
  const x2 = r.x + r.w * fx2, y2 = r.y + r.h * fy2;
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + Math.sin(t * Math.PI * 2) * 1.5);
  }
  await page.mouse.up();
}
async function drawLoop(page, r, fx, fy, rx, ry) {
  const cx = r.x + r.w * fx, cy = r.y + r.h * fy;
  await page.mouse.move(cx + rx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 56; i++) {
    const a = i / 56 * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  }
  await page.mouse.up();
}
async function sheetRect(page) {
  return page.evaluate(() => {
    const r = document.querySelector('#sheetA').getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/root/.cache/puppeteer/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=2']
  });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle0' });
  await (await page.$('#fileInput')).uploadFile('/workspace/pdf-stage/sample/性能测试-128页-横屏.pdf');
  await page.waitForFunction(() => document.querySelector('#pageAll').textContent === '128');
  await sleep(2600);
  await page.screenshot({ path: `${OUT}/shot-cover.jpg`, type: 'jpeg', quality: 92 });

  // 第 3 页：批注
  await page.click('#nextPage'); await page.click('#nextPage');
  await sleep(900);
  let r = await sheetRect(page);
  await page.click('[data-mode=pen]');
  await sleep(250);
  await drawLine(page, r, 0.14, 0.462, 0.52, 0.462, 46);
  await drawLoop(page, r, 0.727, 0.795, r.w * 0.028, r.h * 0.048);
  await sleep(500);
  await page.keyboard.press('Escape');
  await sleep(300);
  await page.screenshot({ path: `${OUT}/shot-annotate.jpg`, type: 'jpeg', quality: 92 });

  // 橡皮：图标 + 滑动条
  await page.click('#barMain .tbtn[data-mode=eraser]');
  await sleep(500);
  const ex = r.x + r.w * 0.30;
  const ey = r.y + r.h * 0.478;
  await page.mouse.move(ex, ey - 40);
  await page.mouse.down();
  for (let i = 0; i <= 8; i++) await page.mouse.move(ex + 6 * i, ey - 40 + 5 * i);
  await sleep(200);
  await page.screenshot({ path: `${OUT}/shot-eraser.jpg`, type: 'jpeg', quality: 92 });
  await page.mouse.up();
  await sleep(300);

  // 退出橡皮，避免滑动条出现在后续截图
  await page.click('[data-mode=move]');
  await sleep(500);

  // 双页对比
  await page.click('[data-act=compare]');
  await sleep(2400);
  await page.screenshot({ path: `${OUT}/shot-compare.jpg`, type: 'jpeg', quality: 92 });
  await page.click('[data-act=compare]');
  await sleep(2600);

  // 缩略图
  await page.click('[data-act=thumbs]');
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/shot-thumbs.jpg`, type: 'jpeg', quality: 92 });
  await page.click('[data-act=thumbs]');
  await sleep(400);

  // 竖屏平板（820×1180 @2x）
  await page.setViewport({ width: 820, height: 1180, deviceScaleFactor: 2 });
  await sleep(1200);
  await page.screenshot({ path: `${OUT}/shot-portrait.jpg`, type: 'jpeg', quality: 92 });

  await browser.close();
  console.log('DONE');
})().catch(e => { console.error(e); process.exit(1); });
