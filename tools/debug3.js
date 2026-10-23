const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({executablePath:'/root/.cache/puppeteer/chrome/linux-155.0.8059.39/chrome-linux64/chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const p = await b.newPage();
  await p.setViewport({width:1024,height:600});
  await p.goto('http://127.0.0.1:8123/index.html',{waitUntil:'networkidle0'});
  console.log(await p.evaluate(()=>{
    const m=document.querySelector('#barMain'), r=document.querySelector('#barRight');
    const a=m.getBoundingClientRect(), c=r.getBoundingClientRect();
    return {main:{x:a.x,y:a.y,w:a.width,h:a.height,sw:m.scrollWidth,cw:m.clientWidth}, right:{x:c.x,y:c.y,w:c.width,h:c.height}, ih:innerHeight};
  }));
  await b.close();
})();
