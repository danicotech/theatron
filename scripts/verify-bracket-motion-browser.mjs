// Sample the actual CSS result animations without replacing their keyframes.
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright-core');
const output='docs/previews/bracket-motion-browser';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});const results=[];
try{
 for(const width of [1440,375]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
  await page.goto('http://127.0.0.1:3000/?preview=1&phase=finished&stage=2d&intro=0#schedule',{waitUntil:'networkidle'});
  const tools=page.locator('.bracket-editor-tools');
  await tools.getByRole('button',{name:'編輯',exact:true}).click();
  await tools.getByRole('button',{name:'重播勝敗效果',exact:true}).click();
  const animations=await page.evaluate(()=>{
   window.sampledBracketAnimations=document.querySelector('#bracket-host').getAnimations({subtree:true}).filter(a=>a.animationName?.startsWith('tt-'));
   window.sampledBracketAnimations.forEach(a=>a.pause());
   return [...new Set(window.sampledBracketAnimations.map(a=>a.animationName))];
  });
  for(const name of ['tt-stamp','tt-blade-cut','tt-tear-upper','tt-tear-lower','tt-crown-stamp'])assert.ok(animations.includes(name),`${width}: ${name}`);
  // Put the actual final matchup in view after capturing the new animation objects.
  await page.locator('#bracket-host .tt-champion').scrollIntoViewIfNeeded();
  for(const time of [250,800,1700]){
   await page.evaluate(time=>window.sampledBracketAnimations.forEach(a=>{a.currentTime=time;}),time);
   await page.screenshot({path:`${output}/${width}-${time}ms.png`});
  }
  await page.evaluate(()=>window.sampledBracketAnimations.forEach(a=>a.play()));
  await page.locator('.site-nav a[href="#rules"]').click();
  await page.waitForFunction(()=>document.querySelector('#rules').hasAttribute('data-on')&&!document.body.hasAttribute('data-cut'));
  const paused=await page.locator('#bracket-host .tt-cut-flash').evaluateAll(els=>els.length>0&&els.every(el=>getComputedStyle(el).animationPlayState==='paused'));
  assert.equal(paused,true);
  await page.emulateMedia({reducedMotion:'reduce'});
  const reduced=await page.locator('#bracket-host .tt-cut-flash,#bracket-host .tt-victory-stamp,#bracket-host .tt-champion-stamp').evaluateAll(els=>els.every(el=>getComputedStyle(el).animationName==='none'));
  assert.equal(reduced,true);
  let proximity=null;
  if(width===1440){
   await page.emulateMedia({reducedMotion:'no-preference'});
   if(await page.evaluate(()=>document.body.classList.contains('reading'))){
    await page.locator('.nav-more summary').click();
    await page.locator('.nav-menu [data-reading-toggle]').click();
   }
   await page.locator('.site-nav a[href="#duel"]').click();
   await page.waitForFunction(()=>document.querySelector('#duel').hasAttribute('data-on')&&!document.body.hasAttribute('data-cut'));
   const anchor=await page.locator('#duel .arena-fighter[data-side="left"]').evaluate(el=>{
    const arena=document.querySelector('#duel .arena-composition').getBoundingClientRect();
    return {x:arena.x+el.offsetLeft+el.offsetWidth/2,y:arena.y+el.offsetTop+el.offsetHeight/2,radius:Math.max(220,Math.min(arena.width*.5,innerHeight*.65))};
   });
   const focus=()=>page.locator('#duel .arena-fighter[data-side="left"]').evaluate(el=>({amount:Number(el.style.getPropertyValue('--focus')),scale:new DOMMatrix(getComputedStyle(el).transform).a}));
   await page.mouse.move(width-10,140);
   await page.waitForFunction(()=>Number(document.querySelector('#duel .arena-left').style.getPropertyValue('--focus'))<.01);
   const far=await focus();
   await page.mouse.move(anchor.x+anchor.radius*.6,anchor.y);
   await page.waitForFunction(()=>{const n=Number(document.querySelector('#duel .arena-left').style.getPropertyValue('--focus'));return n>.30&&n<.40;});
   const approaching=await focus();
   await page.mouse.move(anchor.x,anchor.y);
   await page.waitForFunction(()=>Number(document.querySelector('#duel .arena-left').style.getPropertyValue('--focus'))>.98);
   const near=await focus();
   assert.ok(far.scale<approaching.scale&&approaching.scale<near.scale);
   proximity={far,approaching,near};
   await page.screenshot({path:`${output}/${width}-duel-proximity.png`});
  }
  results.push({width,animations,samples:[250,800,1700],offChapterPaused:paused,reducedMotionStatic:reduced,proximity});
  console.log(JSON.stringify(results.at(-1)));await context.close();
 }
}finally{await writeFile(`${output}/results.json`,JSON.stringify(results,null,2));await browser.close();}
