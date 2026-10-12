import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/User/Documents/code/react-vite-erp/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({headless:true});
try{
  for(const width of [1055,375]){
    const page=await browser.newPage({viewport:{width,height:884}});
    await page.goto('http://127.0.0.1:3000/?stage=2d&intro=0#duel');
    await page.waitForTimeout(3000);
    assert.ok(await page.locator('#duel .fighter').evaluateAll(es=>es.every(e=>getComputedStyle(e,'::after').content==='none')));
    await page.screenshot({path:`docs/previews/september-polish/duel-player-entry-${width}.png`});
    for(const selector of ['#duel-bet-actions','#duel-match-actions > .duel-return']){
      assert.ok(await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return Math.abs(r.left+r.width/2-innerWidth/2)<2;}));
    }
    for(const side of ['left','right']){
      const name=await page.locator(`#duel .fighter[data-side="${side}"] .nm`).innerText();
      for(const selector of [`.duelist[data-side="${side}"]`,`.fighter[data-side="${side}"] .nm`]){
        await page.locator(`#duel ${selector}`).click();
        await page.locator('#psheet').waitFor({state:'visible'});
        assert.equal(await page.locator('#dz-title').innerText(),name);
        assert.equal(await page.locator('#psheet .dz-kicker').innerText(),'備戰方案');
        await page.keyboard.press('Escape');
        await page.locator('#psheet').waitFor({state:'hidden'});
      }
    }
    const trigger=page.locator('#duel .duelist[data-side="left"]');
    await trigger.focus();await page.keyboard.press('Enter');
    await page.locator('#psheet').waitFor({state:'visible'});
    await page.keyboard.press('Escape');
    assert.equal(await trigger.evaluate(e=>e===document.activeElement),true);
    console.log(`${width}px: no secondary link; both figures and names open their dossier; keyboard/focus passed`);
    await page.goto('http://127.0.0.1:3000/?stage=2d&intro=0#prologue');
    await page.waitForTimeout(2200);
    await page.locator('.frame-stage').evaluate(e=>e.scrollIntoView({block:'center'}));
    await page.waitForTimeout(3400);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.ok(await page.locator('.novice-breakout').evaluate(e=>e.getBoundingClientRect().top>=e.closest('figure').getBoundingClientRect().top),'The figure must not overlap the previous frame');
    await page.screenshot({path:`docs/previews/september-polish/prologue-breakout-${width}.png`});
    await page.close();
  }
}finally{await browser.close();}
