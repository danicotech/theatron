import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/User/Documents/code/react-vite-erp/node_modules/playwright-core/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const out='docs/previews/september-polish';await mkdir(out,{recursive:true});
const results=[];
try{
for(const width of [1055,375]){
 const page=await browser.newPage({viewport:{width,height:884}});
 await page.goto('http://127.0.0.1:3000/?stage=2d&intro=0#duel',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('#duel .duel-calligraphy');
 await page.waitForTimeout(3200);
 await page.screenshot({path:`${out}/duel-${width}.png`});
 assert.equal(await page.locator('#duel .chapter-calligraphy').evaluate(e=>getComputedStyle(e).color),'rgb(220, 193, 139)');
 assert.ok(await page.locator('.duel-calligraphy').evaluate(e=>Math.abs(e.getBoundingClientRect().left+e.getBoundingClientRect().width/2-innerWidth/2)<2));
 assert.ok(await page.locator('.site-nav a,.header-actions a,.header-actions summary').evaluateAll(es=>es.every(e=>getComputedStyle(e).fontFamily.includes('Microsoft JhengHei'))));
 results.push(await page.evaluate(()=>({page:'duel',width:innerWidth,title:(()=>{const e=document.querySelector('.duel-calligraphy');return {box:e.getBoundingClientRect().toJSON(),color:getComputedStyle(e).color,child:getComputedStyle(e.firstElementChild).color}})(),fonts:[...document.querySelectorAll('.site-nav a,.header-actions a,.header-actions summary')].map(e=>getComputedStyle(e).fontFamily)})));
 await page.goto('http://127.0.0.1:3000/?stage=2d&intro=0#rules',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(5000);
 await page.screenshot({path:`${out}/rules-${width}.png`});
 assert.ok(await page.locator('.frame-assess').evaluate(e=>{const f=e.getBoundingClientRect(),p=e.querySelector('.judge-layer').getBoundingClientRect();return Math.abs((f.left+f.right-p.left-p.right)/2)<2;}));
 assert.equal(await page.locator('h1').count(),1);
 assert.equal(await page.locator('#rules-title').evaluate(e=>e.tagName),'H2');
 await page.goto('http://127.0.0.1:3000/?stage=2d&intro=0#invitation',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(5000);
 await page.screenshot({path:`${out}/invitation-${width}.png`});
 await page.goto('http://127.0.0.1:3000/?stage=2d&intro=0#schedule',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('#bracket-host[data-placeholder] .tt-player');
 await page.waitForTimeout(2500);
 assert.equal(await page.locator('#bracket-host .tt-node').count(),3);
 assert.equal(await page.locator('#bracket-host .tt-node:enabled,#bracket-host .tt-player:enabled,#bracket-host .tt-champion:enabled').count(),0);
 assert.equal(await page.locator('.schedule-heading > p').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal(await page.locator('#bracket-host').getAttribute('data-view'),width===375?'round':'tree');
 await page.screenshot({path:`${out}/schedule-${width}.png`});
 if(width===375){
  await page.getByRole('tab',{name:'決賽',exact:true}).click();
  assert.equal(await page.locator('#bracket-host .tt-round[data-round="2"]').isVisible(),true);
  await page.screenshot({path:`${out}/schedule-final-${width}.png`});
 }
 await page.goto('http://127.0.0.1:3000/?stage=2d&intro=0#register',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('#register-cta[data-registration-entry]');
 await page.waitForTimeout(3000);
 await page.screenshot({path:`${out}/register-${width}.png`});
 results.push(await page.locator('.registration-seal-label').evaluate(e=>({page:'register',width:innerWidth,box:e.getBoundingClientRect().toJSON(),duration:e.querySelector('.ink-svg')?.style.getPropertyValue('--ink-dur')})));
 await page.goto('http://127.0.0.1:3000/home?stage=2d&intro=0',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(2000);
 await page.screenshot({path:`${out}/home-${width}.png`});
 assert.equal(await page.locator('.home-brazier').count(),0);
 assert.ok(await page.locator('.home-pine').evaluate(e=>e.complete&&e.naturalWidth>0));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.close();
}
await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
