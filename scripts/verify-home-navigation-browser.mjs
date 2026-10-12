import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {writeFile} from 'node:fs/promises';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const b=await chromium.launch({headless:true});const results=[];
try {
 for(const [mode,target] of [['2d','rules'],['2d','register'],['3d','register']]){
  const p=await b.newPage({viewport:{width:1055,height:884}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  if(mode==='2d')await p.addInitScript(()=>{const native=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:native.call(this,type,...args);};});
  await p.goto(`http://127.0.0.1:3000/home?intro=0&stage=${mode}`);
  if(mode==='3d')await p.waitForSelector('[data-scene="3d"]',{timeout:180000});
  await p.evaluate(()=>{window.__documentMarker='home-transition';window.__oldScene=window.__JZ3D?.scene;window.__oldCanvas=document.getElementById('home-world');});
  const start=Date.now();const link=p.locator(`.home-actions a[href$="#${target}"]`);if(mode==='3d')await link.evaluate(e=>e.click());else await link.click();
  await p.waitForFunction(target=>window.__LUNJIAN?.S.shown===(target==='rules'?1:3),target,{timeout:60000});
  if(mode==='3d')await p.waitForFunction(()=>!!window.__LUNJIAN?.S.scene3d,{},{timeout:60000});
  const evidence=await p.evaluate(()=>({sameDocument:window.__documentMarker==='home-transition',sameScene:!!window.__oldScene&&window.__oldScene===window.__JZ3D?.scene,sameCanvas:window.__oldCanvas===document.getElementById('world'),intro:document.body.hasAttribute('data-intro'),transferPending:!!window.__LUNJIAN_SCENE_TRANSFER,chapter:location.hash}));
  assert.equal(evidence.sameDocument,true);assert.equal(evidence.intro,false);if(mode==='3d'){assert.equal(evidence.sameScene,true);assert.equal(evidence.sameCanvas,true);assert.equal(evidence.transferPending,false);}assert.deepEqual(errors,[]);
  results.push({mode,target,elapsedMs:Date.now()-start,...evidence,errors});console.log(JSON.stringify(results.at(-1)));
  await p.close();
 }
 await writeFile('docs/previews/public-presentation-browser/home-navigation.json',JSON.stringify(results,null,2));
}finally{await b.close();}
