const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/root/.cache/puppeteer/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto('http://127.0.0.1:8124/promo.html?record=1', { waitUntil: 'networkidle0' });
  await page.evaluate(async () => { await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
  for (const t of [0, 9.38, 9.5, 9.62, 9.8, 14.42, 14.5, 14.62, 27.7, 27.8, 27.95]) {
    await page.evaluate(t => window.__seek(t), t);
    await sleep(160);
    await page.screenshot({ path: `/workspace/pdf-stage/tools/shots/e-${t}.png` });
  }
  await browser.close();
  console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });
