/* 重新拍摄“页面之外也能写”的批注截图：先缩小，让纸张四周留出灰底，再把笔画画出纸张边界 */
const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = '/workspace/pdf-stage/site/assets';

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
  await sleep(2200);
  await page.click('#nextPage'); await page.click('#nextPage');
  await sleep(900);

  // 缩小到约 70%，让纸张四周露出灰色空白
  for (let i = 0; i < 2; i++) { await page.click('#zoomOut'); await sleep(260); }
  await sleep(700);
  const r = await page.evaluate(() => {
    const b = document.querySelector('#sheetA').getBoundingClientRect();
    const p = document.querySelector('#paneA').getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height, px: p.x, py: p.y, pw: p.width, ph: p.height,
             zoom: (document.querySelector('#pageNow') || {}).textContent };
  });
  console.log('SHEET', JSON.stringify(r));

  await page.click('#barMain .tbtn[data-mode=pen]');
  await sleep(300);

  // 1) 从纸张左外侧起笔，横穿页面左侧
  await page.mouse.move(r.x - 150, r.y + r.h * 0.30);
  await page.mouse.down();
  for (let i = 1; i <= 60; i++) {
    const t = i / 60;
    await page.mouse.move(r.x - 150 + 470 * t, r.y + r.h * 0.30 + Math.sin(t * 6) * 4);
  }
  await page.mouse.up();
  await sleep(160);

  // 2) 页面右下外侧画圈
  const cx = r.x + r.w - 40, cy = r.y + r.h + 62;
  await page.mouse.move(cx + 58, cy);
  await page.mouse.down();
  for (let i = 1; i <= 54; i++) {
    const a = i / 54 * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(a) * 58, cy + Math.sin(a) * 34);
  }
  await page.mouse.up();
  await sleep(160);

  // 3) 页面右上外侧写一笔箭头状折线
  await page.mouse.move(r.x + r.w + 26, r.y + 36);
  await page.mouse.down();
  for (let i = 1; i <= 40; i++) {
    const t = i / 40;
    await page.mouse.move(r.x + r.w + 26 + 120 * t, r.y + 36 + 90 * t);
  }
  await page.mouse.up();
  await sleep(400);

  await page.keyboard.press('Escape');
  await sleep(350);
  await page.screenshot({ path: `${OUT}/shot-annotate.jpg`, type: 'jpeg', quality: 92 });
  await browser.close();
  console.log('DONE');
})().catch(e => { console.error(e); process.exit(1); });
