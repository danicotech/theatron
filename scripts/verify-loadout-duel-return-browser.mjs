import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/User/Documents/code/react-vite-erp/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({headless:true});
try {
 for(const width of [1198,375]) {
  const page=await browser.newPage({viewport:{width,height:884}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3000/loadout?sportsEvent=return-check&preview=1&stage=2d');
  await page.waitForFunction(()=>Boolean(window.__LOADOUT)&&document.querySelector('#roles button'));
  const back=page.locator('#return-duel');
  assert.equal(await back.isVisible(),true);
  assert.equal(await page.locator('#ver').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`docs/previews/september-polish/loadout-return-${width}.png`});
  await back.click();
  await page.waitForURL(url=>url.hash==='#duel');
  await page.waitForSelector('#duel[data-on]');
  const url=new URL(page.url());
  assert.equal(url.searchParams.get('sportsEvent'),'return-check');
  assert.equal(url.searchParams.get('preview'),'1');
  assert.equal(url.searchParams.get('stage'),'2d');
  assert.equal(url.searchParams.get('intro'),'0');
  const editor=new URL(await page.locator('[data-loadout]').first().getAttribute('href'),page.url());
  assert.equal(editor.searchParams.get('sportsEvent'),'return-check');
  assert.equal(editor.searchParams.get('preview'),'1');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({width,returned:url.pathname+url.search+url.hash}));
  await page.close();
 }
} finally {await browser.close();}
