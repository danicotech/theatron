import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  Group,
  InstancedMesh,
  Material,
  Mesh,
  PlaneGeometry,
  Scene,
  Sprite,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';

import {
  buildFlagBeam,
  buildHall,
  buildLantern,
  buildLeaningGate,
  buildPlum,
  buildSword,
  buildTerrain,
  buildWalkway,
  createMaterials,
  groundHeight,
  holeCentre,
  makeCulmGeometry,
  moonDirection,
  shaftLanding,
  tableTopY,
  type SitePlan,
} from './buildings';
import { mergeGeos } from './geometry';
import { makeBladeGeometry, makeWindMaterial, scatter } from './grass';
import { clamp, damp, mulberry32 } from './noise';
import { blendHex, PALETTE } from './palette';
import { createBambooLeaves, createDust, createEmbers, type Particles } from './particles';
import type { Quality } from './quality';
import { createTextureLibrary } from './textures';
import { createWind, DEFAULT_WIND, type WindField } from './wind';

/**
 * 論劍的場地平面圖,單位公尺。
 *
 * 相機的每一個 waypoint、月亮、破洞、桌子全部釘在這幾個數字上,所以整座武館
 * 要重新比例化時只改這裡。座標系:相機從 +z 往 -z 走,y 是高度,中軸線是 x = 0。
 *
 *   z = +25.5  相機起點(第一章)
 *   z = +18    朽樑,殘旗掛在上面
 *   z = +6     傾斜牌樓
 *   z = +2…-16 兩側的半榻迴廊
 *   z = -18    大廳正面:雙開木門、破格窗、欄間
 *   z = -43    屋頂破洞
 *   z = -42.6  大廳背面:剝漆木牆(第四章)
 *
 * **月亮的位置與第一章的站位是一組的。** 規格要「月在旗後」,那只有把月亮
 * 放在「鏡頭 → 殘旗掛點」那條線的延長線上才成立。改其中一個就要改另一個,
 * `world.test.ts` 會量這件事。
 */
const PLAN: SitePlan = {
  courtHalf: 18,
  flagBeamZ: 18,
  gateZ: 6,
  walkwayX: 11.5,
  walkwayZ0: 2,
  walkwayZ1: -16,
  hallFrontZ: -18,
  hallBackZ: -42.6,
  hallHalfW: 9.8,
  plinth: 0.9,
  postTop: 6.5,
  eaveY: 7.2,
  holeX: 1.6,
  holeZ: -43,
  moon: [-26, 46, -122],
};

/**
 * 殘旗的掛點。
 *
 * 布幕是另一個人的東西(它要絲綢的擺動與被劍劃開的裂口,那是一支 shader),
 * 這裡只負責把掛點交出去。第一章的相機、月亮、與這個點三者共線 —— 三個座標
 * 分屬三個檔案,所以它必須有一個公開的名字,不能各寫各的。
 */
export const FLAG_ANCHOR = new Vector3(-0.75, 4.58, PLAN.flagBeamZ);

/** 霧的起訖。終點落在竹林之外 —— 霧是這個世界的邊界,不是效果。 */
const FOG_NEAR = 20;
const FOG_FAR = 132;

/** 竹林的三塊地。東側是第一、二、七章看得到的那一片,其餘兩片負責關起世界。 */
const GROVES: ReadonlyArray<readonly [number, number, number, number]> = [
  [5, 32, -14, 30],
  [-34, -13, -20, 28],
  [-28, 28, -66, -48],
];

/**
 * 荒草只鋪**看得到的那一塊院子**。
 *
 * 第一版鋪了 76 × 94 公尺,而上限是一萬四千株 —— 攤下來每平方公尺兩株,
 * 也就是每一公尺半才一根草。那不是荒草,那是幾根落單的雜草。
 * 縮到鏡頭真的會經過的範圍,同樣的預算換到每平方公尺五株,才讀得出是
 * 「沒有人掃了」;霧本來就吃掉二十公尺外的一切,鋪過去是白鋪的。
 */
const WEED_PATCH: readonly [number, number, number, number] = [-23, 25, -21, 31];

/** 竹葉從竹梢那一段落下。這個高度區間就是「從竹子掉下來」與「從天上掉下來」的差別。 */
const LEAF_BAND: readonly [number, number] = [4.5, 12];

export interface World {
  /** dt 是秒,time 是累計秒,progress 是 0…6 的章節進度。 */
  update(dt: number, time: number, progress: number): void;
  dispose(): void;
  /** 相機跟著走的粒子場中心。世界自己不知道相機在哪,由呼叫端餵進來。 */
  followCamera(x: number, z: number): void;
  /**
   * 全場共用的風。序幕的布幕要吃同一陣風,所以它必須拿得到 ——
   * 布幕自己造一個風場就等於旗子跟竹林各吹各的。
   */
  readonly wind: WindField;
}

export function buildWorld(scene: Scene, quality: Quality, reduced: boolean): World {
  const lib = createTextureLibrary();
  const mats = createMaterials(lib);
  const root = new Group();
  scene.add(root);

  const night = new Color(PALETTE.nightBlue);
  scene.background = night.clone().multiplyScalar(0.42);
  // 霧是讓地面「就這樣停住」的那個東西:沒有它就得把地建到天邊,
  // 而天邊在這個構圖裡永遠看不到。
  scene.fog = new Fog(night.clone().multiplyScalar(0.8).getHex(), FOG_NEAR, FOG_FAR);

  /* ------------------------------------------------------------- 風 */

  // 風從東北往西南吹:東側竹林在上風處,所以陣風先掃過竹林,再把葉子帶向
  // 中軸與鏡頭。方向反過來的話,葉子一離枝就往畫面外飛,整片竹林白做。
  const wind = createWind({
    ...DEFAULT_WIND,
    direction: new Vector2(-0.82, 0.57),
    strength: 0.36,
    speed: 1.25,
  });

  /* ------------------------------------------------------------- 地與天 */

  const terrain = buildTerrain(lib, mats, PLAN);
  root.add(terrain.group);

  /* ------------------------------------------------------------- 木構 */

  root.add(buildFlagBeam(mats, PLAN.flagBeamZ));

  const gate = buildLeaningGate(mats);
  gate.group.position.z = PLAN.gateZ;
  root.add(gate.group);

  for (const s of [-1, 1] as const) {
    root.add(
      buildWalkway(mats, {
        x: s * PLAN.walkwayX,
        z0: PLAN.walkwayZ0,
        z1: PLAN.walkwayZ1,
        width: 2.6,
        bays: 7,
        inward: s === 1 ? -1 : 1,
        seed: s === 1 ? 5171 : 8803,
      }),
    );
  }

  const hall = buildHall(mats, PLAN);
  root.add(hall.group);

  // 兩把插在地上的劍。第二章的主體 —— 也是全場唯一發光的東西。
  for (const [x, z, tz, tx] of [
    [-1.7, 9.2, 0.13, -0.05],
    [0.9, 8.4, -0.09, 0.07],
  ] as const) {
    const sword = buildSword(mats, tz, tx);
    sword.position.set(x, groundHeight(x, z, terrainCentreZ()), z);
    root.add(sword);
  }

  /* ----------------------------------------------------------- 枯梅 */

  // 一棵長在斷掉的地板裡、往破洞爬上去的梅。這是整個場景裡最重要的一個
  // 決定:荒廢的建築裡長出一棵樹,而它剛好長在唯一有光的地方。第四章的
  // 「梅枝從上角伸入」與第五章的「梅枝橫貫畫面」是同一棵樹的同一根枝。
  const insidePlum = buildPlum(mats, 2207, 2.25);
  // 位置由兩個鏡頭夾出來:第四章要它的枝從背牆的上角伸進來,第五章要同一根枝
  // 橫過破洞。所以它得站在背牆前、破洞的斜下方,不是大廳正中央。
  insidePlum.group.position.set(-1.0, PLAN.plinth, -39.8);
  root.add(insidePlum.group);

  // 另一棵在前庭,靠近鏡頭的左緣 —— 第一章的畫面左側需要一點朱紅。
  const courtPlum = buildPlum(mats, 6631, 1.15);
  courtPlum.group.position.set(-3.2, 0, 20.5);
  root.add(courtPlum.group);

  for (const bough of [...insidePlum.boughs, ...courtPlum.boughs]) {
    // give 0.32:梅是硬枝,吹不動多少。給 1 的話它會像柳條一樣甩。
    wind.add(bough, 0.32);
  }

  /* ----------------------------------------------------------- 燈籠 */

  // 全場唯一的人造光,而且只剩餘燼。掛在大廳前左角的一根斷樑上。
  const lantern = buildLantern(mats, -5.2, 3.6, -14.6);
  root.add(lantern.group);
  wind.add(lantern.group, 0.5);

  /* ----------------------------------------------------------- 竹與草 */

  // 兩片實例化的植被,共用同一個風場。散佈用的是面積加權取樣(見 grass.ts),
  // 所以取樣面要是真的有起伏的地 —— 取樣面本身不進場景,灑完就丟。
  const culmMaterial = makeWindMaterial({
    wind: wind.uniforms,
    sway: 0.55,
    bottom: blendHex(PALETTE.deadBamboo, PALETTE.nightBlue, 0.45),
    top: blendHex(PALETTE.deadBamboo, PALETTE.mistCyan, 0.2),
    map: lib.get('bamboo').map,
    alphaTest: 0.42,
    cacheKey: 'lunjian-bamboo',
  });
  const weedMaterial = makeWindMaterial({
    wind: wind.uniforms,
    sway: 0.1,
    bottom: blendHex(PALETTE.rotBrown, PALETTE.nightBlue, 0.55),
    top: blendHex(PALETTE.deadBamboo, PALETTE.rotBrown, 0.35),
    cacheKey: 'lunjian-weed',
  });

  const groveSurface = patchSurface(GROVES, 16);
  const perVariant = Math.ceil(quality.bambooCount / CULM_VARIANTS);
  const culmGeos: BufferGeometry[] = [];
  for (let v = 0; v < CULM_VARIANTS; v++) {
    const geo = makeCulmGeometry(v);
    culmGeos.push(geo);
    const grove = scatter(groveSurface, {
      geometry: geo,
      material: culmMaterial,
      density: 1,
      maxCount: perVariant,
      // 等比縮放:縮放值就是竹子的高度。非等比會把葉片的貼片拉成麵條。
      width: [7.5, 13],
      height: [7.5, 13],
      tiltMax: 0.06,
      seed: 4100 + v * 91,
      reject: blocked,
    });
    root.add(grove);
  }
  groveSurface.geometry.dispose();

  const weedSurface = patchSurface([WEED_PATCH], 40);
  const bladeGeo = makeBladeGeometry(4);
  root.add(
    scatter(weedSurface, {
      geometry: bladeGeo,
      material: weedMaterial,
      density: quality.weedDensity,
      maxCount: quality.weedMax,
      width: [0.05, 0.13],
      height: [0.24, 0.72],
      tiltMax: 0.22,
      seed: 2960,
      reject: indoors,
    }),
  );
  weedSurface.geometry.dispose();

  /* ------------------------------------------------------------------ 光 */

  // 環境光很低,但不是沒有。夜景的層次來自月光與剪影,不是把底提亮 ——
  // 只是「壓到幾乎沒有」的第一版在螢幕上是一整片黑:朽木的反照率本來就只有
  // 0.07,再乘一個 0.26 的環境光,ACES 之後連輪廓都沒有。夜要暗,但要看得見。
  const ambient = new AmbientLight(PALETTE.mistCyan, 0.7);
  scene.add(ambient);

  // 月光。方向由場地平面圖裡月亮的位置導出 —— 貼片上的月亮與照下來的光
  // 必須來自同一個方向,不然第一章的旗會從左邊逆光、右邊卻有高光。
  const dir = moonDirection(PLAN);
  const focus = new Vector3(0, 2, (PLAN.hallFrontZ + PLAN.hallBackZ) / 2);
  const moonKey = new DirectionalLight(PALETTE.moonWhite, 3.2);
  moonKey.position.copy(focus).addScaledVector(dir, -92);
  moonKey.target.position.copy(focus);
  scene.add(moonKey);
  scene.add(moonKey.target);
  if (quality.shadows) {
    moonKey.castShadow = true;
    moonKey.shadow.mapSize.set(2048, 2048);
    // 陰影的視錐只框住院落到大廳這一段。框整個世界的話,2048 的圖分到每公尺
    // 只剩幾個像素,陰影會變成一團格子。
    const cam = moonKey.shadow.camera;
    cam.left = -46;
    cam.right = 46;
    cam.top = 46;
    cam.bottom = -34;
    cam.near = 20;
    cam.far = 190;
    cam.updateProjectionMatrix();
    moonKey.shadow.bias = -0.0011;
  }

  // 補光:從鏡頭這一側補霧青。它比看起來重要得多 —— 月亮在大廳**背後**,
  // 所以第六、七章看到的整個正面都是背光的,少了這一盞那兩章就是兩塊黑。
  // 這是攝影棚的補光,不是第二個月亮:顏色與月光同調、強度只有三成。
  const fill = new DirectionalLight(PALETTE.mistCyan, 1.3);
  fill.position.set(26, 16, 42);
  scene.add(fill);

  /* -------------------------------------------------------------- 粒子 */

  // 不想看到動的人:粒子整個不生。生了再停住的粒子是一片不動的白點,
  // 比沒有更怪。
  const groveBox = leafBox();
  const leaves: Particles | null = reduced
    ? null
    : createBambooLeaves(quality.leafCount, groveBox, wind.uniforms);
  const dust: Particles | null = reduced ? null : createDust(quality.dustCount);
  const embers: Particles | null = reduced
    ? null
    : createEmbers(quality.emberCount, lantern.emberAt);
  for (const p of [leaves, dust, embers]) if (p !== null) root.add(p.points);

  /* -------------------------------------------------------------- 更新 */

  const flickerSeed = mulberry32(31337);
  const lanternPhase = flickerSeed() * 6.28;
  const lanternBase = lantern.light.intensity;
  const hallBase = hall.lights.map((l) => l.intensity);
  let followX = 0;
  let followZ = 0;
  let interior = 0;

  return {
    wind,

    followCamera(x, z) {
      followX = x;
      followZ = z;
    },

    update(dt, time, progress) {
      if (reduced) return;

      wind.update(time);

      // 餘燼的呼吸。兩個不同週期的正弦相加:單一正弦會讀成一個效果,不是一盞
      // 快熄掉的燈。偶爾幾乎全暗,那才是「餘燼」。
      const gutter = 0.55 + Math.sin(time * 1.7 + lanternPhase) * 0.3 + Math.sin(time * 4.9) * 0.15;
      lantern.light.intensity = lanternBase * Math.max(0.08, gutter);

      // 堂內的冷光隨進度亮起來:第三章之後才是它的戲。跳著捲(點章節目錄)時
      // 進度會瞬移,所以這裡阻尼一次 —— 光是漸漸看清楚的,不是被切換的。
      // 第三章就是桌子的戲,所以第二章結束前就要亮到八成。原本從 1.7 才開始
      // 爬,到第三章只走到四成 —— 那一章的主體在自己的章節裡還是暗的。
      const want = 0.35 + clamp((progress - 1.1) / 1.1, 0, 1) * 0.65;
      interior = damp(interior, want, 0.3, dt);
      hall.lights.forEach((l, i) => {
        l.intensity = hallBase[i]! * interior;
      });

      leaves?.update(time, followX, followZ);
      dust?.update(time, followX, followZ);
      embers?.update(time, followX, followZ);
    },

    dispose() {
      leaves?.dispose();
      dust?.dispose();
      embers?.dispose();
      scene.remove(root);
      for (const light of [ambient, moonKey, fill]) scene.remove(light);
      scene.remove(moonKey.target);
      ambient.dispose();
      moonKey.dispose();
      fill.dispose();
      disposeTree(root);
      // 幾何是三個變體共用的,合批時沒有被 mergeGeos 吃掉,所以自己收。
      for (const g of culmGeos) g.dispose();
      bladeGeo.dispose();
      culmMaterial.dispose();
      weedMaterial.dispose();
      lib.dispose();
      scene.background = null;
      scene.fog = null;
    },
  };
}

/** 三種竹子的變體。三次 draw call 畫完整片竹林,而眼睛認不出重複。 */
const CULM_VARIANTS = 3;

/** 地面網格的中心 z。buildTerrain 用同一條式子,所以起伏對得起來。 */
function terrainCentreZ(): number {
  return (PLAN.hallFrontZ + PLAN.hallBackZ) / 2 + 14;
}

/**
 * 散佈用的取樣面:幾塊矩形,照地形起伏擺好。
 *
 * 為什麼不直接拿整片地去灑:`scatter` 是照三角形面積抽點的,整片地是
 * 六萬七千平方公尺而竹林只佔其中不到一成 —— 九成的取樣會落在竹林外被
 * 拒絕掉,而被拒絕的實例只是一個縮到零的空位。給它一塊剛好的地,
 * `density` 這個參數才有意義。
 *
 * 這些面只是為了取樣,不進場景,用完就 dispose。
 */
function patchSurface(
  rects: ReadonlyArray<readonly [number, number, number, number]>,
  segments: number,
): Mesh {
  const parts: BufferGeometry[] = [];
  const centreZ = terrainCentreZ();
  for (const [x0, x1, z0, z1] of rects) {
    const geo = new PlaneGeometry(x1 - x0, z1 - z0, segments, segments);
    geo.rotateX(-Math.PI / 2);
    geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i), centreZ));
    }
    pos.needsUpdate = true;
    parts.push(geo);
  }
  // mergeGeos 會 dispose 原料,單一矩形時原樣回傳。
  return new Mesh(mergeGeos(parts));
}

/** 竹葉的生成盒:東側竹林的平面範圍 × 竹梢那一段高度。 */
function leafBox(): { min: Vector3; max: Vector3 } {
  const [x0, x1, z0, z1] = GROVES[0]!;
  return {
    min: new Vector3(x0, LEAF_BAND[0], z0),
    max: new Vector3(x1, LEAF_BAND[1], z1),
  };
}

/**
 * 竹子不准長的地方。
 *
 * 三類,每一類都對應一個會壞掉的鏡頭:
 *   建築裡    柱子會從台基裡長出來
 *   中軸與門前  第一章的殘旗與第七章的屋脊都需要那條走廊是空的
 *   鏡頭腳下   第二、七章的站位就在竹林裡,一根長在鏡頭前三十公分的竹子
 *              會佔掉半個畫面,而它在構圖階段完全看不出來
 */
function blocked(x: number, z: number): boolean {
  if (indoors(x, z)) return true;
  // 中軸的走廊:從殘旗一路通到大廳正面。
  if (x > -4.4 && x < 3.4 && z > -17 && z < 28) return true;
  // 牌樓的正面,留給第二章。
  if (Math.abs(x) < 7.2 && z > 2 && z < 11) return true;
  // 鏡頭腳下(第二章與第七章的站位)。
  if (Math.hypot(x - 10.5, z - 13) < 2.4) return true;
  if (Math.hypot(x - 16.5, z - 16) < 2.4) return true;
  return false;
}

/** 台基、迴廊的地板、以及牆內。草與竹都不准長在這裡。 */
function indoors(x: number, z: number): boolean {
  if (Math.abs(x) < PLAN.hallHalfW + 1.4 && z < PLAN.hallFrontZ + 1 && z > PLAN.hallBackZ - 1.4) {
    return true;
  }
  const wx = Math.abs(x);
  if (wx > PLAN.walkwayX - 3.4 && wx < PLAN.walkwayX + 0.8) {
    if (z < PLAN.walkwayZ0 + 0.6 && z > PLAN.walkwayZ1 - 0.6) return true;
  }
  return false;
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
  // 退成 any。標一次形狀,底下就都是有型別的。
  type AnyMesh = Mesh<BufferGeometry, Material | Material[]>;

  const collect = (m: Material | Material[]) => {
    if (Array.isArray(m)) for (const one of m) materials.add(one);
    else materials.add(m);
  };

  root.traverse((node) => {
    if (node instanceof InstancedMesh) {
      // 實例緩衝是額外一份 GPU 記憶體,geometry.dispose() 不會收它。
      node.dispose();
      collect((node as unknown as AnyMesh).material);
      return;
    }
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

/* ------------------------------------------------------------ 給測試與相機 */

export { PLAN as SITE_PLAN };

/** 第一章要求「月在旗後」。回傳月亮與殘旗掛點在鏡頭裡的夾角(度)。 */
export function moonBehindFlagDegrees(cameraPos: Vector3): number {
  const toFlag = FLAG_ANCHOR.clone().sub(cameraPos).normalize();
  const toMoon = new Vector3(PLAN.moon[0], PLAN.moon[1], PLAN.moon[2]).sub(cameraPos).normalize();
  return (Math.acos(clamp(toFlag.dot(toMoon), -1, 1)) * 180) / Math.PI;
}

/** 月光穿過破洞之後落在哪 —— 桌面就擺在這個點上,不是擺在看起來還可以的地方。 */
export function moonPool(): Vector3 {
  return shaftLanding(PLAN, tableTopY(PLAN));
}

/** 破洞的世界座標。 */
export function roofHole(): Vector3 {
  return holeCentre(PLAN);
}

/** 大廳門洞的半寬與高度。相機第二次與第五次穿牆走的就是這個洞。 */
export const DOOR_APERTURE = { halfWidth: 1.8, top: PLAN.plinth + 4.1 } as const;
/** 欄間:門楣以上、簷下以下的那一段。相機從這裡進大廳。 */
export const TRANSOM_BAND = { bottom: PLAN.plinth + 4.35, top: PLAN.postTop + 1.4 } as const;
