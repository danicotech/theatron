import {createInkTransition} from './ink-transitions.js';

export function mountHomeReturn({navigate,prefetch},signal){
  let active=null;
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finish=()=>{
    if(!active)return;
    cancelAnimationFrame(active.raf);clearTimeout(active.timeout);
    active.renderer?.dispose();active.canvas.remove();active=null;
    document.documentElement.removeAttribute('data-home-transition');
  };
  signal.addEventListener('abort',finish,{once:true});
  addEventListener('pagehide',finish,{signal});
  addEventListener('popstate',finish,{signal});
  const reveal=()=>{
    const job=active;
    if(!job||!job.navigated||job.revealing)return;
    job.revealing=true;clearTimeout(job.timeout);
    const start=performance.now();
    const frame=now=>{
      if(active!==job)return;
      const p=reduced()?1:Math.min(1,(now-start)/650);
      job.renderer?.render(.51+p*.49);
      if(p<1)job.raf=requestAnimationFrame(frame);
      else{finish();document.querySelector('.home-actions a')?.focus({preventScroll:true});}
    };
    job.raf=requestAnimationFrame(frame);
  };
  document.addEventListener('lunjian:home-ready',reveal,{signal});
  document.addEventListener('click',e=>{
    const link=e.target.closest?.('a.brand');
    if(!link||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.altKey||e.shiftKey)return;
    const url=new URL(link.href,location.href);
    if(url.origin!==location.origin||url.pathname!=='/home')return;
    e.preventDefault();
    if(active||location.pathname==='/home')return;
    const href=url.pathname+url.search;
    prefetch(href);
    const canvas=document.createElement('canvas');
    canvas.id='home-return-ink';canvas.setAttribute('aria-hidden','true');
    canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:99999;pointer-events:auto';
    document.body.append(canvas);
    const renderer=reduced()?null:createInkTransition(canvas,{style:'flow'});
    if(!renderer)canvas.style.background='var(--ink, #0b151d)';
    const job={canvas,renderer,raf:0,timeout:0,navigated:false,revealing:false};
    active=job;document.documentElement.dataset.homeTransition='cover';
    const start=performance.now();
    const frame=now=>{
      if(active!==job)return;
      const p=reduced()?1:Math.min(1,(now-start)/500);
      renderer?.render(p*.5);
      if(p<1){job.raf=requestAnimationFrame(frame);return;}
      document.documentElement.dataset.homeTransition='hold';
      job.navigated=true;
      navigate(href);
      job.timeout=setTimeout(()=>{
        if(active!==job)return;
        document.querySelector('.baiye-home')?.setAttribute('data-scene-fallback','');
        document.dispatchEvent(new Event('lunjian:home-fallback'));
        reveal();
      },20000);
    };
    job.raf=requestAnimationFrame(frame);
  },{signal});
  document.addEventListener('keydown',e=>{
    if(active){e.preventDefault();e.stopImmediatePropagation();}
  },{signal,capture:true});
}
