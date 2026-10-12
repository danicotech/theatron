import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({headless:true});
try{
 const width=Number(process.env.TEST_WIDTH||1055);
 const page=await browser.newPage({viewport:{width,height:884}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3000/home?stage=3d&intro=0',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('.baiye-home[data-scene="3d"]',{timeout:120000});
 await page.mouse.move(width*.2,300);
 await page.waitForFunction(()=>window.__JZ3D.camera.position.x<-.5,{},{timeout:60000});
 const left=await page.evaluate(()=>({camera:window.__JZ3D.camera.position.toArray(),title:new DOMMatrix(getComputedStyle(document.querySelector('h1[data-home-depth]')).transform).m41}));
 await page.mouse.move(width*.8,550);
 await page.waitForFunction(()=>window.__JZ3D.camera.position.x>.5,{},{timeout:60000});
 const right=await page.evaluate(()=>({camera:window.__JZ3D.camera.position.toArray(),title:new DOMMatrix(getComputedStyle(document.querySelector('h1[data-home-depth]')).transform).m41}));
 assert.ok(right.camera[0]-left.camera[0]>1);
 assert.ok(left.title-right.title>2);
 await page.waitForFunction(()=>document.querySelector('h1[data-home-depth]').style.transform.includes('translate3d(-'),{},{timeout:60000});
 const layers=await page.locator('[data-home-depth]').evaluateAll(elements=>elements.map(e=>{
  const r=e.getBoundingClientRect();return {name:e.className||'title',transform:e.style.transform,visible:r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0,display:getComputedStyle(e).display};
 }));
 assert.ok(layers.filter(e=>e.display!=='none').every(e=>e.visible));
 assert.equal(new Set(layers.map(e=>e.transform)).size,5);
 assert.ok(layers.find(e=>e.name==='title').transform.includes('rotateY('));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal(await page.locator('.home-actions').evaluate(e=>getComputedStyle(e).transform),'none');
 await page.screenshot({path:`docs/previews/public-presentation-browser/home-3d-${width}.png`,timeout:60000});
 const evidence=await page.evaluate(()=>{
  const result=window.__JZ3D.snapshot();
  const token=document.getElementById('home-stage-mount').dataset.token;
  document.dispatchEvent(new CustomEvent('lunjian:home-unmount',{detail:token}));
  return {result,disposed:!window.__JZ3D,sceneFlag:document.querySelector('.baiye-home').dataset.scene||null,transformsCleared:[...document.querySelectorAll('[data-home-depth]')].every(e=>!e.style.transform)};
 });
 assert.ok(evidence.result.frame>0);assert.equal(evidence.disposed,true);assert.equal(evidence.sceneFlag,null);assert.equal(evidence.transformsCleared,true);assert.deepEqual(errors,[]);
 await writeFile(`docs/previews/public-presentation-browser/home-3d-${width}.json`,JSON.stringify({width,left,right,layers,...evidence},null,2));
 console.log(JSON.stringify({width,left,right,layers,...evidence}));
}finally{await browser.close();}
