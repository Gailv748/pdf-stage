const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/root/.cache/puppeteer/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:8124/index.html', { waitUntil: 'networkidle0' });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(1800);
  const v = await page.evaluate(() => {
    const v = document.querySelector('#promo video');
    return { ready: v.readyState, dur: v.duration, w: v.videoWidth, h: v.videoHeight, h_el: Math.round(v.getBoundingClientRect().height) };
  });
  console.log('VIDEO', JSON.stringify(v), 'ERRORS', JSON.stringify(errs));
  await page.evaluate(() => { const el = document.querySelector('#promo'); window.scrollTo(0, el.offsetTop - 60); });
  await sleep(900);
  await page.screenshot({ path: '/workspace/pdf-stage/tools/shots/site-promo.png' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(600);
  await page.screenshot({ path: '/workspace/pdf-stage/tools/shots/site-full2.png', fullPage: true });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
