import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({headless:true});const results=[];
try{
 for(const [width,reduced] of [[1055,false],[375,false],[375,true]]){
  const page=await browser.newPage({viewport:{width,height:884},reducedMotion:reduced?'reduce':'no-preference'});
  await page.goto('http://127.0.0.1:3000/?stage=2d&intro=0#register');
  await page.waitForFunction(()=>document.querySelector('#register-cta')?.hasAttribute('data-registration-entry'));
  await page.locator('#register-cta').click();
  const scroll=page.getByRole('region',{name:'報名書卷',exact:true});
  await scroll.getByRole('heading',{name:'赴約參賽'}).waitFor();
  await scroll.evaluate(el=>el.getAnimations({subtree:true}).forEach(a=>a.finish()));
  assert.equal(await scroll.getByText('報名表',{exact:true}).count(),0,'No substitute heading layered over the live form');
  const expandedMetrics=await scroll.evaluate(el=>{const c=el.closest('.chapter-sticky');return{client:c.clientHeight,content:c.scrollHeight};});
  if(width===1055)assert.ok(expandedMetrics.content<=expandedMetrics.client,'Desktop first step fits viewport');
  await scroll.getByRole('checkbox').check();
  const close=scroll.getByRole('button',{name:/收卷/});
  await close.focus();
  await page.screenshot({path:`docs/previews/registration-scroll-browser/pull-tab-${width}-${reduced}.png`});
  await scroll.evaluate(el=>{
    window.scrollCloseFrames=[];
    const capture=()=>{
      const invitation=document.querySelector('.registration-invitation');
      window.scrollCloseFrames.push({hidden:el.hidden,closing:el.hasAttribute('data-closing'),overflow:getComputedStyle(el.closest('.chapter-sticky')).overflowY,invitationVisible:getComputedStyle(invitation).display!=='none'});
      if(!el.hidden)requestAnimationFrame(capture);
    };
    requestAnimationFrame(capture);
  });
  if(!reduced){await page.clock.install();await page.clock.pauseAt(new Date());}
  await page.keyboard.press('Enter');
  let animations=[], landing;
  if(!reduced){
   animations=await scroll.evaluate(el=>el.getAnimations({subtree:true}).map(a=>({name:a.animationName,duration:a.effect.getTiming().duration})));
   assert.ok(animations.some(a=>a.name?.includes('rollWindow')&&a.duration===1000));
   assert.ok(animations.some(a=>a.name?.includes('rollRod')&&a.duration===1000));
   for(const time of [800,950,999]){
    await scroll.evaluate((el,time)=>el.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=time;}),time);
    assert.equal(await scroll.locator('.registration-roll').evaluate(el=>getComputedStyle(el).opacity),'1','Roll stays opaque through every closing frame');
    await page.screenshot({path:`docs/previews/registration-scroll-browser/continuous-${width}-${time}.png`});
   }
   landing=await scroll.evaluate(el=>{el.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=999;});return el.getBoundingClientRect().toJSON();});
   await scroll.evaluate(el=>el.getAnimations({subtree:true}).forEach(a=>a.finish()));
   await page.clock.resume();
  }
  await scroll.waitFor({state:'hidden'});
  const frames=await page.evaluate(()=>window.scrollCloseFrames);
  const closingIndex=frames.findIndex(f=>f.closing);
  if(closingIndex>=0)assert.ok(frames.slice(closingIndex).every(f=>f.hidden||(f.closing&&!f.invitationVisible&&f.overflow==='hidden')),'No expanded or duplicate surface during close');
  if(landing){const target=await page.locator('#register-cta').boundingBox();assert.ok(Math.abs(landing.x-(target.x+8))<2,'horizontal landing');assert.ok(Math.abs(landing.y-(target.y+24))<2,`vertical landing ${landing.y} vs ${target.y+24}`);}
  const closedRoll=page.locator('.registration-invitation > .registration-roll');
  assert.equal(await closedRoll.isVisible(),true,'The actual closed roll remains after runtime updates its CTA');
  assert.equal((await closedRoll.boundingBox()).height,64);
  if(!reduced){
    const title=page.locator('.registration-seal-label');
    await page.waitForFunction(()=>document.querySelector('.registration-seal-label .ink-svg'));
    const strokes=await title.evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.animationName==='ink-draw').map(a=>({delay:a.effect.getTiming().delay,state:a.playState})));
    assert.ok(strokes.length>1&&new Set(strokes.map(a=>a.delay)).size>1,'Original sequential brush strokes restored');
    await title.evaluate(el=>el.getAnimations({subtree:true}).forEach(a=>a.finish()));
  }
  await page.screenshot({path:`docs/previews/registration-scroll-browser/continuous-closed-${width}-${reduced}.png`});
  assert.equal(await page.locator('#register-cta').evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('Enter');
  await scroll.waitFor({state:'visible'});
  assert.equal(await scroll.getByRole('checkbox').isChecked(),true);
  assert.equal(await scroll.getAttribute('data-closing'),null);
  await scroll.evaluate(el=>el.getAnimations({subtree:true}).forEach(a=>a.finish()));
  await scroll.getByRole('button',{name:/收卷/}).focus();
  await scroll.evaluate(el=>{
    window.naturalCloseFrames=[];
    const capture=()=>{
      window.naturalCloseFrames.push({hidden:el.hidden,closing:el.hasAttribute('data-closing'),overflow:getComputedStyle(el.closest('.chapter-sticky')).overflowY,invitationVisible:getComputedStyle(document.querySelector('.registration-invitation')).display!=='none'});
      if(!el.hidden)requestAnimationFrame(capture);
    };
    requestAnimationFrame(capture);
  });
  await page.keyboard.press('Enter');
  await scroll.waitFor({state:'hidden'});
  const natural=await page.evaluate(()=>window.naturalCloseFrames);
  const first=natural.findIndex(f=>f.closing);
  if(!reduced){assert.ok(first>=0);assert.ok(natural.slice(first).every(f=>f.hidden||(f.closing&&!f.invitationVisible&&f.overflow==='hidden')),'Natural close must not flash expanded form');}
  results.push({width,reduced,animations,expandedMetrics,naturalFrames:natural.length,noExpandedFlash:true,focusRestored:true,draftRetained:true});
  console.log(JSON.stringify(results.at(-1)));await page.close();
 }
 await writeFile('docs/previews/registration-scroll-browser/close-results.json',JSON.stringify(results,null,2));
}finally{await browser.close();}
