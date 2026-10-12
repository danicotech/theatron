export function createHomeIntro(host, canvas, signal, onEnter){
  const boot=host.querySelector('#boot'),button=boot.querySelector('#ignite');
  const background=[...host.querySelectorAll('.site-header,main')];
  const cleanups=[];
  import('/lunjian/boot-symbol.js?v=b5718e17a607').then(({createBootSymbol})=>{if(!signal.aborted&&!destroyed)cleanups.push(createBootSymbol(boot,signal));}).catch(()=>{});
  let action=null,timer=0,decodeTimer=0,entered=false,destroyed=false;
  const state={shown:0,shot:0,frac:0,mx:0,my:0};
  const setInert=value=>background.forEach(element=>{element.inert=value;});
  const progress=(value,label)=>{
    boot.querySelector('#load-progress').value=value;
    boot.querySelector('#load-number').textContent=String(value);
    boot.querySelector('#load-label').textContent=label;
  };
  const enter=()=>{
    if(entered||signal.aborted)return;
    entered=true;action=null;clearTimeout(timer);
    try{sessionStorage.setItem('lunjian:opening-seen:v1','1');}catch{}
    boot.hidden=true;setInert(false);document.body.removeAttribute('data-intro');
    host.querySelector('.home-actions a')?.focus({preventScroll:true});
    onEnter();
  };
  const begin=()=>{
    if(signal.aborted)return;
    document.body.dataset.intro='curtain';setInert(true);boot.hidden=false;
    boot.dataset.state='loading';button.disabled=true;
    boot.querySelector('.boot-loading').removeAttribute('aria-hidden');
    progress(0,'展開江湖');boot.focus({preventScroll:true});
  };
  const ready=ignite=>{
    if(signal.aborted||entered)return;
    action=ignite;progress(100,'江湖已開');boot.dataset.state='ready';
    boot.querySelector('.boot-loading').setAttribute('aria-hidden','true');
    button.disabled=false;button.focus({preventScroll:true});
  };
  const burning=()=>{boot.dataset.state='burning';button.disabled=true;boot.focus({preventScroll:true});};
  button.addEventListener('click',event=>{if(!button.disabled)action?.(event);},{signal});
  boot.addEventListener('keydown',event=>{
    if(event.key==='Tab'){event.preventDefault();(button.disabled?boot:button).focus();}
  },{signal});
  const fallback=async()=>{
    if(state.fallbackStarted||entered||signal.aborted)return;
    state.fallbackStarted=true;host.removeAttribute('data-scene');
    document.body.dataset.stage='2d';boot.dataset.fallback='';progress(85,'迎候來者');
    await Promise.race([
      Promise.all([...boot.querySelectorAll('img')].map(img=>img.decode?.().catch(()=>{}))),
      new Promise(resolve=>{decodeTimer=setTimeout(resolve,5000);})
    ]);
    clearTimeout(decodeTimer);
    ready(event=>{
      if(boot.dataset.state!=='ready')return;
      if(event.detail){boot.style.setProperty('--fire-x',event.clientX/innerWidth*100+'%');boot.style.setProperty('--fire-y',event.clientY/innerHeight*100+'%');}
      burning();timer=setTimeout(enter,5200);
    });
  };
  const destroy=()=>{
    if(destroyed)return;destroyed=true;entered=true;
    clearTimeout(timer);clearTimeout(decodeTimer);action=null;boot.hidden=true;setInert(false);
    document.body.removeAttribute('data-intro');document.body.removeAttribute('data-stage');
    cleanups.splice(0).forEach(cleanup=>cleanup());
    delete window.__stage3d;
  };
  signal.addEventListener('abort',destroy,{once:true});
  begin();
  return {S:state,canvas,lifetime:{signal},cleanups,beginIntro:begin,introProgress:progress,
    readyIntro:ready,burningIntro:burning,prepareFallback:fallback,enterStage:enter,
    applyGrid(){},destroy};
}
