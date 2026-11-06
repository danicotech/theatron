import * as THREE from 'three';
import { createBurnField, type BurnPigments } from './paperBurn';

export const FIRE_STYLES = [
  {
    id: 'A',
    title: '薄紙細焰',
    detail: '薄而透光的火舌，細小分岔，煙量較輕。',
    height: 72,
    wind: 0.08,
    smoke: 0.3,
    strength: 0.9,
    turbulence: 1.1,
  },
  {
    id: 'B',
    title: '厚紙旺焰',
    detail: '較厚的亮焰核心，火舌交疊，黑煙向上翻捲。',
    height: 124,
    wind: 0.1,
    smoke: 0.68,
    strength: 1.3,
    turbulence: 0.8,
  },
  {
    id: 'C',
    title: '側風捲焰',
    detail: '火焰偏向右上，拉長後斷裂，煙與火同向流動。',
    height: 108,
    wind: 0.75,
    smoke: 0.48,
    strength: 1.05,
    turbulence: 1.45,
  },
  {
    id: 'D',
    title: '低焰餘燼',
    detail: '短促火苗與暗紅餘燼，焦化較明顯，保留灰煙。',
    height: 40,
    wind: -0.12,
    smoke: 0.52,
    strength: 0.67,
    turbulence: 0.65,
  },
] as const;
export type FireStyle = (typeof FIRE_STYLES)[number];

const vertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const fragment = `
precision highp float;
varying vec2 vUv;
uniform sampler2D arrivalMap, paperMap;
uniform vec4 fieldBox;
uniform vec2 viewport;
uniform float progress, time, flameHeight, wind, smokeAmount, strength, turbulence, paperVisible, effectFade;
uniform vec3 soot, smokeColor, ember, flameColor, core;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p), f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.57+noise(p*2.03+17.)*.28+noise(p*4.09+31.)*.15;}
float distanceToFire(vec2 p){
 vec2 uv=(p-fieldBox.xy)/fieldBox.zw;
 vec4 c=texture2D(arrivalMap,uv);
 float a=(c.r*65280.+c.g*255.)/65535.*2.;
 return clamp((a-progress)/max(c.b*.04,.0001),-300.,300.);
}
void main(){
 vec2 p=vec2(vUv.x,1.-vUv.y)*viewport;
 float scale=viewport.y/360.;
 float fine=noise(p*1.8);
 float d=distanceToFire(p)+(fine-.5)*1.4*scale;
 float substrate=smoothstep(-.8,.8,d);
 float paperAlpha=substrate;
 vec3 paper=texture2D(paperMap,vUv).rgb;
 float charMask=(1.-smoothstep(0.,7.*scale,d))*paperAlpha;
 // Uneven carbonization belongs to the paper, with no stroked contour.
 paper=mix(paper,soot,charMask*(.55+noise(p*.13)*.42));
 float glow=exp(-abs(d)/(1.15*scale))*smoothstep(.48,.8,noise(p*.12+time*.7))*step(.01,progress);
 paper+=ember*glow*.65;
 if(paperVisible<.5){
   paperAlpha=charMask*.55*smoothstep(.32,.76,noise(p*.12));
   paper=soot+ember*glow;
 }
 float flame=0., rise=0., smoke=0.;
 float burnActive=smoothstep(0.,.025,progress)*(1.-smoothstep(1.,1.18,progress));
 float height=flameHeight*scale;
 // Advect coherent structures upward. The same flow warps every sample,
 // so flame sheets join and tear instead of appearing as unrelated glowing dots.
 vec2 flow=vec2(p.x/(25.*scale),p.y/(35.*scale)+time*3.1);
 float n=fbm(flow);
 float curl=(fbm(flow*.7+12.)-.5)*22.*scale*turbulence;
 float previous=distanceToFire(p);
 for(int i=1;i<=20;i++){
   float h=float(i)/20.;
   vec2 q=p+vec2(-wind*height*h+curl*h,height*h);
   float current=distanceToFire(q);
   if(previous*current<=0.){
     float crossing=(float(i-1)+abs(previous)/max(abs(previous)+abs(current),.001))/20.;
     float flowNoise=fbm(vec2(p.x/(13.*scale)+curl/(21.*scale),p.y/(31.*scale)+time*3.8));
     float wisps=fbm(vec2(p.x/(5.*scale),p.y/(18.*scale)+time*5.));
     float fuelPatch=smoothstep(.22,.72,fbm(q/(vec2(31.,47.)*scale)+vec2(time*.24,0.)));
     float density=(pow(1.-crossing,1.1)*(.24+flowNoise*.92)-crossing*.32-(1.-wisps)*.18)*(.18+fuelPatch*.95);
     if(density>flame){flame=density;rise=crossing;}
   }
   previous=current;
 }
 flame=max(0.,flame)*strength*burnActive;
 float flameAlpha=smoothstep(.045,.49,flame)*.88;
 float temperature=clamp(flame*.94+(1.-rise)*.08,0.,1.);
 vec3 fire=mix(ember,flameColor,smoothstep(.05,.4,temperature));
 fire=mix(fire,core,pow(smoothstep(.35,.98,temperature),1.8));
 // Wider, slower, absorbing soot above the flame; no additive grey discs.
 for(int i=1;i<=9;i++){
   float h=float(i)/9.;
   vec2 q=p+vec2(-wind*height*h*1.8+(n-.5)*45.*scale,height*(.3+h*1.6));
   float fuel=exp(-abs(distanceToFire(q))/(12.*scale));
   float cloud=fbm(vec2(p.x/(52.*scale)+h,p.y/(48.*scale)+time*.85));
   smoke=max(smoke,fuel*(1.-h)*smoothstep(.23,.72,cloud));
 }
 float smokeAlpha=clamp(smoke*smokeAmount*burnActive,0.,.7);
 vec3 smokeTint=mix(soot,smokeColor,n*.65);
 // Straight-alpha compositing, preserving both flame translucency and dark smoke.
 vec3 rgb=paper*paperAlpha;
 float alpha=paperAlpha;
 rgb=smokeTint*smokeAlpha+rgb*(1.-smokeAlpha);alpha=smokeAlpha+alpha*(1.-smokeAlpha);
 rgb=fire*flameAlpha+rgb*(1.-flameAlpha);alpha=flameAlpha+alpha*(1.-flameAlpha);
 // Sparse hot flecks lifted by the same updraft. Most remain dark ash.
 vec2 ashP=p/scale+vec2(-time*wind*22.,time*42.);
 vec2 cell=floor(ashP/28.);vec2 local=fract(ashP/28.);
 float seed=hash(cell);float speck=1.-smoothstep(.025,.06,length(local-vec2(seed,hash(cell+4.))));
 float ash=speck*step(.962,seed)*burnActive*(1.-paperAlpha)*.6;
 rgb=mix(rgb,mix(smokeColor,core,step(.99,seed)),ash);alpha=max(alpha,ash);
 if(alpha<.001)discard;
 gl_FragColor=vec4(rgb/max(alpha,.001),alpha*effectFade);
}`;

/** One material shared by the selected D preview and the production particle scene. */
export function createFireSheet(
  width: number,
  height: number,
  colors: BurnPigments,
  style: FireStyle,
  field: ReturnType<typeof createBurnField>,
  paper?: THREE.Texture,
) {
  const placeholder = paper ?? new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  placeholder.needsUpdate = true;
  const color = (name: keyof BurnPigments) => new THREE.Color(colors[name]).convertLinearToSRGB();
  const uniforms = {
    arrivalMap: { value: new THREE.DataTexture(new Uint8Array(4), 1, 1) },
    paperMap: { value: placeholder },
    fieldBox: { value: new THREE.Vector4() },
    viewport: { value: new THREE.Vector2(width, height) },
    progress: { value: -1 },
    time: { value: 0 },
    flameHeight: { value: style.height },
    wind: { value: style.wind },
    smokeAmount: { value: style.smoke },
    strength: { value: style.strength },
    turbulence: { value: style.turbulence },
    paperVisible: { value: paper ? 1 : 0 },
    effectFade: { value: 1 },
    soot: { value: color('soot') },
    smokeColor: { value: color('smoke') },
    ember: { value: color('char') },
    flameColor: { value: color('flame') },
    core: { value: color('core') },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  const setField = (field: ReturnType<typeof createBurnField>) => {
    const step = field.points[1]!.x - field.points[0]!.x;
    const cols = field.points.findIndex((p) => p.y !== field.points[0]!.y);
    const rows = field.points.length / cols;
    const data = new Uint8Array(cols * rows * 4);
    field.arrival.forEach((a, i) => {
      const value = Math.round((Math.min(2, a) / 2) * 65535);
      data[i * 4] = value >> 8;
      data[i * 4 + 1] = value & 255;
      const x = i % cols,
        y = Math.floor(i / cols);
      const dx =
        (field.arrival[y * cols + Math.min(cols - 1, x + 1)]! -
          field.arrival[y * cols + Math.max(0, x - 1)]!) /
        (2 * step);
      const dy =
        (field.arrival[Math.min(rows - 1, y + 1) * cols + x]! -
          field.arrival[Math.max(0, y - 1) * cols + x]!) /
        (2 * step);
      data[i * 4 + 2] = Math.round(Math.min(1, Math.hypot(dx, dy) / 0.04) * 255);
      data[i * 4 + 3] = 255;
    });
    uniforms.arrivalMap.value.dispose();
    const map = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat);
    map.minFilter = map.magFilter = THREE.LinearFilter;
    map.needsUpdate = true;
    uniforms.arrivalMap.value = map;
    uniforms.fieldBox.value.set(
      field.points[0]!.x - step / 2,
      field.points[0]!.y - step / 2,
      cols * step,
      rows * step,
    );
  };
  setField(field);
  return {
    mesh,
    setField,
    update(progress: number, time: number, fade = 1) {
      uniforms.progress.value = progress;
      uniforms.time.value = time;
      uniforms.effectFade.value = fade;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      uniforms.arrivalMap.value.dispose();
      if (!paper) placeholder.dispose();
    },
  };
}
