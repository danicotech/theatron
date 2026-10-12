// 量每張前景／場景圖「實際被畫多大」對上「檔案原生多大」。
// 立繪在版面裡常常只佔一小塊，但檔案還是整張大圖，每一幀都要把它重新取樣一次。
// 用法：先開 http://localhost:8899，再 node tools/art-sizes.mjs
// 「浪費」= 原生像素 ÷（最大顯示像素 × 4）。4 是留給 2× DPR 的餘裕，所以 <1 就是剛好。
import { chromium } from 'playwright';
const b=await chromium.launch();
const max=new Map();
for (const [w,h] of [[1920,1080],[1440,900],[1280,800]]){
  const pg=await b.newPage({viewport:{width:w,height:h}});
  await pg.goto('http://localhost:8899/lunjian-layout.html'); await pg.waitForTimeout(2600);
  for (let g=0;g<7;g++){
    await pg.evaluate(n=>window.__LUNJIAN && document.querySelectorAll('.chapter')[n]
      && scrollTo({top:document.querySelectorAll('.chapter')[n].offsetTop+10,behavior:'instant'}), g);
    await pg.waitForTimeout(600);
    const rows=await pg.evaluate(()=>[...document.querySelectorAll('.foreground img, #stage img')]
      .map(i=>[i.src.split('/').pop(), Math.round(i.getBoundingClientRect().width), Math.round(i.getBoundingClientRect().height), i.naturalWidth, i.naturalHeight]));
    for (const [f,dw,dh,nw,nh] of rows){
      const cur=max.get(f)||[0,0,nw,nh];
      max.set(f,[Math.max(cur[0],dw),Math.max(cur[1],dh),nw,nh]);
    }
  }
  await pg.close();
}
const out=[...max.entries()].map(([f,[dw,dh,nw,nh]])=>({f,dw,dh,nw,nh,waste:(nw*nh)/Math.max(1,dw*dh*4)}))
  .sort((a,b)=>b.waste-a.waste);
for(const r of out) console.log(`${r.f.padEnd(28)} 原生 ${r.nw}x${r.nh}  最大顯示(2x內) ${r.dw}x${r.dh}  浪費 ${r.waste.toFixed(1)}x`);
await b.close();
