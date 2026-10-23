const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({executablePath:'/root/.cache/puppeteer/chrome/linux-155.0.8059.39/chrome-linux64/chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const p = await b.newPage();
  await p.setViewport({width:1024,height:600});
  await p.goto('http://127.0.0.1:8123/index.html',{waitUntil:'networkidle0'});
  console.log(await p.evaluate(()=>{
    const g=e=>{const s=getComputedStyle(e);return {bg:s.backgroundColor,w:s.width,h:s.height,disp:s.display}};
    return {
      body:g(document.body), stage:g(document.querySelector('#stage')),
      paneA:g(document.querySelector('#paneA')), sheet:g(document.querySelector('#sheetA')),
      empty:g(document.querySelector('#empty')), inner:g(document.querySelector('.empty-inner')),
      canvas: g(document.querySelector('#canvasA'))
    };
  }));
  await b.close();
})();
