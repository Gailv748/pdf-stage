const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({
    executablePath: '/root/.cache/puppeteer/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1200, height: 800 });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle0' });
  await (await p.$('#fileInput')).uploadFile('/workspace/pdf-stage/sample/演示课件.pdf');
  await new Promise(r => setTimeout(r, 1500));
  await p.click('[data-mode=pen]');
  await new Promise(r => setTimeout(r, 400));
  console.log(await p.evaluate(() => {
    const pop = document.querySelector('#pop');
    const r = pop.getBoundingClientRect();
    return { hidden: pop.hidden, attr: pop.getAttribute('hidden'), rect: { x: r.x, y: r.y, w: r.width, h: r.height }, html: pop.innerHTML.slice(0, 120) };
  }));
  await p.screenshot({ path: '/workspace/pdf-stage/tools/shots/debug-pop.png' });
  await b.close();
})();
