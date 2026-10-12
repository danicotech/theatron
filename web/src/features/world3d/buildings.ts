import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';

import {
  at,
  flaredRoof,
  flaredRoofHeight,
  lean,
  mergeGeos,
  offsetUv,
  scaleUv,
  sweepProfile,
  turnY,
  type FlaredRoofOptions,
} from './geometry';
import { clamp, mulberry32 } from './noise';
import { PALETTE } from './palette';
import type { TextureLibrary } from './textures';

/**
 * 《論劍》的木構。
 *
 * 一座荒廢多年的木造武館:傾斜的牌樓、半榻的迴廊、破頂的練武大廳、微啟的
 * 雙開木門,外加竹林、枯梅、兩把插在地上的劍,與一盞只剩餘燼的燈籠。
 *
 * 三條規則貫穿整個檔案:
 *
 *  1. **只有木頭。** 沒有石構、沒有金屬建築。柱腳踩的是夯土,不是柱礎;屋頂
 *     鋪的是木瓦,不是筒瓦。上一版的鎏金斗栱整組刪掉了 —— 金箔是荒廢之後第一
 *     個被刮走的東西,而且色盤裡根本沒有金色。
 *  2. **每一件都要看得出「放了很久」。** 正的牌樓、完整的迴廊、四條腿的桌子,
 *     每一個都會讓整個場景退回成「古風布景」。歪、缺、塌是主題本身,不是裝飾。
 *  3. **比例由少數常數導出。** 牌樓的柱、樑、匾額必須一起變大;分開寫就一定
 *     會脫節。
 *
 * 每一棟都把同材質的零件合批成一個 mesh:大廳有兩百多個零件,分開畫是兩百多
 * 次 draw call,而它在畫面上只是一個剪影。
 */

export interface WorldMaterials {
  /** 柱、樑、欄杆、家具。整個場景八成的面積。 */
  timber: MeshStandardMaterial;
  /** 剝漆的板牆。第四章會貼到離它一公尺。 */
  plank: MeshStandardMaterial;
  /** 木瓦屋頂。 */
  shingle: MeshStandardMaterial;
  /** 地:潮土、苔、落葉。 */
  ground: MeshStandardMaterial;
  /** 梅花。全站唯一的飽和色。 */
  blossom: MeshBasicMaterial;
  /** 蛛網。 */
  cobweb: MeshBasicMaterial;
  /** 燈籠剩下的那半張紙。 */
  paper: MeshBasicMaterial;
  /** 劍身。**全場唯一過曝、唯一會進 bloom 的材質。** */
  blade: MeshBasicMaterial;
  /** 從破洞斜射下來的月光柱與它在地上的光池。 */
  moonbeam: MeshBasicMaterial;
  glowMoon: SpriteMaterial;
  glowEmber: SpriteMaterial;
  glowBlade: SpriteMaterial;
}

/** 會被合批的四種材質。其餘的(竹、花、網、紙、劍)各自有自己的透明度規則。 */
type Slot = 'timber' | 'plank' | 'shingle' | 'ground';

/**
 * 全世界共用一份材質。
 *
 * 同一支材質被三十個 mesh 指到,渲染器就只需要綁一次 uniform;每棟樓各配一份
 * 材質則每棟都要重綁,而它們的內容一模一樣。
 */
/**
 * 木構材質的 tint。
 *
 * **不是色盤色。** 貼圖已經是照著色盤畫出來的了(見 textures.ts),材質色再乘
 * 一次朽木褐,等於把同一個顏色平方 —— 反照率 0.07 乘 0.07 剩下 0.005,月光
 * 再亮也照不出輪廓,第一版的畫面就是整片黑。這裡只留一個非常淺的偏冷,
 * 讓所有木頭統一往夜色靠,顏色本身交給貼圖。
 */
const TIMBER_TINT = 0xe6ebee;

/** 屋面專用,比 TIMBER_TINT 暗三成 —— 理由見 createMaterials 裡的註解。 */
const SHINGLE_TINT = 0x9aa3a9;

export function createMaterials(lib: TextureLibrary): WorldMaterials {
  const timberTex = lib.get('timber');
  const plankTex = lib.get('plank');
  const shingleTex = lib.get('shingle');
  const groundTex = lib.get('ground');
  const glowTex = lib.get('glow').map;

  const blade = new MeshBasicMaterial({ fog: true });
  // 唯一一個可以超過 1 的顏色。bloom 的閾值就是照著它調的(見 post.ts)——
  // 劍光要亮到過得去,而月亮、燈籠、窗紙一個都不准過。
  blade.color.setRGB(0.9, 2.9, 2.7);

  return {
    timber: new MeshStandardMaterial({
      map: timberTex.map,
      normalMap: timberTex.normal,
      roughnessMap: timberTex.rough,
      color: TIMBER_TINT,
      roughness: 0.95,
      metalness: 0,
    }),
    plank: new MeshStandardMaterial({
      map: plankTex.map,
      normalMap: plankTex.normal,
      roughnessMap: plankTex.rough,
      color: TIMBER_TINT,
      roughness: 0.93,
      metalness: 0,
      side: DoubleSide,
    }),
    shingle: new MeshStandardMaterial({
      map: shingleTex.map,
      normalMap: shingleTex.normal,
      roughnessMap: shingleTex.rough,
      // 比其餘木構再暗三成。屋面是全場唯一整片朝上的東西,月亮又在高處 ——
      // 用同一個 tint 的話它的 NdotL 幾乎是 1,整片屋頂會亮成一層雪。
      color: SHINGLE_TINT,
      roughness: 0.9,
      metalness: 0,
      side: DoubleSide,
    }),
    ground: new MeshStandardMaterial({
      map: groundTex.map,
      normalMap: groundTex.normal,
      roughnessMap: groundTex.rough,
      color: TIMBER_TINT,
      roughness: 0.98,
      metalness: 0,
    }),
    blossom: new MeshBasicMaterial({
      map: lib.get('blossom').map,
      color: PALETTE.vermilion,
      transparent: true,
      alphaTest: 0.24,
      depthWrite: false,
      side: DoubleSide,
    }),
    cobweb: new MeshBasicMaterial({
      map: lib.get('cobweb').map,
      color: PALETTE.mistCyan,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: DoubleSide,
    }),
    paper: new MeshBasicMaterial({
      map: lib.get('paper').map,
      color: PALETTE.rotBrown,
      transparent: true,
      alphaTest: 0.3,
      side: DoubleSide,
    }),
    blade,
    moonbeam: new MeshBasicMaterial({
      map: glowTex,
      color: PALETTE.moonWhite,
      blending: AdditiveBlending,
      transparent: true,
      // 0.16 太保守:第六章整章就是門縫那一道光,而它在 ACES 之後幾乎不見。
      // 這是全場唯一一個可以「亮」的東西(劍以外),值得一個看得見的數字。
      opacity: 0.26,
      depthWrite: false,
      side: DoubleSide,
      // 加色混合遇上霧會變成「越遠越亮」—— 霧是往霧色混,而霧色本身是要加上去的。
      fog: false,
    }),
    glowMoon: glowSprite(glowTex, PALETTE.moonWhite, 0.34),
    glowEmber: glowSprite(glowTex, PALETTE.vermilion, 0.42),
    glowBlade: glowSprite(glowTex, PALETTE.bladeCyan, 0.5),
  };
}

function glowSprite(map: SpriteMaterial['map'], color: number, opacity: number): SpriteMaterial {
  return new SpriteMaterial({
    map,
    color,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    fog: false,
    opacity,
  });
}

/** 依材質分格子收零件,最後一格併成一個 mesh。 */
function createBin() {
  const bins = new Map<Slot, BufferGeometry[]>();
  return {
    add(slot: Slot, geo: BufferGeometry) {
      const list = bins.get(slot);
      if (list === undefined) bins.set(slot, [geo]);
      else list.push(geo);
    },
    flush(group: Group, mats: WorldMaterials, castShadow: boolean) {
      for (const [slot, list] of bins) {
        const mesh = new Mesh(mergeGeos(list), mats[slot]);
        mesh.castShadow = castShadow;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
      bins.clear();
    },
  };
}

/**
 * 木構橫樑的斷面:下寬上窄、腰部外凸。
 *
 * 這六個點是整座場景唯一不能換成矩形的地方。矩形掃出來的樑沒有那一道斜切,
 * 而斜切是夜裡唯一接得到月光的面 —— 少了它,樑在畫面上只是一條黑槓。
 */
const TIMBER_SECTION = [
  [-0.34, -0.2],
  [0.34, -0.2],
  [0.37, 0.04],
  [0.27, 0.24],
  [-0.27, 0.24],
  [-0.37, 0.04],
] as const;

/** 一根往兩端翹起的橫樑的路徑。power 越大,翹起越集中在末端。 */
function beamPath(half: number, rise: number, power: number, segs = 20): Vector3[] {
  const points: Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const u = (i / segs) * 2 - 1;
    points.push(new Vector3(u * half, Math.pow(Math.abs(u), power) * rise, 0));
  }
  return points;
}

/* -------------------------------------------------------------- 朽樑與殘旗 */

/**
 * 殘旗掛的那根朽樑。
 *
 * 旗子本身**不在這裡** —— 序幕的布幕是另一個人的東西,它要有絲綢的擺動與
 * 被劍劃開的裂口,那是一支 shader 的工作,不是一片幾何。這裡只負責它掛在
 * 什麼上面,並且把掛點的座標交出去(`FLAG_ANCHOR`),讓兩邊對得上同一個點。
 *
 * 兩根柱子刻意不一樣高、橫樑刻意下垂:第一章的鏡頭離它只有七公尺半,
 * 任何一條水平線在那個距離都會被看出來是直的。
 */
export function buildFlagBeam(mats: WorldMaterials, z: number): Group {
  const group = new Group();
  const bin = createBin();

  for (const [x, h, tilt] of [
    [-4.6, 7.1, 0.035],
    [2.9, 6.7, -0.055],
  ] as const) {
    bin.add('timber', lean(at(new CylinderGeometry(0.2, 0.3, h, 10), x, h / 2, 0), tilt, 0.02, 0));
    // 柱腳周圍堆起來的土。木柱不會直接從平地長出來,它是埋進去的。
    bin.add('ground', at(new CylinderGeometry(0.62, 0.82, 0.26, 10), x, 0.1, 0));
  }

  // 橫樑:中間下垂十五公分。一根放了二十年的樑不可能還是直的。
  const span: Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    span.push(new Vector3(-5.0 + u * 8.2, 6.5 - Math.sin(u * Math.PI) * 0.16, 0));
  }
  bin.add('timber', sweepProfile(span, TIMBER_SECTION));

  // 綁旗的繩頭。旗子沒了之後留下來的東西。
  for (const x of [-2.4, 0.9]) {
    bin.add('timber', at(new CylinderGeometry(0.035, 0.03, 0.55, 6), x, 6.05, 0.08));
  }

  bin.flush(group, mats, true);
  group.position.z = z;
  return group;
}

/* ------------------------------------------------------------------ 傾斜牌樓 */

/** 四柱三間。這幾個數字定了整座牌樓,其餘全部由它們導出。 */
const GATE_H = 7.4;
const GATE_BAY = 2.5;
const GATE_SIDE = 3.3;
const GATE_SIDE_RATIO = 0.72;
/** 歪掉的角度。繞 z 軸是左右歪,繞 x 軸是前後仰 —— 兩個都要,只歪一軸讀起來像沒對齊的截圖。 */
export const GATE_LEAN_Z = 0.098;
export const GATE_LEAN_X = 0.046;

/** 整座門共用的傾斜矩陣。每個零件各算一次是同一件事做二十遍。 */
const GATE_LEAN_MATRIX = new Matrix4()
  .makeRotationZ(GATE_LEAN_Z)
  .multiply(new Matrix4().makeRotationX(GATE_LEAN_X));

/**
 * 傾斜之後整座門要往下沉多少。
 *
 * 繞中軸線上的一點轉,一邊的柱腳會鑽進地裡、另一邊會**浮起來**,而浮起來的
 * 那一根是立刻看得出來的假。所以轉完再整個往下壓,壓到最高的那一根柱腳剛好
 * 貼地為止;其餘幾根就埋進土裡 —— 而地基一邊下陷,本來就是這座門會歪的原因。
 *
 * 量的是外柱那一對:它們離中軸最遠,抬得最高。
 */
function gateFootLift(): number {
  const outer = GATE_BAY + GATE_SIDE;
  const mound = 0.85;
  return outer * Math.sin(GATE_LEAN_Z) + mound * Math.sin(GATE_LEAN_X) * Math.cos(GATE_LEAN_Z);
}

export interface LeaningGate {
  group: Group;
  /** 柱頂相對柱腳偏了多遠。歪掉這件事必須量得到,不然它只是「看起來有點怪」。 */
  topOffset: number;
  /** 最高的那一根柱腳落在哪。必須 ≤ 0,否則那一根是浮在地上的。 */
  footY: number;
}

/**
 * 傾斜的牌樓。
 *
 * 歪就是重點:這裡荒廢了很多年,地基一邊陷下去,整座門跟著偏。所以傾斜是
 * **烘進頂點裡**的(見 geometry.ts 的 `lean`),不是轉一下 Group ——
 * 轉 Group 的話幾何本身還是正的,合批要多留一層 transform,測試也量不到。
 *
 * 另外少了一半:右邊的側間屋頂整個沒了,只剩幾根桁條;匾額只剩一根釘子吊著,
 * 所以是斜的。完整的牌樓會把整個場景拉回「古風布景」。
 */
export function buildLeaningGate(mats: WorldMaterials): LeaningGate {
  const group = new Group();
  const bin = createBin();
  const outer = GATE_BAY + GATE_SIDE;
  const sideH = GATE_H * GATE_SIDE_RATIO;

  for (const s of [-1, 1]) {
    for (const [x, h, rTop, rBot] of [
      [s * GATE_BAY, GATE_H, 0.26, 0.36],
      [s * outer, sideH, 0.22, 0.31],
    ] as const) {
      // 柱身上細下粗。等粗的柱子看起來會往上撐開,那是視覺,不是幾何。
      bin.add('timber', at(new CylinderGeometry(rTop, rBot, h, 14), x, h / 2, 0));
      // 柱腳的土堆與夯實的一圈。沒有柱礎 —— 這個世界裡沒有石頭。
      bin.add('ground', at(new CylinderGeometry(rBot * 1.9, rBot * 2.6, 0.3, 12), x, 0.12, 0));
    }
  }

  // 額枋:穿過四根柱子的直樑,兩道。上面那道托住中間一間的屋頂。
  bin.add('timber', at(new BoxGeometry(outer * 2 + 0.9, 0.46, 0.34), 0, sideH - 0.7, 0));
  bin.add('timber', at(new BoxGeometry(GATE_BAY * 2 + 0.8, 0.42, 0.32), 0, GATE_H - 1.5, 0));
  bin.add('timber', at(new BoxGeometry(outer * 2 + 0.6, 0.26, 0.24), 0, GATE_H * 0.44, 0));

  // 匾額:只剩一根釘子吊著,所以歪了十五度。它是整座門唯一「有話要說」的部位,
  // 而它現在說不出話了。
  bin.add(
    'plank',
    lean(
      scaleUv(at(new BoxGeometry(2.5, 1.1, 0.12), 0, GATE_H - 1.02, 0.2), 0.5, 0.3),
      0.26,
      0,
      GATE_H - 0.5,
    ),
  );

  // 中間一間的翹樑。
  bin.add(
    'timber',
    at(sweepProfile(beamPath(GATE_BAY + 1.0, 0.34, 2.6), TIMBER_SECTION), 0, GATE_H - 0.2, 0),
  );

  // 中央屋頂:還在,但木瓦掉了不少(那是貼圖的事)。
  bin.add(
    'shingle',
    at(
      flaredRoof({
        halfWidth: GATE_BAY + 0.85,
        halfDepth: 1.5,
        ridgeHalf: GATE_BAY * 0.5,
        rise: 1.15,
        thickness: 0.2,
        flare: 0.72,
        segX: 26,
        segZ: 18,
        tileScale: 0.34,
      }),
      0,
      GATE_H + 0.55,
      0,
    ),
  );

  // 左側間的屋頂還在;右側間只剩桁條。缺的那一半才是這座門的故事。
  bin.add(
    'shingle',
    at(
      flaredRoof({
        halfWidth: GATE_SIDE / 2 + 0.7,
        halfDepth: 1.25,
        ridgeHalf: GATE_SIDE * 0.28,
        rise: 0.85,
        thickness: 0.17,
        flare: 0.68,
        segX: 20,
        segZ: 14,
        tileScale: 0.34,
      }),
      -(GATE_BAY + GATE_SIDE / 2),
      sideH + 0.45,
      0,
    ),
  );
  for (const [dz, len] of [
    [-0.9, GATE_SIDE + 1.1],
    [0, GATE_SIDE + 1.3],
    [0.9, GATE_SIDE + 0.7],
  ] as const) {
    bin.add(
      'timber',
      at(new BoxGeometry(len, 0.14, 0.14), GATE_BAY + GATE_SIDE / 2, sideH + 0.42, dz),
    );
  }

  // 一段垮下來的側枋,斜靠在柱子上。
  bin.add(
    'timber',
    lean(at(new BoxGeometry(0.24, 3.4, 0.2), GATE_BAY + GATE_SIDE * 0.55, 1.7, 0.6), 0.5, 0.1, 0),
  );

  bin.flush(group, mats, true);

  // 蛛網:掛在還在的那一邊的內角。位置**烘進幾何**而不是放在 mesh 的 transform
  // 上,底下那一輪傾斜才吃得到它 —— 只轉幾何的話,網會留在原地不跟著歪。
  const webGeo: BufferGeometry = new PlaneGeometry(1.5, 1.5);
  webGeo.rotateZ(Math.PI / 2);
  group.add(new Mesh(at(webGeo, -(GATE_BAY + 0.75), GATE_H - 2.1, 0.02), mats.cobweb));

  // 整座歪掉。柱腳還踩在原地,柱頂偏出去。
  const sink = gateFootLift() + 0.06;
  for (const child of group.children) {
    if (!(child instanceof Mesh)) continue;
    // three 的 Mesh 是泛型的,instanceof narrowing 之後 geometry 會退成 any。
    const geo = (child as Mesh<BufferGeometry>).geometry;
    geo.applyMatrix4(GATE_LEAN_MATRIX);
    geo.translate(0, -sink, 0);
  }

  return {
    group,
    topOffset: Math.hypot(
      GATE_H * Math.sin(GATE_LEAN_Z),
      GATE_H * Math.sin(GATE_LEAN_X) * Math.cos(GATE_LEAN_Z),
    ),
    footY: gateFootLift() - sink,
  };
}

/* ------------------------------------------------------------------ 半榻迴廊 */

export interface WalkwayOptions {
  /** 外柱那一排的 x。廊往中軸方向展開,寬度由 width 給。 */
  x: number;
  z0: number;
  z1: number;
  width: number;
  bays: number;
  /** 往內是 -1 還是 +1。 */
  inward: 1 | -1;
  seed: number;
}

/** 屋頂垮掉的那一段從第幾間到第幾間(含)。榻掉的必須是連續的一段,不是隨機幾間。 */
const WALKWAY_COLLAPSE = 2;

/**
 * 半榻的迴廊。
 *
 * 「半榻」不是「有點舊」:柱子少了幾根,屋頂在少柱的地方垂下去,中間一整段
 * 整個垮在地上。所以屋面不是一條直線,是一條**折線** —— 這條折線是整個場景
 * 裡最清楚的一句話。
 *
 * 屋面用 sweepProfile 沿著下垂的路徑掃出來,而不是一片斜的平面:平面沒有辦法
 * 在「兩根柱子之間垂下去」這件事上撒謊。
 */
export function buildWalkway(mats: WorldMaterials, options: WalkwayOptions): Group {
  const group = new Group();
  const bin = createBin();
  const { x, z0, z1, width, bays, inward, seed } = options;
  const rand = mulberry32(seed);
  const inner = x + inward * width;
  const step = (z1 - z0) / bays;
  const DECK = 0.34;
  const POST = 3.6;

  // 哪幾根柱子不見了。先抽好,底下的屋面下垂量要問它。
  const gone: boolean[] = [];
  for (let i = 0; i <= bays; i++) gone.push(rand() < 0.26);
  // 垮掉的那一段:連續兩間,位置由種子決定。
  const collapseFrom = 1 + Math.floor(rand() * (bays - WALKWAY_COLLAPSE - 1));
  const collapseTo = collapseFrom + WALKWAY_COLLAPSE;

  // 木地板:一段一段的,垮掉那一段沒有。
  for (let i = 0; i < bays; i++) {
    if (i >= collapseFrom && i < collapseTo) continue;
    const z = z0 + step * (i + 0.5);
    bin.add(
      'plank',
      scaleUv(
        at(new BoxGeometry(width + 0.4, DECK, Math.abs(step) - 0.12), (x + inner) / 2, DECK / 2, z),
        1.2,
        1.4,
      ),
    );
  }

  for (let i = 0; i <= bays; i++) {
    const z = z0 + step * i;
    const collapsed = i > collapseFrom && i < collapseTo;
    for (const [px, r] of [
      [x, 0.19],
      [inner, 0.17],
    ] as const) {
      if (gone[i] === true || collapsed) {
        // 斷柱:只剩腳。斷面比柱身寬一點,讀起來才是折斷不是切斷。
        bin.add('timber', at(new CylinderGeometry(r * 1.25, r * 1.35, 0.5, 10), px, 0.25, z));
        continue;
      }
      bin.add('timber', at(new CylinderGeometry(r * 0.85, r, POST, 10), px, POST / 2, z));
    }
    // 欄杆:外側一道,缺了不少直櫺。
    if (i < bays && gone[i] !== true && gone[i + 1] !== true && !collapsed) {
      bin.add(
        'timber',
        at(new BoxGeometry(0.1, 0.09, Math.abs(step)), x, DECK + 0.92, z + step / 2),
      );
      for (let k = 1; k < 5; k++) {
        if (rand() < 0.3) continue;
        bin.add('timber', at(new BoxGeometry(0.07, 0.9, 0.07), x, DECK + 0.47, z + (step * k) / 5));
      }
    }
  }

  // 屋面:沿著下垂的折線掃。缺柱的地方垂下去,垮掉的那一段整個不畫。
  const sagAt = (i: number) => {
    if (gone[i] !== true) return 0;
    const before = gone[Math.max(0, i - 1)] === true;
    const after = gone[Math.min(bays, i + 1)] === true;
    // 連著兩根都不見,中間垂得更多。一根一根算的話折線會是均勻的鋸齒。
    return before || after ? 1.05 : 0.5;
  };
  const runs: Vector3[][] = [];
  let current: Vector3[] = [];
  for (let i = 0; i <= bays; i++) {
    if (i >= collapseFrom && i <= collapseTo) {
      if (current.length > 1) runs.push(current);
      current = [];
      continue;
    }
    current.push(new Vector3((x + inner) / 2, POST + 0.55 - sagAt(i), z0 + step * i));
  }
  if (current.length > 1) runs.push(current);
  for (const run of runs) {
    bin.add(
      'shingle',
      sweepProfile(run, [
        [-(width / 2 + 0.75), -0.12],
        [width / 2 + 0.75, -0.12],
        [width / 2 + 0.55, 0.14],
        [-(width / 2 + 0.55), 0.14],
      ]),
    );
  }

  // 垮下來的東西堆在地上。少了這一堆,那一段看起來是「本來就沒蓋」。
  const midZ = z0 + step * (collapseFrom + WALKWAY_COLLAPSE / 2);
  for (let i = 0; i < 5; i++) {
    const len = 1.8 + rand() * 2.6;
    bin.add(
      'timber',
      lean(
        turnY(
          at(
            new BoxGeometry(len, 0.18, 0.22),
            (x + inner) / 2 + (rand() - 0.5) * width,
            0.12 + rand() * 0.3,
            midZ + (rand() - 0.5) * Math.abs(step) * 2,
          ),
          rand() * Math.PI,
        ),
        (rand() - 0.5) * 0.5,
        (rand() - 0.5) * 0.4,
        0,
      ),
    );
  }

  bin.flush(group, mats, true);
  return group;
}

/* -------------------------------------------------------------- 練武大廳 */

export interface SitePlan {
  /** 前庭的半寬。 */
  courtHalf: number;
  /** 朽樑(殘旗)的 z。 */
  flagBeamZ: number;
  /** 牌樓的 z。 */
  gateZ: number;
  /** 迴廊的 x(外柱)與起訖 z。 */
  walkwayX: number;
  walkwayZ0: number;
  walkwayZ1: number;
  /** 大廳:正面、背面、半寬。 */
  hallFrontZ: number;
  hallBackZ: number;
  hallHalfW: number;
  /** 台基高。大廳的地板在這個高度。 */
  plinth: number;
  /** 柱頂(不含斗與樑)。 */
  postTop: number;
  /** 簷口基準。屋面的高度是從這裡往上加的。 */
  eaveY: number;
  /** 屋頂破洞的世界 x/z。y 由屋面曲線算出來,不寫死。 */
  holeX: number;
  holeZ: number;
  /** 月亮的位置。月光的方向、破洞的光柱、桌子的落點全部由它導出。 */
  moon: readonly [number, number, number];
}

export interface Hall {
  group: Group;
  /** 雙開木門。微啟的角度烘在幾何裡,這裡只是為了讓門的位置拿得到。 */
  doors: Group;
  /** 堂內的冷光。整個世界只有月亮與一盞餘燼是光源,所以它必須拿得動。 */
  lights: PointLight[];
  /** 斷腿木桌的桌面中心。月光落在這裡 —— 這是算出來的,不是擺出來的。 */
  tableTop: Vector3;
  /** 破洞的中心(世界座標)。枯梅的枝要伸進這裡。 */
  holeCentre: Vector3;
}

/** 屋面的參數。破洞的 y 與光柱的長度都要問它,所以抽出來給 buildHall 與場地平面圖共用。 */
export function hallRoofOptions(plan: SitePlan): FlaredRoofOptions {
  const depth = Math.abs(plan.hallBackZ - plan.hallFrontZ);
  return {
    halfWidth: plan.hallHalfW + 2.2,
    halfDepth: depth / 2 + 3.0,
    ridgeHalf: plan.hallHalfW * 0.44,
    rise: 4.4,
    thickness: 0.4,
    flare: 0.6,
    segX: 46,
    segZ: 42,
    tileScale: 0.2,
    hole: {
      x: plan.holeX,
      z: plan.holeZ - (plan.hallFrontZ + plan.hallBackZ) / 2,
      rx: 3.5,
      rz: 2.9,
      ragged: 0.26,
      seed: 13,
    },
  };
}

/** 月光行進的方向(單位向量)。從月亮射向大廳中心。 */
export function moonDirection(plan: SitePlan): Vector3 {
  const centre = new Vector3(0, 2, (plan.hallFrontZ + plan.hallBackZ) / 2);
  return centre.sub(new Vector3(plan.moon[0], plan.moon[1], plan.moon[2])).normalize();
}

/** 破洞中心的世界座標。y 由屋面曲線決定。 */
export function holeCentre(plan: SitePlan): Vector3 {
  const roof = hallRoofOptions(plan);
  const localZ = plan.holeZ - (plan.hallFrontZ + plan.hallBackZ) / 2;
  const y = plan.eaveY + flaredRoofHeight(roof, plan.holeX, localZ) - roof.thickness / 2;
  return new Vector3(plan.holeX, y, plan.holeZ);
}

/**
 * 月光從破洞射進來,落在哪裡。
 *
 * 這是整個場地平面圖裡唯一**不能用手擺**的座標。規格說「月光穿過破洞落在
 * 斷腿木桌上」,而洞的高度由屋面曲線給、光的方向由月亮的位置給 ——
 * 桌子的位置只要自己寫死一次,調一次屋頂或移一次月亮就會得到一道打在半空中
 * 的月光,而那是沒有人會回頭去修的那種錯。所以它是算出來的。
 */
export function shaftLanding(plan: SitePlan, y: number): Vector3 {
  const from = holeCentre(plan);
  const dir = moonDirection(plan);
  const t = (from.y - y) / Math.max(-dir.y, 1e-4);
  return from.clone().addScaledVector(dir, t);
}

/** 桌面的高度(世界 y)。台基 + 桌高。 */
export function tableTopY(plan: SitePlan): number {
  return plan.plinth + 0.78;
}

/**
 * 正面那一排柱子的 x。
 *
 * 公開出去是因為**相機會從這一排中間穿過去**(第二章末尾從門楣上方的欄間
 * 進大廳)。柱位與站位是同一個構圖問題的兩半:柱子往內挪三十公分,或者
 * waypoint 往外挪三十公分,結果都是鏡頭刮過一根柱子而沒有人看得出為什麼。
 * `camera.test.ts` 量它們之間的淨空。
 */
export function hallFrontPosts(halfWidth: number): number[] {
  return [-halfWidth, -7.0, -2.4, 2.4, 7.0, halfWidth];
}

/** 正面柱的半徑。淨空要扣掉它。 */
export const HALL_POST_RADIUS = 0.3;

export function buildHall(mats: WorldMaterials, plan: SitePlan): Hall {
  const group = new Group();
  const bin = createBin();
  const { hallFrontZ: fz, hallBackZ: bz, hallHalfW: hw, plinth, postTop, eaveY } = plan;
  const midZ = (fz + bz) / 2;
  const depth = Math.abs(bz - fz);
  /** 門洞的半寬。相機在第二、三章從門上方的欄間進來,第五到六章從門洞出去。 */
  const DOOR_HALF = 1.8;
  const DOOR_TOP = plinth + 4.1;
  /** 欄間:門楣以上到簷下。木格全爛光了,所以是空的 —— 鏡頭從這裡進場。 */
  const TRANSOM = DOOR_TOP + 0.25;

  /* 台基:木造的高台,不是石砌。前緣缺了一角。 */
  bin.add(
    'plank',
    scaleUv(at(new BoxGeometry(hw * 2 + 1.6, plinth, depth + 1.6), 0, plinth / 2, midZ), 5, 7),
  );

  /* 柱。正面的柱位刻意讓開門洞兩側與相機進場的那一格。 */
  const frontX = hallFrontPosts(hw);
  for (const x of frontX) {
    bin.add(
      'timber',
      at(new CylinderGeometry(0.24, 0.3, postTop - plinth, 12), x, (postTop + plinth) / 2, fz),
    );
  }
  const sideZ: number[] = [];
  for (let i = 1; i <= 5; i++) sideZ.push(fz - (depth * i) / 6);
  for (const z of [...sideZ, bz]) {
    for (const s of [-1, 1]) {
      bin.add(
        'timber',
        at(
          new CylinderGeometry(0.24, 0.3, postTop - plinth, 12),
          s * hw,
          (postTop + plinth) / 2,
          z,
        ),
      );
    }
  }

  /* 正面:門檻牆 + 破格窗 + 門楣。欄間以上全空。 */
  for (const [x0, x1] of [
    [-hw, -DOOR_HALF],
    [DOOR_HALF, hw],
  ] as const) {
    const w = x1 - x0;
    const cx = (x0 + x1) / 2;
    // 檻牆
    bin.add('plank', scaleUv(at(new BoxGeometry(w, 1.1, 0.14), cx, plinth + 0.55, fz), 1.6, 0.5));
    // 破格窗:直櫺與橫串,中間缺了好幾根。缺哪幾根由座標決定,不是亂數 ——
    // 同一個位置重新載入要是同一扇破窗。
    const sillY = plinth + 1.1;
    const winH = DOOR_TOP - sillY;
    for (let k = 0; k <= Math.round(w / 0.34); k++) {
      const x = x0 + k * 0.34;
      if (x > x1) break;
      if ((k * 7) % 5 === 0 || (k * 11) % 7 === 1) continue;
      bin.add(
        'timber',
        at(
          new BoxGeometry(0.055, winH * (k % 3 === 0 ? 0.62 : 1), 0.07),
          x,
          sillY + (winH * (k % 3 === 0 ? 0.62 : 1)) / 2,
          fz,
        ),
      );
    }
    for (const t of [0.28, 0.64]) {
      bin.add('timber', at(new BoxGeometry(w * 0.92, 0.07, 0.09), cx, sillY + winH * t, fz));
    }
    bin.add('timber', at(new BoxGeometry(w, 0.16, 0.2), cx, sillY, fz));
  }
  // 門楣與欄間的殘骸。中央留空,那是鏡頭進場的路。
  bin.add('timber', at(new BoxGeometry(hw * 2 + 0.5, 0.3, 0.28), 0, DOOR_TOP + 0.1, fz));
  for (const x of [-8.4, -7.6, 7.4, 8.6]) {
    bin.add(
      'timber',
      at(new BoxGeometry(0.06, postTop - TRANSOM, 0.07), x, (postTop + TRANSOM) / 2, fz),
    );
  }

  /* 側牆:板牆到門楣高。西側中間一整間塌了,枯梅與月光從那裡也透一點進來。 */
  const WEST_GAP: readonly [number, number] = [fz - depth * 0.34, fz - depth * 0.58];
  for (const s of [-1, 1]) {
    const segments: Array<readonly [number, number]> =
      s === -1
        ? [
            [fz, WEST_GAP[0]],
            [WEST_GAP[1], bz],
          ]
        : [[fz, bz]];
    for (const [za, zb] of segments) {
      const len = Math.abs(zb - za);
      bin.add(
        'plank',
        scaleUv(
          at(
            new BoxGeometry(0.13, DOOR_TOP - plinth, len),
            s * hw,
            (DOOR_TOP + plinth) / 2,
            (za + zb) / 2,
          ),
          0.09 * len,
          1,
        ),
      );
    }
  }
  // 塌掉那一段的斷板,斜掛在缺口邊。
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    bin.add(
      'plank',
      lean(
        at(
          new BoxGeometry(0.12, 2.6 - i * 0.4, 0.3),
          -hw,
          plinth + 1.2,
          WEST_GAP[0] - t * Math.abs(WEST_GAP[1] - WEST_GAP[0]),
        ),
        0,
        0.3 + i * 0.12,
        plinth,
      ),
    );
  }

  /* 背牆:剝漆木牆。第四章的鏡頭會貼到離它一公尺,所以它是全場唯一一張 1024。 */
  bin.add(
    'plank',
    scaleUv(
      at(
        new BoxGeometry(hw * 2 + 0.3, postTop - plinth + 0.4, 0.16),
        0,
        (postTop + plinth) / 2 + 0.2,
        bz,
      ),
      2.2,
      1,
    ),
  );
  // 靠在背牆上的斷兵器架。第四章的前景要有一個東西擋在牆與鏡頭之間,
  // 不然那一章只剩一面平的牆。
  bin.add('timber', at(new BoxGeometry(3.4, 0.14, 0.16), -5.4, plinth + 1.9, bz + 0.42));
  for (const x of [-6.8, -4.0]) {
    bin.add('timber', at(new CylinderGeometry(0.09, 0.11, 2.1, 8), x, plinth + 1.05, bz + 0.42));
  }
  bin.add(
    'timber',
    lean(at(new BoxGeometry(0.16, 2.4, 0.16), -3.2, plinth + 1.2, bz + 0.8), 0.42, 0, plinth),
  );

  /* 樑與椽。破洞看得到底下,所以椽木必須真的在。 */
  for (const s of [-1, 1]) {
    bin.add('timber', at(new BoxGeometry(0.3, 0.42, depth + 0.6), s * hw, postTop + 0.3, midZ));
  }
  for (const z of [fz - 1.5, midZ, bz + 1.5]) {
    bin.add('timber', at(new BoxGeometry(hw * 2 + 0.6, 0.38, 0.34), 0, postTop + 0.3, z));
  }
  for (let i = 0; i <= 14; i++) {
    const z = fz - (depth * i) / 14;
    bin.add('timber', at(new BoxGeometry(hw * 2 + 3.6, 0.13, 0.15), 0, eaveY - 0.5, z));
  }

  /* 屋面。破洞在裡面 —— 洞緣的斷面由 flaredRoof 自己縫。 */
  const roof = hallRoofOptions(plan);
  bin.add('shingle', at(flaredRoof(roof), 0, eaveY, midZ));
  // 正脊。屋頂沒有脊就少了最上面那條線,而第七章整章就是在看那條線。
  bin.add(
    'timber',
    at(
      sweepProfile(beamPath(hw * 0.5, 0.5, 2.2, 16), TIMBER_SECTION),
      0,
      eaveY + roof.rise + 0.1,
      midZ,
    ),
  );

  const hole = holeCentre(plan);
  const tableY = tableTopY(plan);
  const landing = shaftLanding(plan, tableY);

  // 破洞底下垂下來的斷椽。它是「這個洞是塌出來的」唯一的近距離證據。
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    bin.add(
      'timber',
      lean(
        at(
          new BoxGeometry(0.12, 1.4 + (i % 3) * 0.5, 0.13),
          hole.x + Math.cos(a) * 2.6,
          hole.y - 0.9,
          hole.z + Math.sin(a) * 2.2,
        ),
        0.3 + (i % 2) * 0.5,
        0.25 * (i % 3) - 0.25,
        hole.y,
      ),
    );
  }

  /* 斷腿木桌。桌面中心就是月光的落點 —— 見 shaftLanding。 */
  addBrokenTable(bin, landing.x, plinth, landing.z, tableY);

  bin.flush(group, mats, true);

  /* 雙開木門:微啟。左扇推開得多,右扇只剩一條縫。 */
  const doors = new Group();
  const doorBin = createBin();
  const LEAF_W = DOOR_HALF - 0.03;
  for (const [hx, open] of [
    [-DOOR_HALF, 0.46],
    [DOOR_HALF, 0.17],
  ] as const) {
    // 合頁在門洞兩側,門板往中間伸。swing 是它伸的方向。
    const swing = hx < 0 ? 1 : -1;
    const leaf = new BoxGeometry(LEAF_W, DOOR_TOP - plinth - 0.05, 0.08);
    at(leaf, (swing * LEAF_W) / 2, 0, 0);
    scaleUv(leaf, 0.55, 1.4);
    // 繞 Y 轉會把 +x 帶向 −z,而門是往外(+z)開的,所以角度要反號。
    turnY(leaf, -swing * open);
    doorBin.add('plank', at(leaf, hx, (DOOR_TOP + plinth) / 2, fz));
  }
  doorBin.flush(doors, mats, true);
  group.add(doors);

  // 門縫透出來的那一道月光。第六章整章就是這條縫 —— 光是從**裡面**出來的,
  // 所以貼片站在門的內側,而不是外面加一盞燈。
  const gapLeft = -DOOR_HALF + LEAF_W * Math.cos(0.46);
  const gapRight = DOOR_HALF - LEAF_W * Math.cos(0.17);
  const blade = new Mesh(
    new PlaneGeometry(Math.max(0.16, gapRight - gapLeft), DOOR_TOP - plinth - 0.4),
    mats.moonbeam,
  );
  blade.position.set((gapLeft + gapRight) / 2, (DOOR_TOP + plinth) / 2, fz - 0.16);
  blade.renderOrder = 3;
  group.add(blade);

  /* 月光:一道從洞口斜下來的光柱,加上落在桌面上的光池。 */
  const dir = moonDirection(plan);
  const beamPathPoints: Vector3[] = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    beamPathPoints.push(hole.clone().addScaledVector(dir, t * hole.distanceTo(landing)));
  }
  const beamGeo = sweepProfile(beamPathPoints, [
    [-1.5, -1.3],
    [1.5, -1.3],
    [1.5, 1.3],
    [-1.5, 1.3],
  ]);
  const beam = new Mesh(beamGeo, mats.moonbeam);
  beam.renderOrder = 3;
  group.add(beam);

  const pool = new Mesh(new PlaneGeometry(5.2, 5.2), mats.moonbeam);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(landing.x + 0.6, plinth + 0.02, landing.z + 1.2);
  pool.renderOrder = 3;
  group.add(pool);

  /* 堂內的光。冷的、弱的、只夠讓門縫透出一條白 —— 這是月光,不是燈。 */
  const lights: PointLight[] = [];
  // 第三盞是**掠著背牆打**的。破洞就在背牆的正上方,所以洞緣往下漏的那一點
  // 光本來就會順著牆面流下來 —— 而第四章整章就是那面牆的木紋與鏽釘,少了
  // 這一道掠射光,法線貼圖上的每一道裂縫都不存在,那一章是一塊深藍色的板子。
  for (const [x, y, z, power, range] of [
    [landing.x, tableY + 1.4, landing.z, 5.4, 17],
    [0, plinth + 1.8, fz - 3.6, 5.8, 14],
    [-1.2, postTop - 0.6, bz + 1.1, 4.6, 13],
  ] as const) {
    const l = new PointLight(PALETTE.moonWhite, power, range, 2);
    l.position.set(x, y, z);
    group.add(l);
    lights.push(l);
  }

  /* 蛛網:破窗的內角各一片。 */
  for (const s of [-1, 1]) {
    const web = new Mesh(new PlaneGeometry(1.6, 1.6), mats.cobweb);
    web.position.set(s * (hw - 1.2), DOOR_TOP - 0.9, fz - 0.12);
    web.rotation.z = s > 0 ? Math.PI / 2 : 0;
    group.add(web);
  }

  return {
    group,
    doors,
    lights,
    tableTop: new Vector3(landing.x, tableY, landing.z),
    holeCentre: hole,
  };
}

/**
 * 斷腿木桌。
 *
 * 一條腿折了,所以桌面往那一角傾。傾斜量是**算出來的**(桌面半長 × sin θ),
 * 不是挑一個看起來還可以的角度 —— 挑的角度會讓桌角浮在地板上方兩公分,而在
 * 第三章那個鏡位,兩公分就是十幾個像素的縫。
 */
function addBrokenTable(
  bin: ReturnType<typeof createBin>,
  x: number,
  floorY: number,
  z: number,
  topY: number,
): void {
  const HALF_W = 1.25;
  const HALF_D = 0.58;
  const LEG = topY - floorY - 0.06;
  const TILT = 0.1;

  const top = at(new BoxGeometry(HALF_W * 2, 0.09, HALF_D * 2), 0, 0, 0);
  lean(top, TILT, 0.035, 0);
  bin.add('timber', at(scaleUv(top, 1.2, 0.6), x, topY, z));

  // 三條好腿。第四條(左前)只剩上半截,斷口斜著。
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, -1],
  ] as const) {
    const lx = sx * (HALF_W - 0.16);
    const lz = sz * (HALF_D - 0.14);
    // 桌面歪了,所以每條腿要吃到的長度不一樣。
    const drop = LEG + lx * Math.sin(TILT);
    bin.add('timber', at(new BoxGeometry(0.11, drop, 0.11), x + lx, floorY + drop / 2, z + lz));
  }
  const bx = x - (HALF_W - 0.16);
  const bz2 = z + (HALF_D - 0.14);
  const stub = LEG * 0.42;
  bin.add('timber', at(new BoxGeometry(0.11, stub, 0.11), bx, topY - 0.05 - stub / 2, bz2));
  // 折下來的那一截倒在旁邊。
  bin.add(
    'timber',
    lean(
      at(new BoxGeometry(0.11, LEG * 0.55, 0.11), bx - 0.5, floorY + 0.06, bz2 + 0.35),
      1.42,
      0.2,
      floorY,
    ),
  );
}

/* ------------------------------------------------------------------ 竹 */

/**
 * 一根竹子的幾何,**單位高**(y 從 0 到 1),給 InstancedMesh 用。
 *
 * 為什麼是單位高:整片竹林是一個 InstancedMesh —— 一次 draw call 畫完八十幾根。
 * 而共用的風場 shader(`WIND_VERTEX_CHUNK`)靠 `position.y` 當高度遮罩,
 * 那個遮罩只有在幾何是單位高的時候才是「從根到梢的 0…1」。真實高度由
 * instanceMatrix 的 y 縮放給,擺幅則由 `uSway` 用世界公尺給,兩者互不干涉。
 *
 * 竹身與葉子共用一支材質(圖集的左半與右半),所以連葉子都不用第二次
 * draw call。分成兩支材質的話,一片竹林就是兩倍的成本,而它在畫面上是影子。
 *
 * 每一根都一樣?是的 —— 差異來自實例的旋轉與縮放。`variant` 給三種不同的
 * 弓法與葉子分布,三個 InstancedMesh 就夠讓眼睛認不出重複,而三次 draw call
 * 仍然是一個可以忽略的數字。
 */
export function makeCulmGeometry(variant: number): BufferGeometry {
  const rand = mulberry32(9100 + variant * 37);
  const parts: BufferGeometry[] = [];
  const nodes = 8 + Math.floor(rand() * 4);
  // 單位高之下的半徑。實例是**等比**縮放的(scale = 高度),所以 s = 10 的
  // 一根竹子半徑是 5.5 公分、葉叢半公尺 —— 高的竹子本來就比較粗、葉子也比較大。
  // 非等比縮放會把葉片的貼片往上拉成麵條,那是這裡一定要等比的原因。
  const rBase = 0.0055;
  // 整根往一個方向弓。直的竹子是旗桿。弓度是單位高的比例。
  const bowX = (rand() - 0.5) * 0.12;
  const bowZ = (rand() - 0.5) * 0.12;

  let y = 0;
  for (let i = 0; i < nodes; i++) {
    const t0 = i / nodes;
    const t1 = (i + 1) / nodes;
    const len = (1 / nodes) * (0.86 + t0 * 0.3);
    const r0 = rBase * (1 - t0 * 0.6);
    const r1 = rBase * (1 - t1 * 0.6);
    const cx = bowX * t0 * t0;
    const cz = bowZ * t0 * t0;
    parts.push(scaleUv(at(new CylinderGeometry(r1, r0, len, 5, 1), cx, y + len / 2, cz), 0.46, 1));
    // 竹節:一圈略寬的環。沒有節的竹子是水管。
    parts.push(
      scaleUv(at(new CylinderGeometry(r1 * 1.3, r1 * 1.3, 0.004, 5), cx, y + len, cz), 0.46, 1),
    );
    y += len;
  }

  // 葉叢:上四成,幾片交叉的貼片。uv 推到圖集右半。
  const leaves = 5 + Math.floor(rand() * 4);
  for (let i = 0; i < leaves; i++) {
    const ly = 0.58 + rand() * 0.42;
    const size = 0.045 + rand() * 0.03;
    const card = offsetUv(scaleUv(new PlaneGeometry(size, size), 0.46, 1), 0.52, 0);
    turnY(card, rand() * Math.PI * 2);
    parts.push(
      at(card, bowX * ly * ly + (rand() - 0.5) * 0.05, ly, bowZ * ly * ly + (rand() - 0.5) * 0.05),
    );
  }

  return mergeGeos(parts);
}

/* ------------------------------------------------------------------ 枯梅 */

export interface PlumTree {
  group: Group;
  /** 會被風吹的主枝。每一枝各自註冊進風場,整棵樹才不會像一塊板子在晃。 */
  boughs: Group[];
}

/**
 * 枯梅:枯枝為主,花很少。
 *
 * 花少才是「花信」—— 一樹繁花是春天,而這裡是一座荒廢的武館。朱紅是全站唯一
 * 的飽和色,它必須稀有到每一朵都數得出來。
 *
 * 枝是遞迴長出來的:每一段生兩到三個子段,角度與長度各自遞減。遞迴的深度只有
 * 三層 —— 再多就是一團看不清楚的毛,而枯枝的辨識度完全靠「看得見每一根的走向」。
 */
export function buildPlum(mats: WorldMaterials, seed: number, scale = 1): PlumTree {
  const group = new Group();
  const rand = mulberry32(seed);
  const trunkH = 2.4 * scale;

  const trunkBin: BufferGeometry[] = [];
  trunkBin.push(
    lean(
      at(new CylinderGeometry(0.14 * scale, 0.26 * scale, trunkH, 9), 0, trunkH / 2, 0),
      0.08,
      -0.12,
      0,
    ),
  );
  const trunkMesh = new Mesh(mergeGeos(trunkBin), mats.timber);
  trunkMesh.castShadow = true;
  group.add(trunkMesh);

  const boughs: Group[] = [];
  const count = 3;
  for (let b = 0; b < count; b++) {
    const pivot = new Group();
    pivot.position.set(0, trunkH * 0.92, 0);
    const wood: BufferGeometry[] = [];
    const flowers: BufferGeometry[] = [];

    const grow = (
      from: Vector3,
      dir: Vector3,
      length: number,
      radius: number,
      depth: number,
    ): void => {
      const to = from.clone().addScaledVector(dir, length);
      const mid = from.clone().lerp(to, 0.5);
      const seg = new CylinderGeometry(radius * 0.65, radius, length, 6);
      // 圓柱預設沿 +y,要把它轉到 dir 上:轉軸是 y × dir,角度是兩者的夾角。
      // 幾乎平行時外積退化成零向量,那時本來就不用轉。
      const up = new Vector3(0, 1, 0);
      const axis = up.clone().cross(dir);
      if (axis.lengthSq() > 1e-8) {
        axis.normalize();
        seg.applyMatrix4(
          new Matrix4().makeRotationAxis(axis, Math.acos(clamp(up.dot(dir), -1, 1))),
        );
      }
      wood.push(at(seg, mid.x, mid.y, mid.z));

      if (depth === 0) {
        // 末梢才開花,而且不是每一根都開。
        if (rand() < 0.55) {
          const petal = new PlaneGeometry(0.22 * scale, 0.22 * scale);
          turnY(petal, rand() * Math.PI * 2);
          flowers.push(at(petal, to.x, to.y, to.z));
        }
        return;
      }
      const kids = rand() < 0.35 ? 3 : 2;
      for (let k = 0; k < kids; k++) {
        const spread = 0.55 + rand() * 0.55;
        const a = (k / kids) * Math.PI * 2 + rand();
        const next = new Vector3(
          dir.x + Math.cos(a) * spread,
          dir.y + 0.24 - rand() * 0.3,
          dir.z + Math.sin(a) * spread,
        ).normalize();
        grow(to, next, length * (0.62 + rand() * 0.16), radius * 0.62, depth - 1);
      }
    };

    const a0 = (b / count) * Math.PI * 2 + rand() * 0.7;
    grow(
      new Vector3(0, 0, 0),
      new Vector3(Math.cos(a0) * 0.7, 0.78, Math.sin(a0) * 0.7).normalize(),
      1.5 * scale,
      0.085 * scale,
      3,
    );

    const woodMesh = new Mesh(mergeGeos(wood), mats.timber);
    woodMesh.castShadow = true;
    pivot.add(woodMesh);
    if (flowers.length > 0) {
      const flowerMesh = new Mesh(mergeGeos(flowers), mats.blossom);
      pivot.add(flowerMesh);
    }
    group.add(pivot);
    boughs.push(pivot);
  }

  return { group, boughs };
}

/* ------------------------------------------------------------------ 劍 */

/**
 * 插在地上的一把劍。
 *
 * 劍身是**全場唯一會發光的東西**。這不是效果的選擇,是規格的一條硬規則:
 * 斗栱不亮、窗紙不亮、燈籠只剩餘燼,整個夜裡只有劍鋒是冷的、亮的。
 * post.ts 的 bloom 閾值就是照著這支材質的亮度調的。
 */
export function buildSword(mats: WorldMaterials, tiltZ: number, tiltX: number): Group {
  const group = new Group();
  const bin = createBin();
  const BLADE = 0.94;
  const IN = 0.22;

  bin.add('timber', at(new BoxGeometry(0.17, 0.05, 0.05), 0, BLADE - IN, 0));
  bin.add('timber', at(new CylinderGeometry(0.032, 0.028, 0.26, 8), 0, BLADE - IN + 0.17, 0));
  bin.add('timber', at(new CylinderGeometry(0.042, 0.036, 0.05, 8), 0, BLADE - IN + 0.32, 0));
  bin.flush(group, mats, false);

  const blade = new Mesh(new BoxGeometry(0.055, BLADE, 0.014), mats.blade);
  blade.position.y = (BLADE - IN * 2) / 2;
  group.add(blade);

  // 劍身周圍的一點光暈。這是全場唯一一個 additive 的精靈,除了月暈與餘燼。
  const glow = new Sprite(mats.glowBlade);
  glow.scale.set(0.5, 1.5, 1);
  glow.position.y = (BLADE - IN * 2) / 2;
  group.add(glow);

  group.rotation.z = tiltZ;
  group.rotation.x = tiltX;
  return group;
}

/* ------------------------------------------------------------------ 燈籠 */

export interface Lantern {
  group: Group;
  light: PointLight;
  /** 餘燼從這裡冒出來。 */
  emberAt: Vector3;
}

/**
 * 一盞燈籠。整座場景只有一盞,而且只剩餘燼。
 *
 * 上一版有十二盞暖光燈籠,一盞不留 —— 有人點燈就表示有人在這裡。這一盞是
 * 掛著沒人收的那一個,光弱到只照得到自己的紙,火星是它還沒完全熄掉的證據。
 */
export function buildLantern(mats: WorldMaterials, x: number, y: number, z: number): Lantern {
  const group = new Group();
  const bin = createBin();

  bin.add('timber', at(new CylinderGeometry(0.03, 0.03, 0.7, 6), 0, 0.35, 0));
  bin.add('timber', at(new CylinderGeometry(0.13, 0.15, 0.06, 10), 0, -0.02, 0));
  bin.add('timber', at(new CylinderGeometry(0.1, 0.12, 0.05, 10), 0, -0.62, 0));
  bin.flush(group, mats, false);

  // 紙身:破了半邊的圓筒。用 open-ended 的圓柱而不是球 —— 破燈籠是撐不起來的。
  const body = new Mesh(new CylinderGeometry(0.15, 0.13, 0.54, 12, 1, true), mats.paper);
  body.position.y = -0.32;
  group.add(body);

  const light = new PointLight(PALETTE.vermilion, 0.9, 4.2, 2);
  light.position.y = -0.32;
  group.add(light);

  const glow = new Sprite(mats.glowEmber);
  glow.scale.setScalar(1.1);
  glow.position.y = -0.32;
  group.add(glow);

  group.position.set(x, y, z);
  return { group, light, emberAt: new Vector3(x, y - 0.32, z) };
}

/* --------------------------------------------------------------- 地與天 */

export interface Terrain {
  group: Group;
  moon: Mesh;
}

/** 地面的起伏幅度(公尺)與建築腳下被壓平的半徑。 */
const GROUND_SWELL = 0.26;
const GROUND_FLAT = 30;

/**
 * 地面的高度。
 *
 * 完全平的地在這個場景有兩個問題:掠射的月光沒有東西可以打亮,而面積加權的
 * 散佈退化成「在矩形裡灑點」。所以地有很淺的起伏 —— 只有二十幾公分,遠到
 * 看不出是山丘,近到每一道光都在它上面斷開。
 *
 * 建築腳下必須是平的:院子中央一旦有起伏,台基與柱腳就會有一邊浮在空中。
 * 所以起伏的幅度往中心衰減到零。
 */
export function groundHeight(x: number, z: number, centreZ: number): number {
  const d = Math.hypot(x, z - centreZ);
  const fade = clamp((d - GROUND_FLAT) / 40, 0, 1);
  if (fade <= 0) return 0;
  const swell =
    Math.sin(x * 0.043 + 1.7) * Math.cos(z * 0.037 - 0.6) +
    Math.sin(x * 0.11 - 2.2) * Math.cos(z * 0.094 + 1.1) * 0.4;
  return swell * GROUND_SWELL * fade;
}

/**
 * 地、天、月。
 *
 * 沒有遠山。上一版有兩張帶霧的山脊剪影,這一版拿掉了 —— 這座武館四面都是竹林,
 * 而霧把二十公尺以外的東西都吃掉了。看得到山就表示看得到出口,而這一章不該
 * 有出口。
 */
export function buildTerrain(lib: TextureLibrary, mats: WorldMaterials, plan: SitePlan): Terrain {
  const group = new Group();

  // 地。分段數是為了起伏,不是為了曲面品質:七十二段在兩百六十公尺上是
  // 三公尺半一格,剛好夠承載那二十幾公分的起伏,又不會讓散佈的三角形表變肥。
  const centreZ = (plan.hallFrontZ + plan.hallBackZ) / 2 + 14;
  const fieldGeo = scaleUv(new PlaneGeometry(260, 260, 72, 72), 34, 34);
  fieldGeo.rotateX(-Math.PI / 2);
  fieldGeo.translate(0, 0, centreZ);
  const fpos = fieldGeo.getAttribute('position');
  for (let i = 0; i < fpos.count; i++) {
    fpos.setY(i, groundHeight(fpos.getX(i), fpos.getZ(i), centreZ));
  }
  fpos.needsUpdate = true;
  fieldGeo.computeVertexNormals();
  const field = new Mesh(fieldGeo, mats.ground);
  field.receiveShadow = true;
  group.add(field);

  // 天空:掛得夠遠,整個視錐都裝得進去。不吃霧也不吃色調映射 ——
  // 它就是背景本身,被霧提亮之後會變成一面灰牆。
  const sky = new Mesh(
    new PlaneGeometry(420, 230),
    new MeshBasicMaterial({ map: lib.get('sky').map, depthWrite: false, fog: false }),
  );
  sky.position.set(plan.moon[0] * 0.4, 62, -170);
  sky.renderOrder = 0;
  group.add(sky);

  // 月亮。它必須在殘旗的正後方 —— 第一章的旗是逆光的剪影,這件事只有把月亮
  // 擺在鏡頭到旗的那條線上才成立。camera.ts 的第一個 waypoint 是照著它算的。
  const moon = new Mesh(
    new PlaneGeometry(22, 22),
    new MeshBasicMaterial({
      map: lib.get('moon').map,
      transparent: true,
      depthWrite: false,
      fog: false,
      side: DoubleSide,
    }),
  );
  moon.position.set(plan.moon[0], plan.moon[1], plan.moon[2]);
  moon.renderOrder = 2;
  group.add(moon);

  const halo = new Sprite(mats.glowMoon);
  // 暈比月盤大一圈就夠。第一版給 62,在第二章的畫面上是一塊佔掉四分之一天空的
  // 淺色方塊 —— 加色的貼片放大到那個尺寸,就不再是暈,是一層霧。
  halo.scale.setScalar(38);
  halo.position.copy(moon.position);
  group.add(halo);

  return { group, moon };
}

/** 牌樓與大廳的尺寸,給站位與相機參考。不從外面改,只讀。 */
export const GATE_SIZE = {
  height: GATE_H,
  bay: GATE_BAY,
  side: GATE_SIDE,
  halfWidth: GATE_BAY + GATE_SIDE,
  leanZ: GATE_LEAN_Z,
  leanX: GATE_LEAN_X,
} as const;
