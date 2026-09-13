import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  Group,
  Material,
  Mesh,
  PointLight,
  Scene,
  Sprite,
  type BufferGeometry,
  type Object3D,
} from 'three';

import {
  buildHall,
  buildLantern,
  buildPaifang,
  buildTerrain,
  createMaterials,
  type SitePlan,
} from './buildings';
import { clamp, damp, mulberry32 } from './noise';
import type { Quality } from './quality';
import { createEmbers, createSnow, type Particles } from './snow';
import { createTextureLibrary } from './textures';

/**
 * 劍冢的場地平面圖,單位公尺。
 *
 * 相機的每一個 waypoint、每一盞燈籠、月亮的位置都釘在這幾個數字上,所以整條
 * 參道要重新比例化時只改這裡。座標系:相機從 +z 往 -z 走,y 是高度,
 * 中軸線是 x = 0。
 *
 *   z = +34   相機起點(序章)
 *   z = -14   山門
 *   z = -34   台階的第一級
 *   z = -55   台階頂 = 台基前緣,高 7.6
 *   z = -66   木堂的中軸
 */
const PLAN: SitePlan = {
  /** 院子的半寬。石舖面到這裡為止,再往外是雪地。 */
  courtHalf: 24,
  gateZ: -14,
  stairZ0: -34,
  stairSteps: 32,
  stairRun: 0.66,
  stairWidth: 11,
  podiumHeight: 7.6,
  podiumBackZ: -88,
  hallZ: -66,
};

/** 霧的起訖。終點必須落在遠山之前 —— 山是貼片,它自己不吃霧。 */
const FOG_NEAR = 26;
const FOG_FAR = 168;

/** 堂內每盞燈的滿檔強度。update 只調它的倍率。 */
const HALL_LIGHT = 3.2;

export interface World {
  /** dt 是秒,time 是累計秒,progress 是 0…4 的章節進度。 */
  update(dt: number, time: number, progress: number): void;
  dispose(): void;
  /** 相機跟著走的粒子場中心。世界自己不知道相機在哪,由呼叫端餵進來。 */
  followCamera(x: number, z: number): void;
}

export function buildWorld(scene: Scene, quality: Quality, reduced: boolean): World {
  const lib = createTextureLibrary();
  const mats = createMaterials(lib);
  const root = new Group();
  scene.add(root);

  scene.background = new Color(0x05070a);
  // 霧是讓地面「就這樣停住」的那個東西:沒有它就得把地建到天邊,
  // 而天邊在這個構圖裡永遠看不到。
  scene.fog = new Fog(0x0a1016, FOG_NEAR, FOG_FAR);

  const terrain = buildTerrain(lib, mats, PLAN);
  root.add(terrain.group);

  const gate = buildPaifang(mats);
  gate.position.z = PLAN.gateZ;
  root.add(gate);

  const hall = buildHall(mats);
  hall.group.position.set(0, PLAN.podiumHeight, PLAN.hallZ);
  root.add(hall.group);

  // 燈籠沿參道兩側排,越往深處越疏也越小 —— 那是這條路有長度的唯一證據。
  const lanterns: Array<{ light: PointLight; base: number; phase: number }> = [];
  const rand = mulberry32(31337);
  for (let i = 0; i < quality.lanternPairs; i++) {
    const t = i / Math.max(1, quality.lanternPairs - 1);
    const z = 12 - t * 44;
    const x = 6.4 + t * 2.2;
    const scale = 1.15 - t * 0.3;
    for (const s of [-1, 1]) {
      const lantern = buildLantern(mats, s * x, z, scale);
      root.add(lantern.group);
      lanterns.push({ light: lantern.light, base: lantern.light.intensity, phase: rand() * 6.28 });
    }
  }
  // 台階頂那一對:它們標出「路到這裡結束」,所以不在上面那條等距的隊伍裡。
  for (const s of [-1, 1]) {
    const lantern = buildLantern(
      mats,
      s * (PLAN.stairWidth / 2 + 1.6),
      terrain.stairTop.z - 1.4,
      1.2,
    );
    lantern.group.position.y = PLAN.podiumHeight;
    root.add(lantern.group);
    lanterns.push({ light: lantern.light, base: lantern.light.intensity, phase: rand() * 6.28 });
  }

  /* ------------------------------------------------------------------ 光 */

  // 環境光壓到幾乎沒有。夜景的層次來自兩盞方向光與燈籠,不是來自把底提亮。
  const ambient = new AmbientLight(0x2b3a4a, 0.34);
  scene.add(ambient);

  // 月光:冷、從山門後方偏左打過來,所以第一章的山門是逆光的剪影。
  const moonKey = new DirectionalLight(0xa8c4dc, 1.45);
  moonKey.position.set(-24, 34, -96);
  moonKey.target.position.set(0, 4, PLAN.gateZ);
  scene.add(moonKey);
  scene.add(moonKey.target);
  if (quality.shadows) {
    moonKey.castShadow = true;
    moonKey.shadow.mapSize.set(1024, 1024);
    // 陰影的視錐只框住山門到台階這一段。框整個世界的話 1024 的圖分到每公尺
    // 只剩幾個像素,陰影會變成一團格子。
    const cam = moonKey.shadow.camera;
    cam.left = -34;
    cam.right = 34;
    cam.top = 34;
    cam.bottom = -20;
    cam.near = 40;
    cam.far = 190;
    cam.updateProjectionMatrix();
    moonKey.shadow.bias = -0.0012;
  }

  // 補光:從畫面外的左上補一點青,讓暗部不是純黑而是有顏色的暗。
  const fill = new DirectionalLight(0x5a7d96, 0.4);
  fill.position.set(28, 20, 30);
  scene.add(fill);

  // 台階自己的一盞燈。少了它,台階會掉進跟地面同一個黑裡,眼睛就沒有東西可以爬。
  const stairLight = new PointLight(0xffa04a, 4.6, 26, 2);
  stairLight.position.set(0, PLAN.podiumHeight * 0.6, (PLAN.stairZ0 + terrain.stairTop.z) / 2);
  scene.add(stairLight);

  /* -------------------------------------------------------------- 粒子 */

  // 不想看到動的人:雪整個不生。生了再停住的雪是一地不動的白點,比沒有更怪。
  const snow: Particles | null = reduced ? null : createSnow(quality.snowCount);
  const embers: Particles | null = reduced ? null : createEmbers(quality.emberCount);
  if (snow !== null) root.add(snow.points);
  if (embers !== null) root.add(embers.points);

  let followX = 0;
  let followZ = 0;
  let hallWarm = 0.55;

  return {
    followCamera(x, z) {
      followX = x;
      followZ = z;
    },

    update(dt, time, progress) {
      if (reduced) return;
      // 燈籠的閃爍:兩個不同週期的正弦相加,相位各自不同。單一正弦會讓整排
      // 燈籠一起呼吸,那立刻讀成一個效果,不是一排火。
      for (const l of lanterns) {
        const f =
          Math.sin(time * 2.1 + l.phase) * 0.06 + Math.sin(time * 5.3 + l.phase * 2) * 0.035;
        l.light.intensity = l.base * (1 + f);
      }
      // 堂內的燈隨進度亮起來:第三章之後才是它的戲。跳著捲(點章節目錄)時
      // 進度會瞬移,所以這裡阻尼一次 —— 燈是被點亮的,不是被切換的。
      const want = 0.55 + clamp((progress - 1.6) / 1.8, 0, 1) * 0.75;
      hallWarm = damp(hallWarm, want, 0.32, dt);
      for (const l of hall.lights) l.intensity = HALL_LIGHT * hallWarm;

      snow?.update(time, followX, followZ);
      embers?.update(time, followX, followZ);
    },

    dispose() {
      snow?.dispose();
      embers?.dispose();
      scene.remove(root);
      scene.remove(ambient);
      scene.remove(moonKey);
      scene.remove(moonKey.target);
      scene.remove(fill);
      scene.remove(stairLight);
      moonKey.dispose();
      fill.dispose();
      stairLight.dispose();
      ambient.dispose();
      disposeTree(root);
      lib.dispose();
      scene.background = null;
      scene.fog = null;
    },
  };
}

/**
 * 把一棵樹上所有的幾何與材質釋放掉。
 *
 * 走訪整棵樹而不是逐個記錄建立過的東西:材質是共用的、幾何是合批過的,
 * 建立端的帳本一定會跟實際掛在場上的東西對不起來,而對不起來的那幾個
 * 就是洩漏。貼圖不在這裡放 —— 它們屬於材質庫,由庫自己收。
 */
export function disposeTree(root: Object3D): void {
  const materials = new Set<Material>();

  // three 的 Mesh 是泛型的,instanceof narrowing 之後 geometry 與 material 都會
  // 退成 any。標一次形狀,底下就都是有型別的 —— 用 eslint-disable 蓋掉比較快,
  // 但那樣真的拿錯欄位時也一樣沒人會發現。
  type AnyMesh = Mesh<BufferGeometry, Material | Material[]>;

  const collect = (m: Material | Material[]) => {
    if (Array.isArray(m)) for (const one of m) materials.add(one);
    else materials.add(m);
  };

  root.traverse((node) => {
    if (node instanceof Mesh) {
      const mesh = node as AnyMesh;
      mesh.geometry.dispose();
      collect(mesh.material);
      return;
    }
    if (node instanceof Sprite) collect(node.material);
  });

  // 用 Set 收再一次釋放:同一支材質被三十個 mesh 指到,逐個 dispose 是三十次
  // 對同一個資源動手,而其中二十九次是在對一個已經沒了的東西動手。
  for (const material of materials) material.dispose();
  root.clear();
}

export { PLAN as SITE_PLAN };
