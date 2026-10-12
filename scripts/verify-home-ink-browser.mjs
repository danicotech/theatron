import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({headless:true});
const results=[];
try{
 for(const width of (process.env.REAL_3D ? [1055] : [1055,375])){
  const page=await browser.newPage({viewport:{width,height:884}});
  const errors=[];page.on('pageerror',e=>errors.push(e.stack));
  await page.addInitScript(()=>{sessionStorage.setItem('lunjian:opening-seen:v1','1');window.documentMarker='kept';});
  if(!process.env.REAL_3D)await page.addInitScript(()=>{const native=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:native.call(this,type,...args);};});
  await page.route('**/lunjian/home-stage.js*',async route=>{await new Promise(r=>setTimeout(r,1600));await route.continue();});
  await page.goto('http://127.0.0.1:3000/?intro=0&stage=2d&preview=1#rules');
  await page.waitForFunction(()=>window.__LUNJIAN);
  await page.waitForFunction(()=>document.getElementById('home-navigation-mount'));
  await page.evaluate(()=>{window.documentMarker='original';document.addEventListener('lunjian:home-ready',()=>{window.homeReady=true;window.readyUnderInk=!!document.getElementById('home-return-ink');});});
  await page.locator('a.brand').click();
  await page.waitForURL('**/home?preview=1');
  const held=await page.evaluate(()=>({phase:document.documentElement.dataset.homeTransition,overlay:!!document.getElementById('home-return-ink'),sameDocument:window.documentMarker==='original',intro:document.body.hasAttribute('data-intro')}));
  assert.equal(held.phase,'hold');assert.equal(held.overlay,true);assert.equal(held.sameDocument,true);assert.equal(held.intro,false);
  await page.screenshot({path:`docs/previews/public-presentation-browser/home-ink-held-${width}.png`});
  await page.waitForFunction(()=>window.homeReady,{},{timeout:process.env.REAL_3D?90000:10000}).catch(async e=>{console.log(await page.evaluate(()=>({url:location.href,html:document.querySelector('.baiye-home')?.outerHTML.slice(0,400),scripts:Array.from(document.scripts).map(s=>s.id||s.src),intro:document.body.dataset,boot:document.getElementById('boot')?.outerHTML.slice(0,180),ready:window.homeReady})),errors);throw e;});
  await page.waitForSelector('#home-return-ink',{state:'detached',timeout:90000});
  const done=await page.evaluate(()=>({readyUnderInk:window.readyUnderInk,scene:document.querySelector('.baiye-home').dataset.scene||'fallback',focus:document.activeElement.textContent.trim(),bootHidden:document.getElementById('boot').hidden}));
  assert.equal(done.readyUnderInk,true);assert.equal(done.bootHidden,true);assert.equal(done.focus,'了解賽制');
  if(process.env.REAL_3D)assert.equal(done.scene,'3d');
  assert.deepEqual(errors,[]);assert.equal(await page.locator('#rules').count(),0);assert.equal(await page.locator('.site-header').count(),1);assert.ok(await page.locator('.home-copy h1').isVisible());
  await page.screenshot({path:`docs/previews/public-presentation-browser/home-ink-done-${width}.png`});
  results.push({width,held,done,errors});console.log(JSON.stringify(results.at(-1)));
  await page.close();
 }
 await writeFile(`docs/previews/public-presentation-browser/home-ink${process.env.REAL_3D?'-3d':''}.json`,JSON.stringify(results,null,2));
}finally{await browser.close();}
