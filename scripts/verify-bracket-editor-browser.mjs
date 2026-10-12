// Isolated local preview editor checks: no real participants or user storage.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright-core');
const output='docs/previews/bracket-editor-browser';
await mkdir(output,{recursive:true});
const results=[];
const browser=await chromium.launch({headless:true});
try{
 for(const width of [1440,768,375]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3000/?preview=1&phase=finished&stage=2d&intro=0#schedule',{waitUntil:'networkidle'});
  const tools=page.locator('.bracket-editor-tools'),dialog=page.locator('.bracket-editor-dialog');
  await tools.getByRole('button',{name:'編輯',exact:true}).click();
  async function snapshot(name){
   await page.screenshot({path:`${output}/${width}-${name}.png`,animations:'disabled'});
   await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
   const data=await page.evaluate(async()=>({
    overflow:document.documentElement.scrollWidth>innerWidth+1,
    controls:[...document.querySelectorAll('.bracket-editor-tools button,.bracket-editor-tools input,.bracket-editor-tools select,.bracket-editor-dialog button,.bracket-editor-dialog input,.bracket-editor-dialog select')]
      .filter(el=>el.checkVisibility()&&!el.disabled&&!el.closest('[inert]')&&el.getBoundingClientRect().bottom>0&&el.getBoundingClientRect().top<innerHeight)
      .map(el=>({text:el.getAttribute('aria-label')||el.name||el.textContent,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}))
      .filter(el=>el.width<43.5||el.height<43.5),
    violations:(await window.axe.run(document.body,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),
   }));
   results.push({width,name,...data});console.log(JSON.stringify(results.at(-1)));
  }
  await snapshot('editing');
  for(const count of [16,32,64]){
   await tools.getByRole('button',{name:`${count} 人`,exact:true}).click();
   assert.match(await tools.locator('.be-size-note').innerText(),new RegExp(`^${count} 位選手`));
  }
  await snapshot('64-entrants');
  assert.equal(await page.locator('#bracket-host .tt-viewport').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true,'no nested vertical bracket scroll');
  await tools.getByRole('spinbutton',{name:'示範人數'}).fill('7');
  await tools.getByRole('button',{name:'套用人數',exact:true}).click();
  assert.match(await tools.locator('.be-size-note').innerText(),/7 位選手 · 8 籤位 · 1 位輪空/);
  await snapshot('odd-entrants');
  await tools.getByRole('spinbutton',{name:'示範人數'}).fill('99');
  await tools.getByRole('button',{name:'套用人數',exact:true}).click();
  assert.equal(await tools.getByRole('spinbutton',{name:'示範人數'}).getAttribute('aria-invalid'),'true');
  assert.equal(await tools.getByRole('spinbutton',{name:'示範人數'}).evaluate(el=>el===document.activeElement),true);
  await snapshot('invalid-count');
  await tools.getByRole('button',{name:'8 人',exact:true}).click();
  await tools.getByRole('textbox',{name:'新增報名者姓名'}).fill('長夜觀星的測試俠客');
  await tools.getByRole('button',{name:'新增報名者',exact:true}).click();
  if(width===1440){
   await tools.getByRole('button',{name:'長夜觀星的測試俠客，待排入',exact:true}).dragTo(page.locator('#bracket-host .tt-player[data-match-id="m1-0"][data-seat="0"]'));
  }else{
   await tools.getByRole('combobox',{name:'目標首輪籤位'}).selectOption(JSON.stringify(['m1-0','p1']));
   await tools.getByRole('button',{name:'放入籤位',exact:true}).click();
  }
  assert.equal(await tools.getByRole('button',{name:'長夜觀星的測試俠客，已排入',exact:true}).count(),1);
  await snapshot('assigned');
  await tools.getByRole('button',{name:'復原上一步',exact:true}).click();
  assert.equal(await tools.getByRole('button',{name:'長夜觀星的測試俠客，待排入',exact:true}).count(),1);
  const savedBefore=await page.evaluate(()=>localStorage.getItem('lunjian.bracket-editor.v1.finished'));
  await tools.getByRole('button',{name:'選場編輯',exact:true}).click();
  await snapshot('match-editor');
  await dialog.locator('[name="s1"]').fill('-1');
  await dialog.getByRole('button',{name:'儲存這場比分',exact:true}).click();
  assert.match(await dialog.locator('[data-error]').innerText(),/整數/);
  assert.equal(await dialog.locator('[data-error]').evaluate(el=>el===document.activeElement),true);
  await snapshot('invalid-score');
  await dialog.getByRole('button',{name:'取消',exact:true}).click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('lunjian.bracket-editor.v1.finished')),savedBefore);
  await tools.getByRole('button',{name:'選場編輯',exact:true}).click();
  await dialog.getByRole('button',{name:'此方獲勝',exact:true}).nth(1).click();
  assert.equal(await dialog.locator('[name="s2"]').inputValue(),'2');
  await dialog.getByRole('button',{name:'儲存這場比分',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.bracket-editor-dialog').open);
  await snapshot('saved');
  await page.reload({waitUntil:'networkidle'});
  await tools.getByRole('button',{name:'編輯',exact:true}).click();
  await tools.getByRole('button',{name:'選場編輯',exact:true}).click();
  assert.equal(await dialog.locator('[name="s2"]').inputValue(),'2');
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{
   const original=Storage.prototype.setItem;
   window.restoreBracketStorage=()=>{Storage.prototype.setItem=original;};
   Storage.prototype.setItem=function(key,value){if(key.startsWith('lunjian.bracket-'))throw new DOMException('quota','QuotaExceededError');return original.call(this,key,value);};
  });
  await tools.getByRole('button',{name:'復原上一步',exact:true}).click();
  assert.match(await tools.locator('[role="status"]').innerText(),/無法儲存/);
  await snapshot('storage-failure');
  await tools.getByRole('button',{name:'還原本階段示範',exact:true}).click();
  await tools.getByRole('button',{name:'再次點選，確認還原',exact:true}).click();
  assert.match(await tools.locator('[role="status"]').innerText(),/無法儲存/);
  await page.evaluate(()=>window.restoreBracketStorage());
  await tools.getByRole('button',{name:'檢視',exact:true}).click();
  assert.equal(await tools.locator('.be-edit-controls').isVisible(),false);
  await snapshot('view');
  assert.deepEqual(errors,[]);await context.close();
 }
 for(const r of results){assert.equal(r.overflow,false,`${r.width} ${r.name}: overflow`);assert.deepEqual(r.controls,[],`${r.width} ${r.name}: control size`);assert.deepEqual(r.violations,[],`${r.width} ${r.name}: accessibility`);}
}finally{await writeFile(`${output}/results.json`,JSON.stringify(results,null,2));await browser.close();}
