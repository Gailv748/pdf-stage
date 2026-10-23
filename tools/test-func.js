const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const PDF = '/workspace/pdf-stage/sample/演示课件.pdf';
const DL = '/workspace/pdf-stage/tools/dl';

(async () => {
  fs.rmSync(DL, { recursive: true, force: true });
  fs.mkdirSync(DL, { recursive: true });
  const b = await puppeteer.launch({
    executablePath: '/root/.cache/puppeteer/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 780 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const client = await p.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });

  await p.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle0' });
  await (await p.$('#fileInput')).uploadFile(PDF);
  await new Promise(r => setTimeout(r, 1500));
  const box = await p.evaluate(() => {
    const r = document.querySelector('#sheetA').getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const draw = async (x0, y0, dx, dy) => {
    await p.mouse.move(box.x + x0, box.y + y0);
    await p.mouse.down();
    for (let i = 0; i <= 20; i++) await p.mouse.move(box.x + x0 + dx * i / 20, box.y + y0 + dy * i / 20);
    await p.mouse.up();
    await new Promise(r => setTimeout(r, 150));
  };
  await p.click('[data-mode=pen]');
  await draw(box.w * 0.2, box.h * 0.6, 120, 40);
  await p.keyboard.press('Escape');
  await p.click('[data-mode=pen]');
  await draw(box.w * 0.3, box.h * 0.75, 100, -30);
  await p.keyboard.press('Escape');
  console.log('strokes', await p.evaluate(() => document.querySelectorAll('#inkA path').length));

  // 橡皮
  await p.click('[data-mode=eraser]');
  await p.mouse.click(box.x + box.w * 0.25, box.y + box.h * 0.62);
  await new Promise(r => setTimeout(r, 300));
  console.log('after eraser', await p.evaluate(() => document.querySelectorAll('#inkA path').length));

  // 撤销
  await p.click('[data-act=undo]');
  await new Promise(r => setTimeout(r, 300));
  console.log('after undo', await p.evaluate(() => document.querySelectorAll('#inkA path').length));

  // 书签
  await p.keyboard.press('ArrowRight');
  await new Promise(r => setTimeout(r, 700));
  await p.click('[data-act=bookmark]');
  await new Promise(r => setTimeout(r, 300));
  console.log('bookmark', await p.evaluate(() => JSON.parse(localStorage.getItem('pdfstage.v1')) !== null));

  // 保存批注
  await p.click('[data-act=save]');
  await new Promise(r => setTimeout(r, 400));

  // 刷新后恢复
  await p.reload({ waitUntil: 'networkidle0' });
  await (await p.$('#fileInput')).uploadFile(PDF);
  await new Promise(r => setTimeout(r, 1600));
  console.log('restored strokes', await p.evaluate(() => document.querySelectorAll('#inkA path').length));
  console.log('marks restored', await p.evaluate(() => {
    const rec = JSON.parse(localStorage.getItem('pdfstage.v1'));
    const k = Object.keys(rec)[0];
    return rec[k].marks;
  }));

  // 截图
  await p.click('[data-act=shot]');
  await new Promise(r => setTimeout(r, 1800));
  console.log('dl after shot', fs.readdirSync(DL));

  // 导出
  await p.click('[data-act=export]');
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 700));
    const f = fs.readdirSync(DL).filter(x => /\.pdf$/i.test(x));
    if (f.length && !fs.readdirSync(DL).some(x => x.endsWith('.crdownload'))) break;
  }
  console.log('dl files', fs.readdirSync(DL).map(f => f + ':' + fs.statSync(path.join(DL, f)).size));

  // 页面跳转
  await p.click('[data-act=thumbs]');
  await new Promise(r => setTimeout(r, 900));
  await p.click('.thumb[data-page="3"]');
  await new Promise(r => setTimeout(r, 900));
  console.log('goto page', await p.evaluate(() => document.querySelector('#pageNow').textContent));

  // 画面调节：亮度变化
  await p.click('[data-act=adjust]');
  await new Promise(r => setTimeout(r, 300));
  await p.evaluate(() => {
    const i = document.querySelector('#pop input[data-f=bright]');
    i.value = 70; i.dispatchEvent(new Event('input'));
  });
  console.log('filter', await p.evaluate(() => document.querySelector('#sheetA').style.filter));

  console.log('ERRORS', errs.slice(0, 6));
  await b.close();
})();
