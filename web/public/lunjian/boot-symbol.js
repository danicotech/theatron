// Selected D3 "疏影越月" and A loader. Canvas strokes only; progress comes from the native meter.
export function createBootSymbol(boot, signal) {
  if (!boot || signal?.aborted) return () => {};
  const mark = boot.querySelector('.boot-mark'), bar = boot.querySelector('.boot-plume');
  const meter = boot.querySelector('#load-progress');
  if (!mark || !bar || !meter) return () => {};
  const mc = mark.getContext('2d'), bc = bar.getContext('2d');
  if (!mc || !bc) return () => {};
  const styles = getComputedStyle(boot);
  const ink = styles.getPropertyValue('--text-loading').trim();
  const gold = styles.getPropertyValue('--accent-loading').trim();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let start = performance.now(), frame = 0, disposed = false, wasLoading = false;
  let mw = 0, mh = 0, bw = 0, bh = 0;
  const paths = [], add = (pts,color=ink,width=1.2,alpha=1) => paths.push({pts,color,width,alpha});
function line(ctx,points,p=1,color=ink,width=1.3,alpha=1){if(p<=0)return;ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.globalAlpha=alpha;ctx.lineJoin='miter';ctx.lineCap='butt';let total=0;for(let i=1;i<points.length;i++)total+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);let remain=total*Math.min(p,1);ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++){let a=points[i-1],b=points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(remain>=len){ctx.lineTo(...b);remain-=len}else{ctx.lineTo(a[0]+(b[0]-a[0])*remain/len,a[1]+(b[1]-a[1])*remain/len);break}}ctx.stroke();ctx.restore()}
function arc(x,y,r,a,b,n=72){return Array.from({length:n+1},(_,i)=>{let t=(a+(b-a)*i/n)*Math.PI/180;return[x+r*Math.cos(t),y+r*Math.sin(t)]})}
function bez(a,b,c,d,n=24){return Array.from({length:n+1},(_,i)=>{let t=i/n,u=1-t;return[u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]})}
 // Preserve the approved D moon, mountain and axes.
 add(arc(150,142,99,-141,141),gold,1.1);
 add(arc(150,142,108,150,327),ink,.9,.85);
 add([[68,195],[110,141],[135,167],[164,119],[224,195]],ink,1.2);
 add([[164,119],[164,163],[181,181]],gold,.8);
 add([[150,21],[150,37]],gold,.8);add([[150,249],[150,269]],gold,.8);
 add([[150,11],[154,16],[150,21],[146,16],[150,11]],ink,.75);
 add([[120,211],[203,211]],gold,.65,.6);
 // Five distinct, lightly faceted petals; unequal depth avoids a radial icon.
 const bloom=(x,y,r,rotation=0)=>{
   const pts=[],sizes=[1,.86,1.04,.91,.96];
   const turn=(u,v)=>[x+r*(u*Math.cos(rotation)-v*Math.sin(rotation)),y+r*(u*Math.sin(rotation)+v*Math.cos(rotation))];
   for(let j=0;j<5;j++){
     const a=-Math.PI/2+j*Math.PI*2/5, radial=(rr,aa)=>turn(rr*Math.cos(aa),rr*Math.sin(aa));
     const petal=bez(radial(.33,a-.57),radial(1.42*sizes[j],a-.56),radial(1.30*sizes[j],a+.50),radial(.33,a+.61),14);
     pts.push(...petal);
   }
   pts.push(pts[0]);add(pts,ink,.95);
   for(let j=0;j<5;j++){
     const a=j*1.256-.9,p=turn(.11*Math.cos(a),.11*Math.sin(a)),q=turn(.38*Math.cos(a),.38*Math.sin(a));
     add([p,q],gold,.6);add(arc(q[0],q[1],.55,0,300,8),gold,.55);
   }
 };
 const bud=(x,y,r,rot)=>{
   const tr=(u,v)=>[x+u*Math.cos(rot)-v*Math.sin(rot),y+u*Math.sin(rot)+v*Math.cos(rot)];
   add([...bez(tr(0,r),tr(-r*1.1,0),tr(-r*.6,-r),tr(0,-r*1.4)),...bez(tr(0,-r*1.4),tr(r*.9,-r*.6),tr(r,.6*r),tr(0,r))],ink,.8);
   add([tr(-r*.55,r*.25),tr(0,r),tr(r*.5,r*.1)],gold,.6);
 };

   // A long fine sprig crosses the lunar edge, balancing the left-hand open arc.
   add([[183,238],[206,218],[221,195],[237,177],[257,151],[263,147]],ink,1.2);
   add([[188,238],[211,219],[225,199]],gold,.6,.7);
   add([[220,197],[202,190],[195,177]],ink,.8);
   add([[237,178],[254,180],[267,172]],ink,.8);
   add([[207,217],[229,217],[238,210]],ink,.75);
   bloom(269,140,10,-.16);bloom(190,171,8.5,.38);bud(270,168,3,.5);bud(241,208,2.8,.8);

  function size(canvas,ctx) {
    const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);return [r.width,r.height];
  }
  function render(now) {
    if(disposed || !mw || !bw) return;
    const active=boot.dataset.state==='loading', animate=active&&!reduced.matches;
    const t=now-start,p=Math.max(0,Math.min(1,Number(meter.value)/100));
    mc.clearRect(0,0,mw,mh);mc.save();mc.scale(mw/300,mh/300);
    paths.forEach((path,i)=>line(mc,path.pts,animate?Math.max(0,Math.min(1,(t-i*55)/1200)):1,path.color,path.width,path.alpha));
    mc.restore();bc.clearRect(0,0,bw,bh);bc.save();bc.scale(bw/570,bh/90);
    line(bc,[[2,45],[568,45]],1,ink,.65,.16);
    line(bc,[[2,45],[568,45]],p,gold,1.2);
    for(let i=0;i<12;i++) {
      const x=35+i*(485/11),u=x/568;
      const draw=p===1?1:Math.max(0,Math.min(1,(p-u+.09)/.13));
      const sway=animate?Math.sin(t/950-i*.42)*2:0,h=10+16*Math.sin(u*Math.PI);
      line(bc,[[x,45],[x+26,45-h+sway],[x+47,45]],draw,ink,1,.85);
      line(bc,[[x,45],[x+24,45+h-sway],[x+47,45]],draw,ink,.85,.62);
    }
    if(animate) {
      const q=(t%2300)/2300;
      line(bc,[[q*530,45],[q*530+18,45]],1,ink,1.7,Math.sin(q*Math.PI)*.7);
    }
    bc.restore();
  }
  function tick(now) {frame=0;render(now);if(!disposed&&!document.hidden&&!boot.hidden&&boot.dataset.state==='loading'&&!reduced.matches)frame=requestAnimationFrame(tick);}
  function refresh() {
    if(disposed)return;
    cancelAnimationFrame(frame);frame=0;
    const loading=!boot.hidden&&boot.dataset.state==='loading';
    if(loading&&!wasLoading)start=performance.now();
    wasLoading=loading;
    if(boot.hidden||document.hidden)return;
    [mw,mh]=size(mark,mc);[bw,bh]=size(bar,bc);
    render(performance.now());
    if(loading&&!reduced.matches)frame=requestAnimationFrame(tick);
  }
  const observer=new MutationObserver(refresh);
  observer.observe(boot,{attributes:true,attributeFilter:['hidden','data-state']});
  observer.observe(meter,{attributes:true,attributeFilter:['value']});
  const resize=new ResizeObserver(refresh);resize.observe(mark);resize.observe(bar);
  document.addEventListener('visibilitychange',refresh);
  reduced.addEventListener('change',refresh);
  function destroy() {
    if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();
    document.removeEventListener('visibilitychange',refresh);reduced.removeEventListener('change',refresh);
    signal?.removeEventListener('abort',destroy);
  }
  signal?.addEventListener('abort',destroy,{once:true});refresh();return destroy;
}
