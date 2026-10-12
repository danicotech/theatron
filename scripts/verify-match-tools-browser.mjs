import { chromium } from 'file:///C:/Users/User/Documents/code/react-vite-erp/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({headless:true});
const results = [];
await mkdir('docs/previews/role-audit', {recursive:true});
try {
  for (const width of [1198,375]) {
    const page = await browser.newPage({viewport:{width,height:884}});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:3000/?preview=1&stage=2d&intro=0#register');
    await page.waitForSelector('.registration-desk[data-expanded="true"]');
    const read = () => page.evaluate(() => new Promise((resolve,reject)=>{
      const r=indexedDB.open('lunjian-sportsbook-demo',1);
      r.onsuccess=()=>{const db=r.result;const t=db.transaction('state','readonly');const q=t.objectStore('state').get('root');q.onsuccess=()=>resolve(JSON.stringify(q.result));q.onerror=()=>reject(q.error);t.oncomplete=()=>db.close();};
      r.onerror=()=>reject(r.error);
    }));
    const before=await read();
    await page.getByLabel('更多選單').click();
    await page.locator('[data-match-tools]').click();
    const dialog=page.getByRole('dialog',{name:'對局小工具'});
    await dialog.getByRole('button',{name:'雙方擲骰'}).click();
    await dialog.getByRole('status').filter({hasText:/點/}).waitFor();
    await page.screenshot({path:`docs/previews/role-audit/tools-dice-${width}.png`});
    await dialog.getByRole('button',{name:'剪刀石頭布',exact:true}).click();
    await dialog.getByRole('button',{name:'剪刀',exact:true}).click();
    assert.equal(await dialog.getByRole('button',{name:'石頭',exact:true}).count(),0);
    await dialog.getByRole('button',{name:'我是 乙方，開始選擇'}).click();
    await dialog.getByRole('button',{name:'布',exact:true}).click();
    assert.match(await dialog.getByRole('status').innerText(),/甲方 勝出/);
    await page.screenshot({path:`docs/previews/role-audit/tools-hands-${width}.png`});
    assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
    assert.equal(await read(),before,'Independent tools must not modify tournament data');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByLabel('更多選單').evaluate(el=>document.activeElement===el),true);
    assert.deepEqual(errors,[]);
    results.push({width,dice:true,hiddenHands:true,unchangedTournament:true,focusRestored:true,errors});
    await page.close();
  }
  await writeFile('docs/previews/role-audit/tools-results.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results));
} finally {await browser.close();}
