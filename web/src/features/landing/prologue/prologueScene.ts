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
} from 'three';

import { damp } from '../../world3d/noise';
import type { PaletteKey } from '../../world3d/palette';
import { createWind, type WindField } from '../../world3d/wind';
import { linearOf } from '../palette';
import { BACKDROP_FRAG, CLOTH_FRAG, CLOTH_VERT, FIGURES_FRAG } from './shaders';
import { prologueState } from './stages';

/**
 * 序幕的場子:三片、一台相機、一個進度數字。
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
 * 由後往前:月與遠霧 → 對劍的剪影 → 旗(3D 布)。裂口與血墨在布的 fragment 裡,
 * 不是另外疊的圖層 —— 它們是布**本身**的狀態,疊圖層會讓裂口邊緣跟布的皺褶對不上。
 *
 * 字那一層不在這裡,它是 DOM。3D 不承載任何資訊(見 chapters.ts 開頭)。
 */

/** 相機的視角。窄一點,旗才有「被鏡頭挑出來」的感覺,而不是廣角記錄片。 */
const FOV = 38;

/** 旗的長寬比。旗是橫的,但直式視窗會壓縮它 —— 見 layout()。 */
const FLAG_ASPECT = 1.32;

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
 * 袖、帶、髮落後身體多久(秒)。
 *
 * 規格要 100–200ms。用半衰期表示:0.14s 的半衰期在視覺上就是約 140ms 的落後,
 * 而且與影格率無關(damp 的理由見 world3d/noise)。這是整段戲**唯一**不由進度
 * 決定的東西 —— 刮停之後它會收斂到精確值,所以停在任何一點畫面仍然是確定的。
 */
const CLOTH_LAG_HALFLIFE = 0.14;

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
  // 剪影那一片的長寬比。它不等於螢幕,也不等於旗 —— 它是旗**扣掉破掉的下襬**
  // 之後那一塊,所以自己一個,由 layout() 每次重算。
  const figureAspect = new Vector2(FLAG_ASPECT, 1);

  // uniform 物件建一次就一直是同一個。每格重新配一份 { value } 是這種迴圈最常見的
  // 垃圾來源 —— 一分鐘六十格,十個 uniform 就是三萬六千個短命物件。
  // uTime 直接用風場那一個:整個序幕只有一個時鐘,而那個時鐘是共用的。
  const shared = {
    uTime: wind.uniforms.uTime,
    uTear: { value: 0 } as IUniform<number>,
    uBleed: { value: 0 } as IUniform<number>,
    uFall: { value: 0 } as IUniform<number>,
    uDuel: { value: 0 } as IUniform<number>,
    uPose: { value: 0 } as IUniform<number>,
    uPoseLag: { value: 0 } as IUniform<number>,
    uMoon: { value: 0 } as IUniform<number>,
    uShudder: { value: 0 } as IUniform<number>,
    uBillow: { value: 0.35 } as IUniform<number>,
    uAspect: { value: aspect } as IUniform<Vector2>,
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

  const figures = new Mesh(
    new PlaneGeometry(1, 1),
    new ShaderMaterial({
      vertexShader: FLAT_VERT,
      fragmentShader: FIGURES_FRAG,
      uniforms: {
        uPose: shared.uPose,
        uPoseLag: shared.uPoseLag,
        uDuel: shared.uDuel,
        uTear: shared.uTear,
        // 剪影用**自己那一片**的長寬比,不是螢幕的:它的座標系就是那塊布。
        uAspect: { value: figureAspect },
        cBlade: colour('bladeCyan'),
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  // 剪影畫在布**前面**,這不是把人搬到布前面 —— 皮影的影子在畫面上就是
  // 「布被擋掉的那一塊」。一般 alpha 混色下,顏色是黑、alpha 是剪影的話,
  // 結果正好是 dst × (1 − 剪影),也就是一次乘法變暗。把它畫在布後面才是錯的:
  // 布是不透明的,後面的東西一個像素都到不了畫面上。
  figures.position.z = 0.05;
  figures.renderOrder = 3;
  scene.add(figures);

  const cloth = new Mesh(
    new PlaneGeometry(1, 1, 56, 40),
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
        uAnchor: { value: new Vector2(FLAG_ANCHOR[0], FLAG_ANCHOR[1]) },
        uSpan: { value: FLAG_SPAN_METRES },
        uDepth: { value: 1 },
        cCloth: colour('rotBrown'),
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
  let poseLag = 0;
  let painted = false;
  let width = options.width;
  let height = options.height;

  /**
   * 把三片擺到正確的大小。
   *
   * 遠景與剪影填滿視錐(它們是「整個畫面」);旗不填滿 —— 它是畫面裡的一件東西,
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
    // 剪影那一片跟旗**完全對齊**(只推到布後面一點)。皮影戲的影子只在布上
    // 才看得到 —— 讓它填滿視錐的話,兩個人會有一半站在布外面,那就不是皮影了。

    const near = spread(0);
    // 旗不撐滿畫面:撐滿就沒有夜色可以襯,而月與剪影都在它後面 ——
    // 看不到後面那兩層的話,這一整段皮影戲就白做了。
    //
    // 直式視窗吃寬度、橫式吃高度。同一組係數兩邊都用的話,390 寬的畫面上
    // 旗會縮成畫面中央一小塊,而剪影就小到看不出是兩個人在對劍。
    const w =
      a >= 1
        ? Math.min(near.vw * 0.52, near.vh * 0.62 * FLAG_ASPECT)
        : Math.min(near.vw * 0.92, near.vh * 0.34 * FLAG_ASPECT);
    // z 也要放大。高度函式算的是 local 單位,不放大的話位移只有幾公釐,
    // 法線全是 (0,0,1) —— 畫出來是一塊沒有摺的板子,不是布。
    const depth = w * 0.34;
    cloth.scale.set(w, w / FLAG_ASPECT, depth);
    cloth.material.uniforms.uDepth!.value = depth / (w / FLAG_ASPECT);
    // 旗掛在朽樑上,所以它偏上;畫面下半留給枯梅與字。
    // 直式時旗往上讓,下面那一大塊留給字。
    cloth.position.y = near.vh * (a >= 1 ? 0.1 : 0.24);

    // 剪影要整片**待在布裡面**:下襬是破的,露出去的腳會直接畫在夜色上,
    // 那就不是影子而是兩個站在旗前面的人。所以扣掉下襬那一截再往上推。
    const h = w / FLAG_ASPECT;
    const figW = w * 0.94;
    const figH = h * 0.78;
    figures.scale.set(figW, figH, 1);
    figures.position.y = cloth.position.y + h * 0.11;
    figureAspect.set(figW / figH, 1);
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

      // 推進共用的風場。它會順手把 uTime 寫好,所以三個材質的時間永遠一致。
      wind.update(now);

      // 次級運動:阻尼追著姿勢跑。這是唯一一個「上一格」會影響「這一格」的地方,
      // 而它會收斂 —— 刮停之後畫面仍然只由 progress 決定。
      poseLag = options.reduced ? s.pose : damp(poseLag, s.pose, CLOTH_LAG_HALFLIFE, dt);

      shared.uTear.value = s.tear;
      shared.uBleed.value = s.bleed;
      shared.uFall.value = s.fall;
      shared.uDuel.value = s.duel;
      shared.uPose.value = s.pose;
      shared.uPoseLag.value = poseLag;
      shared.uMoon.value = s.moonThrough;
      shared.uShudder.value = s.shudder;
      shared.uBillow.value = s.billow;

      renderer.render(scene, camera);
      painted = true;
    },

    dispose() {
      for (const mesh of [backdrop, figures, cloth]) {
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
