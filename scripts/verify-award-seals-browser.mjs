import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/User/Documents/code/react-vite-erp/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({headless:true});
try{
 for(const width of [1198,375]){
  const page=await browser.newPage({viewport:{width,height:884}});
  await page.goto('http://127.0.0.1:3000/?stage=2d&intro=0#rewards');
  for(const rank of [1,2,3]){
   const panel=page.locator(`.podium-${rank}`);
   await panel.scrollIntoViewIfNeeded();
   await page.waitForTimeout(1750);
   if(width===375)await panel.screenshot({path:`docs/previews/september-polish/award-${rank}-${width}.png`});
  }
  const seals=await page.locator('.podium-stamp').evaluateAll(es=>es.map(e=>({width:e.offsetWidth,height:e.offsetHeight,hidden:e.getAttribute('aria-hidden')})));
  assert.ok(seals[0].width>seals[1].width&&seals[1].width>seals[2].width);
  assert.ok(seals.every(s=>s.hidden==='true'));
  assert.equal(await page.locator('.podium-wax-art,.podium-number').count(),0);
  const positions=await page.locator('.podium-frame').evaluateAll(es=>es.map(e=>{const card=e.getBoundingClientRect(),stamp=e.querySelector('.podium-stamp').getBoundingClientRect();return {top:stamp.top-card.top,right:card.right-stamp.right};}));
  assert.ok(positions.every(p=>p.top>=0&&p.top<32&&p.right>=0&&p.right<32));
  const textFits=await page.locator('.podium-stamp').evaluateAll(es=>es.every(e=>{const outer=e.getBoundingClientRect(),inner=e.querySelector('span').getBoundingClientRect();return inner.top>outer.top+5&&inner.bottom<outer.bottom-5&&inner.left>outer.left+5&&inner.right<outer.right-5;}));
  assert.ok(textFits,'Seal lettering stays inside the frame');
  assert.ok(await page.locator('.podium-figure').evaluateAll(es=>es.every(e=>{const figure=e.getBoundingClientRect(),art=e.parentElement.getBoundingClientRect();return (figure.left+figure.right)/2<(art.left+art.right)/2;})));
  assert.ok(await page.locator('.podium-art>img').evaluateAll(es=>new Set(es.map(e=>e.src)).size===3&&es.every(e=>e.complete&&e.naturalWidth>0&&e.src.includes('manga-awards-'))));
  assert.deepEqual(await page.locator('[data-prize-name]').allTextContents(),['待揭曉','待揭曉','待揭曉']);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(width===1198){await page.locator('.podium-board').scrollIntoViewIfNeeded();await page.screenshot({path:`docs/previews/september-polish/awards-${width}.png`});}
  console.log(JSON.stringify({width,seals}));await page.close();
 }
}finally{await browser.close();}
