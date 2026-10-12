import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/User/Documents/code/react-vite-erp/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({headless:true});
try{
 for(const width of [1198,375]){
  const page=await browser.newPage({viewport:{width,height:884}});
  await page.goto('http://127.0.0.1:3000/?stage=2d&intro=0#prologue');
  await page.waitForTimeout(3800);
  const positions=await page.locator('.frame-novice .frame-caption,.frame-veteran .frame-caption').evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e);return {left:s.left,right:s.right,top:s.top};}));
  assert.equal(parseFloat(positions[0].right),width===375?12:20);
  assert.equal(parseFloat(positions[1].top),width===375?32:48);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`docs/previews/september-polish/prologue-captions-${width}.png`});
  console.log(JSON.stringify({width,positions}));
  await page.close();
 }
}finally{await browser.close();}
