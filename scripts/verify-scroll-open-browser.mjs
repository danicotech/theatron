import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/User/Documents/code/react-vite-erp/node_modules/playwright-core/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const results=[];
try{
 for(const width of [1055,375]){for(const member of [false,true]){
  const page=await browser.newPage({viewport:{width,height:884}});
  let eventId='';
  if(member){
   await page.goto('http://127.0.0.1:3000/sportsbook?mode=manage');
   await page.getByLabel('賽事名稱',{exact:true}).fill('首次展卷驗收');
   await page.getByRole('button',{name:'建立活動',exact:true}).click();
   await page.getByRole('heading',{name:'活動與報名名單'}).waitFor();
   eventId=new URL(page.url()).searchParams.get('event');
   await page.getByRole('button',{name:'檢視模式',exact:true}).click();
   await page.getByRole('button',{name:'我的參賽',exact:true}).click();
   await page.getByLabel('我已了解賽制與讓武原則',{exact:true}).check();
   await page.getByRole('button',{name:'登入／註冊後繼續',exact:true}).click();
   const auth=page.getByRole('dialog');await auth.getByRole('button',{name:'註冊',exact:true}).click();
   await auth.getByLabel('帳號',{exact:true}).fill('open-test');
   await auth.getByLabel('密碼',{exact:true}).fill('isolated-test-password');
   await auth.getByLabel('暱稱',{exact:true}).fill('展卷驗收會員');
   await auth.getByRole('button',{name:'註冊並領取 1,000 點',exact:true}).click();
   await auth.waitFor({state:'hidden'});
  }
  await page.goto(`http://127.0.0.1:3000/?stage=2d&intro=0${eventId?'&sportsEvent='+eventId:''}#register`);
  await page.waitForSelector('#register-cta[data-registration-entry]');
  await page.evaluate(()=>{
   window.openFrames=[];
   document.querySelector('#register-cta').addEventListener('click',()=>{
    const start=performance.now();
    const capture=()=>{
     const el=document.querySelector('[aria-label="報名書卷"]');
     if(el && !el.hidden){
      const c=el.closest('.chapter-sticky'),win=el.children[1],inner=win.firstElementChild;
      const y=node=>new DOMMatrix(getComputedStyle(node).transform).m42;
      window.openFrames.push({time:performance.now()-start,height:el.offsetHeight,measured:getComputedStyle(el).getPropertyValue('--scroll-height'),top:el.getBoundingClientRect().top,scroll:c.scrollTop,windowY:y(win),innerY:y(inner),rodY:y(el.lastElementChild),active:document.activeElement?.textContent?.slice(0,20)});
     }
     if(performance.now()-start<1600)requestAnimationFrame(capture);
    };requestAnimationFrame(capture);
   },{once:true});
  });
  await page.locator('#register-cta').click();
  await page.waitForTimeout(1800);
  const frames=await page.evaluate(()=>window.openFrames);
  results.push({width,member,frames});
  await page.screenshot({path:`docs/previews/registration-scroll-browser/open-${width}-${member}.png`});
  console.log(JSON.stringify({width,member,first:frames[0],last:frames.at(-1),maxScroll:Math.max(...frames.map(f=>f.scroll)),maxMismatch:Math.max(...frames.map(f=>Math.abs(f.windowY+f.innerY))),heights:[...new Set(frames.map(f=>f.height))]}));
  if(process.env.ASSERT_OPEN){
   assert.ok(frames.length>1&&frames.every(f=>f.scroll===0),'Opening must not auto-scroll the chapter');
   assert.equal(new Set(frames.map(f=>f.height)).size,1,'Full form height is ready before animation starts');
   assert.ok(frames.every(f=>Math.abs(f.windowY+f.innerY)<2),'Paper and window must move together');
  }
  await page.close();
 }}
 await writeFile('docs/previews/registration-scroll-browser/open-frames.json',JSON.stringify(results,null,2));
}finally{await browser.close();}
