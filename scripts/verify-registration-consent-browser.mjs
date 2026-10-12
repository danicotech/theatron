import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/User/Documents/code/react-vite-erp/node_modules/playwright-core/index.mjs';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({headless:true});const results=[];
try{for(const width of [1055,375]){
 const page=await browser.newPage({viewport:{width,height:884}});
 await page.goto('http://127.0.0.1:3000/?stage=2d&intro=0#register');
 await page.waitForFunction(()=>document.querySelector('#register-cta')?.hasAttribute('data-registration-entry'));
 await page.locator('#register-cta').click();
 const scroll=page.getByRole('region',{name:'報名書卷',exact:true});
 const check=scroll.getByRole('checkbox',{name:'我已了解賽制與讓武原則'});
 await check.waitFor();await scroll.evaluate(el=>el.getAnimations({subtree:true}).forEach(a=>a.finish()));
 const row=check.locator('..');
 await page.mouse.move(0,0);const initial=await row.evaluate(el=>getComputedStyle(el).backgroundColor);
 await row.hover();const hover=await row.evaluate(el=>getComputedStyle(el).backgroundColor);assert.notEqual(initial,hover);
 await check.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');const outline=await row.evaluate(el=>getComputedStyle(el).outlineWidth);assert.equal(outline,'0px');assert.equal(await check.evaluate(el=>getComputedStyle(el).outlineWidth),'2px');
 await page.keyboard.press('Space');assert.equal(await check.isChecked(),true);
 assert.equal(await row.evaluate(el=>getComputedStyle(el).borderColor),'rgba(0, 0, 0, 0)');
 const checked=await row.evaluate(el=>getComputedStyle(el).backgroundColor);assert.notEqual(checked,hover);
 await page.screenshot({path:`docs/previews/registration-scroll-browser/consent-${width}.png`});
 const close=scroll.getByRole('button',{name:/收卷/});
 await close.scrollIntoViewIfNeeded();await page.mouse.move(0,0);
 const before=await close.evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),color:getComputedStyle(el).backgroundColor}));
 await close.hover();await close.evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
 const after=await close.evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),color:getComputedStyle(el).backgroundColor,transform:getComputedStyle(el).transform}));
 assert.deepEqual(before.rect,after.rect);assert.equal(after.transform,'none');assert.notEqual(before.color,after.color);
 await page.screenshot({path:`docs/previews/registration-scroll-browser/pull-tab-hover-${width}.png`});
 await page.evaluate(()=>window.consentDocument=true);
 for(const [name,chapter,index] of [['賽制','rules',1],['讓武原則','invitation',2]]){
  const link=scroll.getByRole('link',{name,exact:true});assert.equal(await link.getAttribute('href'),'#'+chapter);
  await link.click();await page.waitForFunction(i=>window.__LUNJIAN.S.shown===i,index);
  assert.equal(await page.evaluate(()=>window.consentDocument),true);assert.equal(await page.locator('#registration-inline input[data-field="rulesAccepted"]').isChecked(),true);
  await page.locator('.site-nav a[href="#register"]').click();await page.waitForFunction(()=>window.__LUNJIAN.S.shown===3&&!window.__LUNJIAN.S.cut);
 }
 results.push({width,initial,hover,checked,outline,linksVerified:true,checkRetained:true,hoverPositionStable:true});console.log(JSON.stringify(results.at(-1)));await page.close();
}await writeFile('docs/previews/registration-scroll-browser/consent-results.json',JSON.stringify(results,null,2));}finally{await browser.close();}
