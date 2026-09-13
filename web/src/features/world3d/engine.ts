import {
  LinearSRGBColorSpace,
  NoToneMapping,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three';

import { createCameraRig, type CameraRig } from './camera';
import { clamp } from './noise';
import { createPost, type PostChain } from './post';
import type { Quality } from './quality';
import { buildWorld, type World } from './world';

/**
 * 把渲染器、世界、相機軌與後製綁成一件東西。
 *
 * 這一層存在的理由只有一個:**讓 React 那一層不用 import three**。
 * WorldScene 只認 createEngine / frame / dispose 三個字,three 整包就留在這條
 * 動態 import 的後面,不會進第一份 JS。順便,它也讓「掛載→跑→卸載」這條
 * 生命週期有一個可以單獨檢查的地方。
 */

/** 開場推軌走多久(秒)。比第一章的閱讀時間短,不然使用者會先捲走。 */
const INTRO_SECONDS = 2.6;
/** 第一格畫出來之後淡入多久。 */
const FADE_SECONDS = 1.1;

export interface Engine {
  resize(width: number, height: number): void;
  /** 降解析度。frame time 持續不好時由呼叫端叫。 */
  setPixelRatio(ratio: number): void;
  /** 畫一格。dt 與 time 是秒,progress 是 0…6(七章,見 camera.ts)。 */
  frame(dt: number, time: number, progress: number, pointerX: number, pointerY: number): void;
  /** 已經畫出過至少一格。用來決定什麼時候可以把 2D 的降級層收掉。 */
  readonly painted: boolean;
  dispose(): void;
}

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  quality: Quality;
  reduced: boolean;
  width: number;
  height: number;
  pixelRatio: number;
}

export function createEngine(options: EngineOptions): Engine {
  const renderer = new WebGLRenderer({
    canvas: options.canvas,
    // 反鋸齒交給場景 render target 的 MSAA;畫布自己再開一次是白花的。
    antialias: false,
    alpha: false,
    stencil: false,
    powerPreference: 'high-performance',
  });
  // 色調映射與 sRGB 編碼都由合成 shader 自己做,所以這裡兩樣都關掉。
  // 開著的話畫面會被壓兩次,夜景直接糊成一片灰。
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.setPixelRatio(options.pixelRatio);
  renderer.setSize(options.width, options.height, false);
  if (options.quality.shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    // 陰影圖只算一次:場上沒有任何東西在移動,每格重算是純粹的浪費。
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
  }

  const scene = new Scene();
  const camera = new PerspectiveCamera(40, options.width / options.height, 0.4, 280);

  const world: World = buildWorld(scene, options.quality, options.reduced);
  const rig: CameraRig = createCameraRig();
  const post: PostChain = createPost(renderer, {
    levels: options.quality.bloomLevels,
    samples: options.quality.samples,
  });

  // 量繪圖緩衝大小用的暫存。迴圈外也一樣不要每次配一個新物件。
  const bufferSize = new Vector2();

  function syncPostSize() {
    renderer.getDrawingBufferSize(bufferSize);
    post.setSize(bufferSize.x, bufferSize.y);
  }

  let intro = 0;
  let fade = 0;
  let painted = false;
  let width = options.width;
  let height = options.height;

  return {
    get painted() {
      return painted;
    },

    resize(w, h) {
      width = w;
      height = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      syncPostSize();
    },

    setPixelRatio(ratio) {
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
      syncPostSize();
    },

    frame(dt, time, progress, pointerX, pointerY) {
      // 不想看到動的人根本走不到這裡(WorldScene 會走 2D 降級),但萬一
      // 偏好在執行期改變,intro 直接跳到底比讓它推一次軌安全。
      intro = options.reduced ? 1 : clamp(intro + dt / INTRO_SECONDS, 0, 1);
      // 進度是**生的** —— 阻尼在相機軌裡面做,因為那是唯一知道「捲太快會
      // 讓鏡頭反向轉」的地方,而 dt 也只有在那裡才配得上半衰期。
      rig.applyTo(camera, {
        progress,
        dt,
        aspect: width / height,
        intro,
        pointerX,
        pointerY,
      });
      world.followCamera(camera.position.x, camera.position.z);
      world.update(dt, time, progress);

      fade = clamp(fade + dt / FADE_SECONDS, 0, 1);
      post.render(scene, camera, fade);
      painted = true;
    },

    dispose() {
      post.dispose();
      rig.dispose();
      world.dispose();
      scene.clear();
      renderer.dispose();
      // forceContextLoss 是唯一能讓瀏覽器立刻回收 GPU 記憶體的辦法。
      // 少了它,快速掛載卸載幾次就會撞到「同時最多幾個 WebGL context」的上限,
      // 而撞到之後最舊的那個會被瀏覽器默默殺掉 —— 症狀是別的分頁變黑。
      renderer.forceContextLoss();
    },
  };
}

/**
 * 這台瀏覽器有沒有 WebGL。
 *
 * 探測用一張**丟掉的** canvas,不是要拿來用的那一張:探測失敗時那張 canvas
 * 上已經有一個壞掉的 context,而一個元素一輩子只能有一種 context。
 */
export function hasWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
    if (gl === null) return false;
    // 探測完立刻歸還,不然這個 context 會一直佔著名額。
    const lose = gl.getExtension('WEBGL_lose_context') as { loseContext(): void } | null;
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}
