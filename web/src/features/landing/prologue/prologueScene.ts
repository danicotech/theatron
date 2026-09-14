import {
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  type IUniform,
  type Texture,
} from 'three';

import type { PaletteKey } from '../../world3d/palette';
import { createWind, type WindField } from '../../world3d/wind';
import { linearOf } from '../palette';
import { BACKDROP_FRAG, CLOTH_FRAG, CLOTH_VERT } from './shaders';
import { createSilhouetteLayer } from './silhouette';
import { prologueState } from './stages';

/**
 * 序幕的場子:兩片、一台相機、一個進度數字。
 *
 * 為什麼是自己的 renderer 而不是掛進 world3d 的那一台:world3d 是**環境層**,
 * 由另一個人維護,而且它是整頁固定的一張畫布;序幕是章節 01 自己的一段戲,
 * 只在那一屏裡存在,離開視窗就該停。兩者的生命週期不一樣,硬塞進同一個
 * engine 會讓「誰負責 dispose」變成一件要協調的事。
 *
 * **但風是共用的。** `createWind()` 的 `windAt` 沒有任何亂數 —— 它是
 * (位置, 時間) 的純函式,所以兩邊各建一組 uniform、吃同一組預設參數、
 * 對同一個時鐘,得到的就是**同一陣風**。時鐘因此刻意用 `performance.now()`
 * 而不是累加 dt:累加會漂,漂了之後旗與竹子就各吹各的。
 *
 * 由後往前:月與遠霧 → 旗(3D 布)。**剪影沒有自己的一片** —— 它是布的
 * fragment 裡的一次貼圖取樣,因為皮影的影子就是「布上光被擋住的那一塊」,
 * 不是一個站在布前面或布後面的物件。裂口與血墨同理:它們是布本身的狀態,
 * 疊成圖層會讓裂口邊緣跟布的皺褶對不上。
 *
 * 字那一層不在這裡,它是 DOM。3D 不承載任何資訊(見 chapters.ts 開頭)。
 */

/** 相機的視角。窄一點,旗才有「被鏡頭挑出來」的感覺,而不是廣角記錄片。 */
const FOV = 38;

/** 旗的長寬比。旗是橫的,但直式視窗會壓縮它 —— 見 layout()。 */
const FLAG_ASPECT = 1.32;

/**
 * 布的細分。
 *
 * 220×150 不是為了幾何的精細度(位移只有幾公分),是為了**斜率**:
 * 直褶的空間頻率是 38 rad,一個週期只有六格多,再疏就會把褶整個平均掉,
 * 而剪影被推開的方向完全由那個斜率決定。
 */
const CLOTH_SEGMENTS: readonly [number, number] = [220, 150];

/**
 * 旗掛在世界座標的哪裡,以及它有多寬(公尺)。
 *
 * 風是位置的函式,所以旗必須有一個位置 —— 隨便給 (0,0) 的話它會剛好落在
 * 波的原點上,擺動比場上其他東西規律。這個位置是前庭,與 world3d 的場地平面圖
 * 同一套座標。
 */
const FLAG_ANCHOR: readonly [number, number] = [-3.4, 8.6];
const FLAG_SPAN_METRES = 3.2;

/**
 * 皮影那一組調好的參數。
 *
 * 它們是一起調出來的,單獨改一個沒有意義:燈小了就要把擴散調大,折射推得太遠
 * 影子會脫離人形。改之前先在實機上把五個分鏡格都看一遍。
 */
const LAMP_SIZE = 0.44;
const DIFFUSE = 0.0038;
const REFRACT = 0.012;
/** 剪影在布上佔多大。大於 1 是把素材縮小,留出布的邊。 */
/**
 * 剪影要佔**視窗**寬度的多少。
 *
 * 不是「佔布幕的多少」—— 布幕現在是 cover 的,它比視窗大,而且大多少隨著
 * 視窗的長寬比變。用布幕當基準的話,螢幕一寬人就跟著脹出畫面外。
 * 兩個人加上揮出去的袖與劍,0.72 是還留得住邊的上限。
 */
const SIL_VIEWPORT_SPAN = 0.72;

export interface PrologueSceneOptions {
  canvas: HTMLCanvasElement;
  /** 不想看到動的人走 DOM 的靜態海報,根本不會建這個場;留著只是防偏好在執行期改變。 */
  reduced: boolean;
  width: number;
  height: number;
  pixelRatio: number;
}

export interface PrologueScene {
  /** 刮到哪裡。0…1,可以來回。 */
  setProgress(p: number): void;
  resize(width: number, height: number): void;
  /** 畫一格。`now` 是秒,與環境層共用同一個時鐘(見上)。 */
  frame(dt: number, now: number): void;
  readonly painted: boolean;
  dispose(): void;
}

function colour(key: PaletteKey): { value: Vector3 } {
  const [r, g, b] = linearOf(key);
  return { value: new Vector3(r, g, b) };
}

export function createPrologueScene(options: PrologueSceneOptions): PrologueScene {
  const renderer = new WebGLRenderer({
    canvas: options.canvas,
    antialias: false,
    alpha: true,
    stencil: false,
    depth: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(options.pixelRatio);
  renderer.setSize(options.width, options.height, false);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, options.width / options.height, 0.1, 60);
  camera.position.set(0, 0, 3.4);

  const wind: WindField = createWind();
  const aspect = new Vector2(1, 1);

  // 兩道身影。素材是離屏 canvas 上的貼圖,整幕只重畫五次(見 silhouette.ts)。
  const silhouette = createSilhouetteLayer({
    instant: options.reduced,
    anisotropy: renderer.capabilities.getMaxAnisotropy(),
  });

  // 素材的長寬比不等於布的,直接鋪上去人會被拉長。這一項把它擺回原本的比例:
  // 以寬對齊,垂直方向補回差的那一截。
  const silFit = new Vector2(1, FLAG_ASPECT / silhouette.aspect);
  // 每次 layout 都會改,所以它跟其他會變的 uniform 一樣建一次就不再換物件。
  const silScale = { value: SIL_VIEWPORT_SPAN };

  // uniform 物件建一次就一直是同一個。每格重新配一份 { value } 是這種迴圈最常見的
  // 垃圾來源 —— 一分鐘六十格,十個 uniform 就是三萬六千個短命物件。
  // uTime 直接用風場那一個:整個序幕只有一個時鐘,而那個時鐘是共用的。
  const shared = {
    uTime: wind.uniforms.uTime,
    uTear: { value: 0 } as IUniform<number>,
    uBleed: { value: 0 } as IUniform<number>,
    uFall: { value: 0 } as IUniform<number>,
    uDuel: { value: 0 } as IUniform<number>,
    uMoon: { value: 0 } as IUniform<number>,
    uShudder: { value: 0 } as IUniform<number>,
    uBillow: { value: 0.35 } as IUniform<number>,
    uAspect: { value: aspect } as IUniform<Vector2>,
    uSilCur: { value: silhouette.current } as IUniform<Texture>,
    uSilPrev: { value: silhouette.previous } as IUniform<Texture>,
    uSilWipe: { value: 1 } as IUniform<number>,
  };

  const FLAT_VERT = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const backdrop = new Mesh(
    new PlaneGeometry(1, 1),
    new ShaderMaterial({
      vertexShader: FLAT_VERT,
      fragmentShader: BACKDROP_FRAG,
      uniforms: {
        uTime: shared.uTime,
        uMoon: shared.uMoon,
        uBleed: shared.uBleed,
        uAspect: shared.uAspect,
        cNight: colour('nightBlue'),
        cMist: colour('mistCyan'),
        cMoon: colour('moonWhite'),
      },
      depthTest: false,
      depthWrite: false,
    }),
  );
  backdrop.position.z = -6;
  backdrop.renderOrder = 0;
  scene.add(backdrop);

  const cloth = new Mesh(
    new PlaneGeometry(1, 1, CLOTH_SEGMENTS[0], CLOTH_SEGMENTS[1]),
    new ShaderMaterial({
      vertexShader: CLOTH_VERT,
      fragmentShader: CLOTH_FRAG,
      uniforms: {
        // 風場那一整包。與竹林是同一組參數、同一支公式。
        ...wind.uniforms,
        uBillow: shared.uBillow,
        uFall: shared.uFall,
        uShudder: shared.uShudder,
        uTear: shared.uTear,
        uBleed: shared.uBleed,
        uMoon: shared.uMoon,
        uDuel: shared.uDuel,
        uSilCur: shared.uSilCur,
        uSilPrev: shared.uSilPrev,
        uSilWipe: shared.uSilWipe,
        uSilScale: silScale,
        uSilFit: { value: silFit },
        uClothAspect: { value: FLAG_ASPECT },
        uLampSize: { value: LAMP_SIZE },
        uDiffuse: { value: DIFFUSE },
        uRefract: { value: REFRACT },
        uAnchor: { value: new Vector2(FLAG_ANCHOR[0], FLAG_ANCHOR[1]) },
        uSpan: { value: FLAG_SPAN_METRES },
        cCloth: colour('rotBrown'),
        // 布後面那盞燈。它是第一幕唯一的暖點 —— 朱紅只給梅花與血墨,
        // 所以暖只能由枯竹黃來當(見 world3d/palette.ts)。
        cLamp: colour('deadBamboo'),
        cMoon: colour('moonWhite'),
        cBlood: colour('vermilion'),
        cBlade: colour('bladeCyan'),
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  cloth.renderOrder = 2;
  scene.add(cloth);

  let progress = 0;
  let painted = false;
  let width = options.width;
  let height = options.height;

  /**
   * 把兩片擺到正確的大小。
   *
   * 遠景填滿視錐(它是「整個畫面」);旗不填滿 —— 它是畫面裡的一件東西,
   * 撐滿就沒有夜色可以襯了。直式視窗時旗改成吃高度,不然 390 寬的畫面上
   * 一面橫旗只剩一條。
   */
  function layout() {
    const a = width / height;
    // 遠景的座標一律以**短邊**為 ±0.5。用長邊當基準的話,月亮在直式視窗上會
    // 脹成半個畫面 —— 它的半徑是寫死的,而寫死的半徑必須對著一個不會爆掉的軸。
    if (a >= 1) aspect.set(a, 1);
    else aspect.set(1, 1 / a);
    camera.aspect = a;
    camera.updateProjectionMatrix();

    const spread = (z: number) => {
      const dist = camera.position.z - z;
      const vh = 2 * Math.tan(((FOV / 2) * Math.PI) / 180) * dist;
      return { vh, vw: vh * a };
    };

    const far = spread(backdrop.position.z);
    backdrop.scale.set(far.vw, far.vh, 1);

    const near = spread(0);
    // 旗**撐滿**畫面。
    //
    // 先前這裡刻意讓它只佔一半,理由是「撐滿就沒有夜色可以襯」。那個判斷是錯的:
    // 使用者給的參考圖裡,整個畫面就是那塊被背光照亮的布 —— 觀眾是坐在戲棚前面,
    // 不是在遠處看一塊掛著的布。夜色留給第三幕,那一幕才是走出去之後的世界。
    //
    // 用 max 而不是 min:兩邊各自算出「要蓋住這個軸需要多寬」,取大的那個 ——
    // 也就是 cover 而不是 contain。橫式吃寬度、直式吃高度,同一條式子兩邊都對。
    const w = Math.max(near.vw, near.vh * FLAG_ASPECT);
    // z 也要放大:離面位移算的是 local 單位,不放大的話布在透視下完全是平的,
    // 而「這是一塊會鼓起來的布」正是它與一張貼圖的差別。
    cloth.scale.set(w, w / FLAG_ASPECT, w * 0.34);
    // 完整的剪影貼圖在布幕的 uv 上佔 uSilScale 這麼寬,所以它在畫面上的寬度是
    // uSilScale × 布幕寬。要讓它固定佔視窗的一個比例,就得隨布幕與視窗的比例反推。
    silScale.value = (SIL_VIEWPORT_SPAN * near.vw) / w;
    // 旗掛在朽樑上,所以它偏上;畫面下半留給枯梅與字。
    // 直式時旗往上讓,下面那一大塊留給字。
    cloth.position.y = near.vh * (a >= 1 ? 0.1 : 0.24);
  }

  layout();

  return {
    get painted() {
      return painted;
    },

    setProgress(next) {
      progress = next;
    },

    resize(w, h) {
      width = w;
      height = h;
      renderer.setSize(w, h, false);
      layout();
    },

    frame(dt, now) {
      const s = prologueState(progress);

      // 推進共用的風場。它會順手把 uTime 寫好,所以兩個材質的時間永遠一致。
      wind.update(now);

      // 分鏡格。進度落在哪一格是純函式,所以快滑、反滑都不會跳;只有**換格**
      // 才會真的重畫貼圖,而換格整幕只有五次。
      silhouette.update(progress, dt);
      shared.uSilCur.value = silhouette.current;
      shared.uSilPrev.value = silhouette.previous;
      shared.uSilWipe.value = silhouette.wipe;

      shared.uTear.value = s.tear;
      shared.uBleed.value = s.bleed;
      shared.uFall.value = s.fall;
      // 素材還沒到齊就整層不亮:半張分鏡比一塊乾淨的布更難看。
      shared.uDuel.value = silhouette.ready ? s.duel : 0;
      shared.uMoon.value = s.moonThrough;
      shared.uShudder.value = s.shudder;
      shared.uBillow.value = s.billow;

      renderer.render(scene, camera);
      painted = true;
    },

    dispose() {
      silhouette.dispose();
      for (const mesh of [backdrop, cloth]) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      scene.clear();
      renderer.dispose();
      // forceContextLoss 是唯一能讓瀏覽器立刻回收 GPU 記憶體的辦法。
      // 少了它,來回捲幾次序幕就會撞到「同時最多幾個 WebGL context」的上限。
      renderer.forceContextLoss();
    },
  };
}
