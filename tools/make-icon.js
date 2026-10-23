const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({executablePath:'/root/.cache/puppeteer/chrome/linux-155.0.8059.39/chrome-linux64/chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']});
  const p = await b.newPage();
  await p.setViewport({width:512,height:512,deviceScaleFactor:1});
  await p.goto('file:///workspace/pdf-stage/assets/icon.svg',{waitUntil:'networkidle0'});
  await p.screenshot({path:'/workspace/pdf-stage/assets/icon.png',omitBackground:true});
  await b.close();
})();
