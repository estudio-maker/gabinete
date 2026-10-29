const { chromium, devices } = require('playwright');
const fs=require('fs'), path=require('path');
(async()=>{
  const b=await chromium.launch();
  const SITE='/home/claude/gabinete/_marcas/esm/sitio';
  for (const [name,dev,dark] of [['ios',devices['iPhone 13'],false],['and',devices['Pixel 7'],false]]){
    const c=await b.newContext({...dev, deviceScaleFactor:3, colorScheme:'light'});
    const p=await c.newPage();
    await p.route('**/*',r=>{const u=r.request().url();
      if(u.includes('supabase.min.js')) return r.fulfill({body:fs.readFileSync('package/dist/umd/supabase.js'),contentType:'application/javascript'});
      if(u.startsWith('https://esm.local/')){let f=u.slice(18).split('?')[0].split('#')[0]||'index.html'; if(f.endsWith('/'))f+='index.html'; const fp=path.join(SITE,f); if(fs.existsSync(fp)) return r.fulfill({body:fs.readFileSync(fp)}); return r.fulfill({status:404,body:''});}
      if(u.includes('fonts.g')) return r.continue();
      return r.abort();});
    p.on('console',m=>console.log(name,m.text()));
    await p.goto('https://esm.local/');
    await p.waitForTimeout(2500);
    await p.screenshot({path:`login-${name}.png`});
  }
  await b.close();
})();
