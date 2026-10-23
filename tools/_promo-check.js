const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/root/.cache/puppeteer/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('http://127.0.0.1:8124/promo.html?record=1', { waitUntil: 'networkidle0' });
  await page.evaluate(async () => { await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
  for (const t of [2.5, 7, 9.4, 9.6, 12, 17, 22, 26, 30.8]) {
    await page.evaluate(t => window.__seek(t), t);
    await sleep(220);
    await page.screenshot({ path: `/workspace/pdf-stage/tools/shots/pc-${t}.png` });
  }
  console.log('ERRORS', JSON.stringify(errs));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
