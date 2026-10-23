/* 逐帧渲染 promo.html 并截图，用于合成 4K60 宣传片
 * 用法：node tools/frames.js [outDir] [fps]
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || '/tmp/promo-frames';
const FPS = parseInt(process.argv[3] || '60', 10);
const URL = process.env.PROMO_URL || 'http://127.0.0.1:8124/promo.html?record=1';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: '/root/.cache/puppeteer/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb', '--hide-scrollbars', '--font-render-hinting=none']
  });
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('PAGEERROR', e.message));
  await page.setViewport({ width: 3840, height: 2160, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(async () => {
    await Promise.all([].slice.call(document.images).map(i => i.decode().catch(() => {})));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  });
  const dur = await page.evaluate(() => window.__duration);
  const total = Math.round(dur * FPS);
  const from = parseInt(process.argv[4] || '0', 10);
  const to = Math.min(total, parseInt(process.argv[5] || String(total), 10));
  console.log('duration', dur, 'fps', FPS, 'frames', total, 'range', from + '..' + (to - 1), '->', OUT);

  const t0 = Date.now();
  for (let i = from; i < to; i++) {
    const t = i / FPS;
    await page.evaluate(t => window.__seek(t), t);
    const file = path.join(OUT, 'f' + String(i).padStart(5, '0') + '.jpg');
    await page.screenshot({ path: file, type: 'jpeg', quality: 92, optimizeForSpeed: true, captureBeyondViewport: false });
    if (i % 60 === 0 || i === total - 1) {
      const el = (Date.now() - t0) / 1000;
      console.log('frame', i + '/' + total, 't=' + t.toFixed(2), 'elapsed', el.toFixed(1) + 's',
        'eta', (el / (i + 1) * (total - i - 1)).toFixed(0) + 's');
    }
  }
  await browser.close();
  console.log('DONE', total, 'frames in', ((Date.now() - t0) / 1000).toFixed(1) + 's');
})().catch(e => { console.error(e); process.exit(1); });
