const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/root/.cache/puppeteer/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:8124/index.html', { waitUntil: 'networkidle0' });
  await sleep(700);
  const m = await page.evaluate(() => {
    const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    return { hero: r('.hero'), h1: r('.hero h1'), shot: r('.hero-shot'), frame: r('.frame'), img: r('.frame img'), body: { w: document.body.scrollWidth, h: document.body.scrollHeight } };
  });
  console.log(JSON.stringify(m, null, 1));
  await page.screenshot({ path: '/workspace/pdf-stage/tools/shots/site-hero.png' });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await sleep(500);
  await page.screenshot({ path: '/workspace/pdf-stage/tools/shots/site-hero-2x.png' });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
