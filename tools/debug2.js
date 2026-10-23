const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({executablePath:'/root/.cache/puppeteer/chrome/linux-155.0.8059.39/chrome-linux64/chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const p = await b.newPage();
  await p.setViewport({width:1200,height:800});
  await p.goto('http://127.0.0.1:8123/index.html',{waitUntil:'networkidle0'});
  await (await p.$('#fileInput')).uploadFile('/workspace/pdf-stage/sample/演示课件.pdf');
  await new Promise(r=>setTimeout(r,1200));
  console.log(await p.evaluate(()=>{
    const a=document.querySelector('[data-mode=pen]');
    const r=a.getBoundingClientRect();
    return {r:{x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom}, ih:innerHeight};
  }));
  await p.click('[data-mode=pen]');
  await new Promise(r=>setTimeout(r,200));
  console.log(await p.evaluate(()=>{
    const pop=document.querySelector('#pop');
    return {top:pop.style.top,left:pop.style.left,h:pop.offsetHeight,w:pop.offsetWidth,cs:getComputedStyle(pop).display};
  }));
  await b.close();
})();
