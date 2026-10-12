import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {writeFile} from 'node:fs/promises';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);const b=await chromium.launch({headless:true});const results=[];
try{for(const width of [1055,375]){
 const p=await b.newPage({viewport:{width,height:884}});
 await p.addInitScript(()=>{const native=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:native.call(this,type,...args);};window.__introWasShown=false;new MutationObserver(()=>{if(document.body?.hasAttribute('data-intro'))window.__introWasShown=true;}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['data-intro']});});
 await p.goto('http://127.0.0.1:3000/home?stage=2d');await p.waitForSelector('#boot[data-state="ready"]');await p.keyboard.press('Enter');await p.waitForSelector('#boot[hidden]',{state:'attached'});
 assert.equal(await p.evaluate(()=>sessionStorage.getItem('lunjian:opening-seen:v1')),'1');
 for(const target of ['rules','register']){
  await p.locator(`.home-actions a[href$="#${target}"]`).click();await p.waitForFunction(target=>window.__LUNJIAN?.S.shown===(target==='rules'?1:3),target);
  await p.locator('a.brand').click();await p.waitForURL('**/home');await p.waitForLoadState('networkidle');await p.locator('#home-stage-mount').waitFor({state:'attached'});
  const evidence=await p.evaluate(()=>({introWasShown:window.__introWasShown,hidden:document.getElementById('boot').hidden,inert:document.querySelector('main').inert,seen:sessionStorage.getItem('lunjian:opening-seen:v1')}));
  assert.deepEqual(evidence,{introWasShown:false,hidden:true,inert:false,seen:'1'});results.push({width,target,...evidence});console.log(JSON.stringify(results.at(-1)));
 }
 await p.reload();await p.waitForLoadState('networkidle');assert.equal(await p.evaluate(()=>window.__introWasShown),false);await p.close();
}await writeFile('docs/previews/public-presentation-browser/home-return.json',JSON.stringify(results,null,2));}finally{await b.close();}
