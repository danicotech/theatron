/** Shared ink study + production renderer. Bounded 2D raster, no framework/GPU dependency. */
export const INK_STYLES = Object.freeze({
 bloom: {name:'滴墨生花', caption:'落筆一點，濕邊沿紙纖維緩緩擴散。', duration:2800, cover:.46},
 flow: {name:'游墨行雲', caption:'游墨水痕斜入，再由中央暈開，徐徐展出漫畫。', duration:3200, cover:.46},
 mist: {name:'煙嵐散墨', caption:'薄墨多層交疊，輕柔地化入下一幕。', duration:3600, cover:.46},
});
export function resolveInkStyle(value){ return Object.hasOwn(INK_STYLES,value) ? value : 'flow'; }
const clamp = v => Math.max(0,Math.min(1,v));
const ease = v => {v=clamp(v); return v*v*(3-2*v);};
const hash = (x,y) => {const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v);};
function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=ease(x-ix),fy=ease(y-iy);return (hash(ix,iy)*(1-fx)+hash(ix+1,iy)*fx)*(1-fy)+(hash(ix,iy+1)*(1-fx)+hash(ix+1,iy+1)*fx)*fy;}
function fbm(x,y){return noise(x,y)*.54+noise(x*2.03,y*2.03)*.28+noise(x*4.11,y*4.11)*.13+noise(x*8.31,y*8.31)*.05;}
export function inkPhase(progress,style='flow'){
 const config=INK_STYLES[resolveInkStyle(style)],p=clamp(progress);
 return {cover:clamp(p/config.cover),reveal:clamp((p-.51)/.49),swap:p>=config.cover,done:p>=1};
}
/** Field is generated once. Frame work is only interpolation + raster alpha/color. */
export function makeInkField(width,height,style){
 const count=width*height,field=new Float32Array(count),revealField=new Float32Array(count),pigment=new Float32Array(count),fiber=new Float32Array(count);
 const aspect=width/height;let min=Infinity,max=-Infinity,revealMin=Infinity,revealMax=-Infinity;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x,u=x/width,v=y/height;
  const wx=fbm(u*3.1+7,v*3.1)-.5,wy=fbm(u*3.1+32,v*3.1+12)-.5;
  const a=u+wx*.24,b=v+wy*.22,n=fbm(a*6.4,b*6.4);
  let d;
  if(style==='bloom')d=Math.min(Math.hypot((a-.43)*aspect,b-.49),Math.hypot((a-.62)*aspect,b-.37)+.12)+n*.16;
  else if(style==='mist')d=(a*.44+b*.56)+Math.sin(a*5.4-b*4.1)*.13+wx*.24+n*.2;
  else d=a*.65+b*.35+Math.sin(b*6.1+a*2.3)*.15+wx*.22+n*.16;
  field[i]=d;min=Math.min(min,d);max=Math.max(max,d);
  // B combines its flowing cover with A's center-out manga reveal.
  const rd=style==='flow' ? Math.min(Math.hypot((a-.43)*aspect,b-.49),Math.hypot((a-.62)*aspect,b-.37)+.12)+n*.16 : d;
  revealField[i]=rd;revealMin=Math.min(revealMin,rd);revealMax=Math.max(revealMax,rd);
  pigment[i]=fbm(a*8+wx*3,b*8+wy*3);
  fiber[i]=noise(u*210,v*290);
 }
 for(let i=0;i<count;i++){
  field[i]=.09+(field[i]-min)/(max-min)*.80;
  revealField[i]=.09+(revealField[i]-revealMin)/(revealMax-revealMin)*.80;
 }
 return {width,height,field,revealField,pigment,fiber};
}
export function createInkTransition(canvas,{style='flow'}={}){
 const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)return null;
 let kind=resolveInkStyle(style),map=null,pixels=null,disposed=false,lastWidth=0,lastHeight=0;
 function resize(width,height){
  let w=Math.min(420,Math.max(180,Math.round(width*.36))),h=Math.max(100,Math.round(w*height/width));
  const shrink=Math.min(1,Math.sqrt(140000/(w*h)));w=Math.round(w*shrink);h=Math.round(h*shrink);
  if(w===lastWidth&&h===lastHeight)return;
  canvas.width=w;canvas.height=h;lastWidth=w;lastHeight=h;
  map=makeInkField(w,h,kind);pixels=ctx.createImageData(w,h);
 }
 function setStyle(next){kind=resolveInkStyle(next);lastWidth=0;}
 function render(progress){
  if(disposed)return;
  const r=canvas.getBoundingClientRect();resize(r.width||800,r.height||500);
  const phase=inkPhase(progress,kind);
  if(progress<=0||progress>=1){ctx.clearRect(0,0,canvas.width,canvas.height);return;}
  const c=ease(phase.cover),v=ease(phase.reveal),data=pixels.data;
  const wet=kind==='mist'?.21:kind==='flow'?.11:.085;
  for(let i=0;i<map.field.length;i++){
   // Front is domain-warped and graded; the diffuse halo precedes the pigment.
   const d=map.field[i],grain=map.pigment[i],f=map.fiber[i];
   const revealWet=kind==='flow'?.085:wet;
   const cover=ease((c-d+wet)/wet),opening=phase.reveal<=0?0:ease((v-map.revealField[i]+revealWet*.8)/(revealWet*1.1));
   const alpha=cover*(1-opening);
   const front=Math.exp(-Math.pow((c-d)/(.055+wet*.5),2));
   const tide=Math.exp(-Math.pow((c-d-.012)/.027,2))*.09;
   const settling=(1-ease((phase.cover-.63)/.37))*(1-v);
   const stain=clamp((.24+grain*.61+front*.20+tide)*settling+grain*.025*(1-v));
   const light=(1-stain)*(kind==='mist'?.94:1),j=i*4;
   data[j]=Math.round(22+light*220+(f-.5)*3);
   data[j+1]=Math.round(25+light*214+(f-.5)*3);
   data[j+2]=Math.round(24+light*205+(f-.5)*3);
   data[j+3]=Math.round(alpha*255);
  }
  ctx.putImageData(pixels,0,0);
 }
 function dispose(){disposed=true;map=null;pixels=null;canvas.width=1;canvas.height=1;}
 return {render,setStyle,prepare:resize,dispose};
}
