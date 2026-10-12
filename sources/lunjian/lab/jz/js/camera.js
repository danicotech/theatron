import * as T from 'jz/vendor/three.module.js';

// 七個固定機位。章與章之間是硬切（分鏡），不再插值滑行 ——
// 所以這裡沒有 lerp、沒有 damp、沒有穿門航點。
// p/a/f 的推導與框內必有必無的地標在 CAMERA.md §2、§3、§4。
// dolly = 章內沿視線軸的呼吸位移（0.033·throw，BRIEF D4「全章 ≤ 3–4%」）。
// hold = 指標視差的每格衰減（室外 1.0、室內 0.6）；**在呼叫端乘**，這裡只是把值帶著走。
const desktop = [
  {p:[0,1.2,93],    a:[0,6.4,55],    f:46, dolly:0.9, hold:1.0},  // 0 山門：z 81→93、fov 50→46。
                                                                    // 81 太近，門樓與欄杆把畫面塞滿；
                                                                    // 但退到 104 又會把後方那棟暗屋頂整個框進來，
                                                                    // 在副標後面變成一塊硬邊的黑。93 兩邊都避開。
  {p:[-1,2.7,66],   a:[-1,3.7,8],    f:48, dolly:1.9, hold:1.0},  // 1 戰帖（z 63→66 才看得到門楣）
  {p:[-12,13,30],   a:[-8,5,-15],    f:48, dolly:1.5, hold:1.0},  // 2 賽制
  {p:[0,3,20],      a:[0,3,-40],     f:48, dolly:2.0, hold:1.0},  // 3 對決（新：擂台側面平視）
  {p:[0,7.6,8],     a:[0,7.6,-36],   f:44, dolly:1.4, hold:0.6},  // 4 獎賞：原本 x=12 看向 x=8，
                                                                    // 夜鴉閣是斜的，四方朱印貼在斜屋頂上很怪。
                                                                    // 擺正對著門樓，印就站在對稱的立面前。
  {p:[0,6.4,-6],    a:[0,6.4,-38],   f:46, dolly:1.0, hold:0.6},  // 5 賽程：同理擺正，賽程樹是全寬的，
                                                                    // 底下再斜一個立面，兩套格線會打架。
  {p:[0,8,-13],     a:[0,8.5,-41],   f:48, dolly:0.9, hold:0.6}   // 6 報名：擺正，門要正對著人
];
const mobile = [
  {p:[0,-1.6,102],  a:[0,7.2,56.37], f:60, dolly:0.9, hold:1.0},  // 同理；a.y 2.34→7.2 讓寶頂不侵入大字帶
  {p:[0,2.5,65],    a:[0,3,7],       f:59, dolly:1.9, hold:1.0},
  {p:[0,13,28],     a:[0,1,-11],     f:59, dolly:1.35,hold:1.0},
  {p:[0,3.6,20],    a:[0,3.6,-40],   f:60, dolly:2.0, hold:1.0},  // 高 3.6 才讓腳線落在石環內
  {p:[8,9,10],      a:[0,10,-39],    f:57, dolly:1.6, hold:0.6},
  {p:[-8,8,4],      a:[0,9,-38],     f:57, dolly:1.4, hold:0.6},
  {p:[3,8,-14],     a:[0,10,-42],    f:56, dolly:0.9, hold:0.6}
];
const LAST = desktop.length - 1;
const smooth = x => x*x*(3-2*x);
const clamp01 = x => Math.max(0, Math.min(1, x));

export const SHOT_COUNT = desktop.length;
export function shotHold(i, isMobile){
  const t = (isMobile ? mobile : desktop)[Math.min(LAST, Math.max(0, i))];
  return t ? t.hold : 1;
}

export class CameraPath {
  constructor(camera){
    this.camera=camera; this.current=0; this.t=0;
    /* 入關時的推進量。1 = 還在機位後方，0 = 到位。
       旗燒完之後如果直接套上機位，畫面等於硬切上一張定格，看起來很卡。
       由呼叫端每幀遞減，鏡頭就是「浮進來」而不是「換到」。 */
    this.entry=0;
    this.point=new T.Vector3(); this.look=new T.Vector3(); this.dir=new T.Vector3();
  }
  // 只記格號。硬切沒有過渡，所以不需要 snap 旗標，也不需要阻尼。
  seek(value){ this.current=Math.min(LAST, Math.max(0, Math.round(value))); }
  shots(){ return this.camera.aspect<.85 ? mobile : desktop; }
  hold(){ const s=this.shots()[this.current]; return s ? s.hold : 1; }

  // frac = 這一格的章內進度 0..1（不是全站 progress）。
  update(frac, dt, mx=0, my=0){
    const s=this.shots()[this.current]; if(!s) return;
    this.t=clamp01(frac);
    this.point.fromArray(s.p); this.look.fromArray(s.a);
    // 呼吸：沿視線軸推進，兩端速度為 0，往回捲原路回到 0。看點不動。
    this.dir.subVectors(this.look,this.point).normalize();
    this.point.addScaledVector(this.dir, s.dolly*smooth(this.t));
    if(this.point.z>51){const floor=-4.75+T.MathUtils.clamp((74.4-this.point.z)/12.9,0,1)*4.75;this.point.y=Math.max(this.point.y,floor+1.9);}
    // 指標視差。hold 已由呼叫端乘過，這裡不再乘第二次（乘兩次室內會變 0.36）。
    if(mx||my){
      this.point.x+=mx*0.62; this.point.y+=my*0.34;
      this.look.x -=mx*0.20; this.look.y -=my*0.12;
      if(this.point.z>51){const floor=-4.75+T.MathUtils.clamp((74.4-this.point.z)/12.9,0,1)*4.75;this.point.y=Math.max(this.point.y,floor+1.9);}
    }
    // 入關的推進：沿視線軸往後退，越接近 0 越回到機位。
    // 同時抬高一點點，收尾時是往前下方沉進去，不是平推。
    if(this.entry>0.0005){
      const e=this.entry*this.entry;            // 尾段放慢
      this.point.addScaledVector(this.dir,-e*15);
      this.point.y+=e*3.2;
    }
    this.camera.position.copy(this.point); this.camera.lookAt(this.look);
    this.camera.fov=s.f; this.camera.updateProjectionMatrix();
  }
  opening(){ this.seek(0); this.update(0,1); }
}
