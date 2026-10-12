export async function mountHomeStage(canvas, signal){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const host=canvas?.closest('.baiye-home');
  let readySent=false,stopped=false;
  const ready=()=>{
    if(readySent||signal.aborted)return;
    readySent=true;
    const images=Array.from(host?.querySelectorAll('img')||[]);
    Promise.allSettled(images.map(image=>image.decode?.())).then(()=>{
      if(!signal.aborted)document.dispatchEvent(new Event('lunjian:home-ready'));
    });
  };
  if(!canvas || signal.aborted)return;
  if(reduced.matches||host.hasAttribute('data-scene-fallback')){ready();return;}
  const query=new URLSearchParams(location.search);
  let openingSeen=false;
  try{openingSeen=sessionStorage.getItem('lunjian:opening-seen:v1')==='1';}catch{}
  const wantsIntro=!openingSeen&&!!host.querySelector('#boot')&&query.get('intro')!=='0';
  if(!wantsIntro&&query.get('stage')==='2d'){ready();return;}
  const layers=Array.from(host.querySelectorAll('[data-home-depth]'),element=>({
    element,depth:Number(element.dataset.homeDepth),side:Number(element.dataset.homeSide||0)
  }));
  let intro,introActive=false;
  let scene,raf=0,last=0,time=0,mx=0,my=0,aimX=0,aimY=0,titleX=0,titleY=0;
  let moonEnvironment,originalMoon,originalMoonDirection;
  const positionMoon=()=>{
    if(!moonEnvironment)return;
    const portrait=innerWidth/innerHeight<.85;
    moonEnvironment.moon.position.set(portrait?-34:-64,portrait?150:156,-148);
    moonEnvironment.sky.material.uniforms.uMoon.value.copy(moonEnvironment.moon.position).normalize();
  };
  const restoreMoon=()=>{
    if(!moonEnvironment)return;
    moonEnvironment.moon.position.copy(originalMoon);
    moonEnvironment.sky.material.uniforms.uMoon.value.copy(originalMoonDirection);
    moonEnvironment=null;
  };
  addEventListener('resize',positionMoon,{signal});
  const clean=()=>{restoreMoon();cancelAnimationFrame(raf);scene?.dispose();scene=null;intro?.destroy();host?.removeAttribute('data-scene');layers.forEach(({element})=>element.style.removeProperty('transform'));};
  document.addEventListener('lunjian:home-fallback',()=>{stopped=true;clean();ready();},{signal});
  signal.addEventListener('abort',clean,{once:true});
  addEventListener('pagehide',clean,{signal});
  const pause=()=>{cancelAnimationFrame(raf);raf=0;last=0;if(!document.hidden&&!reduced.matches&&!signal.aborted&&scene)raf=requestAnimationFrame(frame);};
  document.addEventListener('visibilitychange',pause,{signal});
  reduced.addEventListener('change',()=>{if(reduced.matches){clean();ready();}},{signal});
  addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;aimX=Math.max(-1,Math.min(1,e.clientX/innerWidth*2-1));aimY=Math.max(-1,Math.min(1,e.clientY/innerHeight*2-1));},{passive:true,signal});
  document.documentElement.addEventListener('pointerleave',()=>{aimX=aimY=0;},{signal});
  addEventListener('blur',()=>{aimX=aimY=0;},{signal});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();restoreMoon();cancelAnimationFrame(raf);scene?.dispose();scene=null;host.removeAttribute('data-scene');if(introActive)intro?.prepareFallback();},{signal});
  document.addEventListener('lunjian:home-handoff',()=>{
    if(!scene||introActive||signal.aborted)return;
    restoreMoon();
    const sharedScene=scene;scene=null;cancelAnimationFrame(raf);
    window.__LUNJIAN_SCENE_TRANSFER?.dispose();
    canvas.id='world-transfer';
    canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;opacity:1;z-index:2;pointer-events:none';
    document.body.append(canvas);
    let consumed=false;
    const discard=()=>{
      if(consumed)return;
      consumed=true;clearTimeout(expiry);sharedScene.dispose();canvas.remove();host.removeAttribute('data-scene');
      if(window.__LUNJIAN_SCENE_TRANSFER===transfer)delete window.__LUNJIAN_SCENE_TRANSFER;
      removeEventListener('pagehide',discard);
    };
    const expiry=setTimeout(discard,15000);
    const transfer={
      take(placeholder){
        if(consumed||!placeholder)return null;
        consumed=true;clearTimeout(expiry);removeEventListener('pagehide',discard);
        canvas.id=placeholder.id;canvas.className=placeholder.className;canvas.style.cssText='';
        placeholder.replaceWith(canvas);delete window.__LUNJIAN_SCENE_TRANSFER;
        return sharedScene;
      },
      dispose:discard
    };
    window.__LUNJIAN_SCENE_TRANSFER=transfer;
    addEventListener('pagehide',discard,{once:true});
  },{signal});
  function frame(now){
    if(signal.aborted||stopped||reduced.matches||document.hidden||!scene)return;
    const dt=last?Math.min((now-last)/1000,.05):0;last=now;time+=dt;
    if(introActive){intro.S.render3d?.(now,dt*1000);raf=requestAnimationFrame(frame);return;}
    const path=window.__JZ3D?.path;
    if(path?.entry>0)path.entry=Math.max(0,path.entry-dt/2.6);
    const progress=(1-Math.cos(time/11))/2;
    const blend=1-Math.exp(-dt*7);
    mx+=(aimX-mx)*blend;my+=(aimY-my)*blend;
    const titleBlend=1-Math.exp(-dt*3);
    titleX+=(aimX-titleX)*titleBlend;titleY+=(aimY-titleY)*titleBlend;
    scene.render(time,1,progress,dt,0,mx*2.4,my*2.4,1);
    const dolly=progress*progress*(3-2*progress);
    for(const {element,depth,side} of layers){
      if(element.hasAttribute('data-home-title')){
        element.style.transform=`translate3d(${(-titleX*8).toFixed(3)}px,${(-titleY*5).toFixed(3)}px,0) perspective(1000px) rotateX(${(titleY*1.4).toFixed(3)}deg) rotateY(${(-titleX*2.2).toFixed(3)}deg)`;
        continue;
      }
      const x=(-mx*28+side*dolly*10)*depth;
      const y=(-my*20+dolly*5)*depth;
      element.style.transform=`translate3d(${x.toFixed(3)}px,${y.toFixed(3)}px,0) scale(${(1+dolly*.035*depth).toFixed(5)})`;
    }
    host.dataset.scene='3d';ready();raf=requestAnimationFrame(frame);
  }
  try{
    if(wantsIntro){
      const {createHomeIntro}=await import('./home-intro.js');
      if(signal.aborted||reduced.matches)return;
      introActive=true;
      intro=createHomeIntro(host,canvas,signal,()=>{introActive=false;time=0;});
      const {mountStage3D}=await import('./stage3d.js');
      if(signal.aborted||reduced.matches){intro.destroy();return;}
      host.dataset.scene='3d';
      scene=await mountStage3D(intro);
    }else{
    const {createScene}=await import('jz/js/scene.js');
    if(signal.aborted||stopped)return;
    scene=await createScene(canvas);
    }
    if(!scene){if(!introActive)ready();return;}
    if(signal.aborted||stopped||reduced.matches){scene.dispose();if(reduced.matches)ready();return;}
    const environment=window.__JZ3D?.environment;
    if(environment?.moon?.position&&environment.sky?.material?.uniforms?.uMoon){
      moonEnvironment=environment;
      originalMoon=environment.moon.position.clone();
      originalMoonDirection=environment.sky.material.uniforms.uMoon.value.clone();
      positionMoon();
    }
    scene.seek(0);
    pause();
  }catch{
    scene?.dispose();scene=null;host.removeAttribute('data-scene');
    if(introActive&&!signal.aborted&&!reduced.matches)await intro.prepareFallback();
    else{clean();ready();}
  }
}
