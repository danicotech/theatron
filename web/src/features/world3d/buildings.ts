import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';

import { at, flaredRoof, mergeGeos, scaleUv, sweepProfile } from './geometry';
import type { TextureLibrary } from './textures';

/**
 * 這個世界裡的建築。
 *
 * 三件東西:山門(牌坊)、木堂、燈籠,外加地與遠景。每一件的比例都由檔案
 * 開頭那三四個常數導出 —— 不是為了省字,是為了「重新調比例」是改一個數字
 * 而不是改四十個。牌坊的柱子跟屋頂跟匾額必須一起變大,分開寫就一定會脫節。
 *
 * 每一棟都把同材質的零件合批成一個 mesh。牌坊有六十幾個零件,分開畫是六十
 * 幾次 draw call,而它在畫面上只有巴掌大。
 */

export interface WorldMaterials {
  lacquer: MeshStandardMaterial;
  timber: MeshStandardMaterial;
  granite: MeshStandardMaterial;
  gilt: MeshStandardMaterial;
  tile: MeshStandardMaterial;
  ink: MeshStandardMaterial;
  snow: MeshStandardMaterial;
  /** 燈籠與格扇的紙。自己會亮,所以不吃光照。 */
  lampPaper: MeshBasicMaterial;
  glow: SpriteMaterial;
}

type Slot = 'lacquer' | 'timber' | 'granite' | 'gilt' | 'tile' | 'ink' | 'snow';

/**
 * 全世界共用一份材質。
 *
 * 同一支材質被三十個 mesh 指到,渲染器就只需要綁一次 uniform;每棟樓各配一份
 * 材質則每棟都要重綁,而它們的內容一模一樣。
 */
export function createMaterials(lib: TextureLibrary): WorldMaterials {
  const timberTex = lib.get('timber');
  const graniteTex = lib.get('granite');
  const lacquerTex = lib.get('lacquer');
  const tileTex = lib.get('roofTile');
  const paperTex = lib.get('paper');
  const snowTex = lib.get('snowGround');

  // 朱漆風化之後彩度掉得很凶,所以材質色把紅單獨拉過 1,而不是整體提亮 ——
  // 整體提亮在 ACES 之後會把朱紅壓成磚紅,那是完全不同的一個顏色。
  const lacquer = new MeshStandardMaterial({
    map: lacquerTex.map,
    normalMap: lacquerTex.normal,
    roughness: 0.88,
    metalness: 0.06,
  });
  lacquer.color.setRGB(1.62, 0.94, 0.86);

  return {
    lacquer,
    timber: new MeshStandardMaterial({
      map: timberTex.map,
      normalMap: timberTex.normal,
      roughnessMap: timberTex.rough,
      color: 0x6a5a4e,
      roughness: 0.94,
      metalness: 0.04,
    }),
    granite: new MeshStandardMaterial({
      map: graniteTex.map,
      normalMap: graniteTex.normal,
      roughnessMap: graniteTex.rough,
      color: 0x5c666c,
      roughness: 0.9,
      metalness: 0.03,
    }),
    // 斗栱是唯一有金屬反光的東西。夜景裡沒有它,整座門就只剩一個剪影。
    gilt: new MeshStandardMaterial({ color: 0x8a6a2e, roughness: 0.42, metalness: 0.68 }),
    tile: new MeshStandardMaterial({
      map: tileTex.map,
      normalMap: tileTex.normal,
      roughnessMap: tileTex.rough,
      color: 0x424c52,
      roughness: 0.82,
      metalness: 0.08,
    }),
    ink: new MeshStandardMaterial({ color: 0x10141a, roughness: 0.5, metalness: 0.1 }),
    snow: new MeshStandardMaterial({
      map: snowTex.map,
      normalMap: snowTex.normal,
      color: 0x93a5b0,
      roughness: 0.88,
      metalness: 0,
    }),
    lampPaper: new MeshBasicMaterial({ map: paperTex.map, color: 0xffb469, fog: true }),
    glow: new SpriteMaterial({
      map: lib.get('glow').map,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
      // 加色混合遇上霧會變成「越遠越亮」—— 霧是往霧色混,而霧色本身是要加上去的。
      fog: false,
      opacity: 0.5,
    }),
  };
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
 * 斗栱一組:坐斗、十字栱、上斗、四片翼。
 *
 * 回傳一份可以被位移多次的幾何,因為它在牌坊上出現六次、在木堂上出現十幾次,
 * 而它的內容完全一樣。
 */
function bracketCluster(scale: number): BufferGeometry[] {
  const s = scale;
  const parts = [
    at(new BoxGeometry(0.92 * s, 0.24 * s, 0.92 * s), 0, 0.12 * s, 0),
    at(new BoxGeometry(1.68 * s, 0.2 * s, 0.3 * s), 0, 0.34 * s, 0),
    at(new BoxGeometry(0.3 * s, 0.2 * s, 1.68 * s), 0, 0.34 * s, 0),
    at(new BoxGeometry(0.6 * s, 0.22 * s, 0.6 * s), 0, 0.55 * s, 0),
  ];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push(
        at(new BoxGeometry(0.2 * s, 0.5 * s, 0.16 * s), sx * 0.62 * s, 0.42 * s, sz * 0.3 * s),
      );
    }
  }
  return parts;
}

/** 一根往兩端翹起的橫樑的路徑。power 越大,翹起越集中在末端。 */
function beamPath(half: number, rise: number, power: number, segs = 24): Vector3[] {
  const points: Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const u = (i / segs) * 2 - 1;
    points.push(new Vector3(u * half, Math.pow(Math.abs(u), power) * rise, 0));
  }
  return points;
}

/**
 * 木構橫樑的斷面:下寬上窄、腰部外凸。
 *
 * 這六個點是整座牌坊唯一不能換成矩形的地方。矩形掃出來的樑沒有那一道斜切,
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

/* ------------------------------------------------------------ 山門 / 牌坊 */

/** 三間四柱。這四個數字定了整座門,其餘全部由它們導出。 */
const GATE_BASE = 0.95;
const GATE_H = 10.4;
const GATE_BAY = 4.15;
const GATE_SIDE = 3.1;

/** 側柱比中柱矮的比例。三間的高低差就是牌坊之所以是牌坊。 */
const GATE_SIDE_RATIO = 0.7;

export function buildPaifang(mats: WorldMaterials): Group {
  const group = new Group();
  const bin = createBin();
  const outer = GATE_BAY + GATE_SIDE;
  const sideH = GATE_H * GATE_SIDE_RATIO;

  for (const s of [-1, 1]) {
    for (const [x, h, rTop, rBot] of [
      [s * GATE_BAY, GATE_H, 0.34, 0.44],
      [s * outer, sideH, 0.29, 0.38],
    ] as const) {
      // 柱身上細下粗。等粗的柱子看起來會往上撐開,那是視覺,不是幾何。
      bin.add('lacquer', at(new CylinderGeometry(rTop, rBot, h, 20), x, GATE_BASE + h / 2, 0));
      // 石鼓座:柱子不會直接站在地上,中間一定隔一塊石頭。
      bin.add(
        'granite',
        at(new CylinderGeometry(rBot * 1.55, rBot * 1.85, GATE_BASE, 18), x, GATE_BASE / 2, 0),
      );
      bin.add('granite', at(new BoxGeometry(rBot * 4.4, 0.26, rBot * 4.4), x, 0.13, 0));
      // 柱箍
      bin.add(
        'gilt',
        at(new CylinderGeometry(rTop * 1.1, rTop * 1.14, 0.22, 18), x, GATE_BASE + h - 1.5, 0),
      );
      for (const part of bracketCluster(0.85)) {
        bin.add('gilt', at(part, x, GATE_BASE + h - 0.1, 0));
      }
    }
  }

  // 額枋:穿過四根柱子的直樑,兩道。上面那道托住中間一間的屋頂。
  bin.add(
    'lacquer',
    at(new BoxGeometry(outer * 2 + 1.5, 0.56, 0.46), 0, GATE_BASE + sideH - 0.75, 0),
  );
  bin.add(
    'lacquer',
    at(new BoxGeometry(GATE_BAY * 2 + 1.2, 0.52, 0.44), 0, GATE_BASE + GATE_H - 1.9, 0),
  );
  bin.add(
    'lacquer',
    at(new BoxGeometry(outer * 2 + 1.2, 0.36, 0.34), 0, GATE_BASE + GATE_H * 0.42, 0),
  );

  // 匾額:中央那塊字板。它是整座門唯一「有話要說」的部位。
  bin.add('ink', at(new BoxGeometry(3.2, 1.5, 0.16), 0, GATE_BASE + GATE_H - 0.95, 0.22));
  for (const [w, h, y] of [
    [3.5, 0.17, 0.83],
    [3.5, 0.17, -0.83],
  ] as const) {
    bin.add('gilt', at(new BoxGeometry(w, h, 0.22), 0, GATE_BASE + GATE_H - 0.95 + y, 0.24));
  }
  for (const s of [-1, 1]) {
    bin.add(
      'gilt',
      at(new BoxGeometry(0.17, 1.84, 0.22), s * 1.66, GATE_BASE + GATE_H - 0.95, 0.24),
    );
  }

  // 中間一間的兩根翹樑:下面那根翹得少,上面那根翹得多也更長。
  bin.add(
    'lacquer',
    at(
      sweepProfile(beamPath(GATE_BAY + 1.35, 0.46, 2.6), TIMBER_SECTION),
      0,
      GATE_BASE + GATE_H - 0.42,
      0,
    ),
  );
  bin.add(
    'ink',
    at(
      sweepProfile(beamPath(GATE_BAY + 1.8, 0.68, 2.4), TIMBER_SECTION),
      0,
      GATE_BASE + GATE_H + 0.34,
      0,
    ),
  );

  // 三頂飛簷:中央高、兩側低。高低差比屋頂本身更重要 —— 一樣高就是一座棚子。
  bin.add(
    'tile',
    at(
      flaredRoof({
        halfWidth: GATE_BAY + 0.95,
        halfDepth: 2.05,
        ridgeHalf: GATE_BAY * 0.5,
        rise: 1.6,
        thickness: 0.26,
        flare: 1.05,
      }),
      0,
      GATE_BASE + GATE_H + 0.9,
      0,
    ),
  );
  bin.add('ink', at(new BoxGeometry(GATE_BAY * 1.1, 0.3, 0.42), 0, GATE_BASE + GATE_H + 2.62, 0));
  for (const s of [-1, 1]) {
    bin.add(
      'tile',
      at(
        flaredRoof({
          halfWidth: GATE_SIDE / 2 + 0.85,
          halfDepth: 1.7,
          ridgeHalf: GATE_SIDE * 0.28,
          rise: 1.15,
          thickness: 0.22,
          flare: 1.0,
        }),
        s * (GATE_BAY + GATE_SIDE / 2),
        GATE_BASE + sideH + 0.7,
        0,
      ),
    );
  }

  bin.flush(group, mats, true);
  return group;
}

/* ----------------------------------------------------------------- 木堂 */

/** 木堂的四個數字。台基在 buildTerrain 裡,這裡只管台基以上。 */
const HALL_HALF_W = 11;
const HALL_HALF_D = 7;
const HALL_BODY = 6.6;
const HALL_PLINTH = 0.85;

export interface Hall {
  group: Group;
  /** 堂內的暖光。整個世界只有燈籠與這裡是暖的,所以它必須拿得到、調得動。 */
  lights: PointLight[];
}

export function buildHall(mats: WorldMaterials): Hall {
  const group = new Group();
  const bin = createBin();
  const y0 = HALL_PLINTH;

  bin.add(
    'granite',
    scaleUv(
      at(
        new BoxGeometry(HALL_HALF_W * 2 + 2.6, HALL_PLINTH, HALL_HALF_D * 2 + 2.6),
        0,
        HALL_PLINTH / 2,
        0,
      ),
      6,
      6,
    ),
  );

  // 前後各六根柱。前排那一排是給光穿過去的,所以間距刻意寬。
  const COLS = 5;
  for (let i = 0; i <= COLS; i++) {
    const x = -HALL_HALF_W + (i * HALL_HALF_W * 2) / COLS;
    for (const z of [HALL_HALF_D, -HALL_HALF_D]) {
      bin.add(
        'timber',
        at(new CylinderGeometry(0.32, 0.4, HALL_BODY, 16), x, y0 + HALL_BODY / 2, z),
      );
    }
  }
  for (const s of [-1, 1]) {
    for (const z of [-HALL_HALF_D / 2, HALL_HALF_D / 2]) {
      bin.add(
        'timber',
        at(new CylinderGeometry(0.3, 0.38, HALL_BODY, 14), s * HALL_HALF_W, y0 + HALL_BODY / 2, z),
      );
    }
  }

  // 格扇:直櫺加三道橫串。它擋在紙的前面,所以光是被切碎的,不是一片。
  const latH = HALL_BODY - 1.3;
  const latY = y0 + latH / 2 + 0.25;
  for (let x = -HALL_HALF_W + 0.5; x <= HALL_HALF_W - 0.5; x += 0.62) {
    bin.add('timber', at(new BoxGeometry(0.1, latH, 0.1), x, latY, HALL_HALF_D - 0.05));
  }
  for (const dy of [-latH / 2 + 0.2, 0, latH / 2 - 0.2]) {
    bin.add(
      'timber',
      at(new BoxGeometry(HALL_HALF_W * 2 - 0.6, 0.12, 0.12), 0, latY + dy, HALL_HALF_D - 0.05),
    );
  }

  // 闌額與斗栱帶。斗栱在簷下排成一列,是這座堂唯一的水平裝飾線。
  bin.add(
    'timber',
    at(new BoxGeometry(HALL_HALF_W * 2 + 0.8, 0.5, 0.42), 0, y0 + HALL_BODY - 0.28, HALL_HALF_D),
  );
  bin.add(
    'timber',
    at(new BoxGeometry(HALL_HALF_W * 2 + 0.8, 0.5, 0.42), 0, y0 + HALL_BODY - 0.28, -HALL_HALF_D),
  );
  for (let i = 0; i <= COLS * 2; i++) {
    const x = -HALL_HALF_W + (i * HALL_HALF_W * 2) / (COLS * 2);
    for (const z of [HALL_HALF_D, -HALL_HALF_D]) {
      for (const part of bracketCluster(0.7)) {
        bin.add('gilt', at(part, x, y0 + HALL_BODY + 0.05, z));
      }
    }
  }

  // 重簷:下簷大而低、上簷小而高,中間隔一層清水牆。一層的堂看起來是倉庫。
  const lowerY = y0 + HALL_BODY + 0.85;
  bin.add(
    'tile',
    at(
      flaredRoof({
        halfWidth: HALL_HALF_W + 2.9,
        halfDepth: HALL_HALF_D + 2.9,
        ridgeHalf: HALL_HALF_W * 0.62,
        rise: 2.7,
        thickness: 0.36,
        flare: 1.0,
        tileScale: 0.14,
      }),
      0,
      lowerY,
      0,
    ),
  );
  const clerY = lowerY + 2.7;
  bin.add(
    'timber',
    scaleUv(
      at(new BoxGeometry(HALL_HALF_W * 1.62, 2.4, HALL_HALF_D * 1.62), 0, clerY + 1.2, 0),
      3,
      1,
    ),
  );
  const upperY = clerY + 2.4;
  bin.add(
    'tile',
    at(
      flaredRoof({
        halfWidth: HALL_HALF_W * 0.94,
        halfDepth: HALL_HALF_D * 0.94,
        ridgeHalf: HALL_HALF_W * 0.5,
        rise: 3.3,
        thickness: 0.34,
        flare: 1.05,
        tileScale: 0.14,
      }),
      0,
      upperY,
      0,
    ),
  );
  // 正脊與兩端的鴟吻(簡化成一段翹起的樑)。屋頂沒有脊就少了最上面那條線。
  bin.add(
    'ink',
    at(
      sweepProfile(beamPath(HALL_HALF_W * 0.52, 0.6, 2.2, 18), TIMBER_SECTION),
      0,
      upperY + 3.35,
      0,
    ),
  );

  bin.flush(group, mats, true);

  // 紙:格扇後面那一片。它是這一百公尺內唯一的暖色,所以不吃光照 ——
  // 交給光去算,它會跟著夜色一起變暗,而窗紙的亮度本來就與外面的光無關。
  const paper = new Mesh(new PlaneGeometry(HALL_HALF_W * 2 - 0.6, latH), mats.lampPaper);
  paper.position.set(0, latY, HALL_HALF_D - 0.3);
  group.add(paper);

  const lights: PointLight[] = [];
  for (const x of [-HALL_HALF_W * 0.55, 0, HALL_HALF_W * 0.55]) {
    // 射程只夠照到台基與柱腳。照得到屋頂的話整棟樓會變成一盞燈籠,剪影就沒了。
    const l = new PointLight(0xff8a34, 3.2, 16, 2);
    l.position.set(x, y0 + 1.6, HALL_HALF_D - 1.6);
    group.add(l);
    lights.push(l);
  }
  return { group, lights };
}

/* --------------------------------------------------------------- 燈籠 */

export interface Lantern {
  group: Group;
  light: PointLight;
}

export function buildLantern(mats: WorldMaterials, x: number, z: number, scale = 1): Lantern {
  const group = new Group();
  const bin = createBin();
  const poleH = 3.1 * scale;

  bin.add('timber', at(new CylinderGeometry(0.07, 0.1, poleH, 10), 0, poleH / 2, 0));
  bin.add('granite', at(new CylinderGeometry(0.24, 0.3, 0.26, 12), 0, 0.13, 0));
  bin.add('gilt', at(new CylinderGeometry(0.2, 0.26, 0.12, 12), 0, poleH + 0.06, 0));
  bin.add('gilt', at(new CylinderGeometry(0.18, 0.14, 0.1, 12), 0, poleH - 0.86, 0));
  bin.flush(group, mats, false);

  // 紙身:球壓扁成燈籠的形狀。MeshBasic 所以它永遠是亮的 —— 燈籠會亮不是因為
  // 有光照到它,是因為光在它裡面。
  const body = new Mesh(new SphereGeometry(0.3 * scale, 14, 10), mats.lampPaper);
  body.scale.set(1, 1.24, 1);
  body.position.y = poleH - 0.42;
  group.add(body);

  const light = new PointLight(0xff9a3c, 2.4 * scale, 11 * scale, 2);
  light.position.y = poleH - 0.42;
  group.add(light);

  const glow = new Sprite(mats.glow);
  glow.scale.setScalar(2.6 * scale);
  glow.position.y = poleH - 0.42;
  group.add(glow);

  group.position.set(x, 0, z);
  return { group, light };
}

/* --------------------------------------------------------------- 地與遠景 */

export interface SitePlan {
  courtHalf: number;
  gateZ: number;
  stairZ0: number;
  stairSteps: number;
  stairRun: number;
  stairWidth: number;
  podiumHeight: number;
  podiumBackZ: number;
  hallZ: number;
}

export interface Terrain {
  group: Group;
  /** 台階的頂端(z, y)。相機的最後兩個 waypoint 站在這裡,燈籠也排到這裡為止。 */
  stairTop: { z: number; y: number };
}

/**
 * 地、台基、台階,加上遠景。
 *
 * 遠山不是幾何,是兩張吃霧的剪影平面;天空是一張大平面。霧是讓地面「就這樣
 * 停住」的那個東西 —— 沒有霧就得把地建到天邊,而天邊在這個構圖裡永遠看不到。
 */
export function buildTerrain(lib: TextureLibrary, mats: WorldMaterials, plan: SitePlan): Terrain {
  const group = new Group();
  const bin = createBin();

  // 雪地:整個世界的底。比視野遠得多,邊緣早就被霧吃掉了。
  const field = new Mesh(scaleUv(new PlaneGeometry(300, 300), 26, 26), mats.snow);
  field.rotation.x = -Math.PI / 2;
  field.position.set(0, -0.06, -40);
  field.receiveShadow = true;
  group.add(field);

  // 院子的石舖面。它比雪地高六公分,邊緣那道落差就是院子的界線。
  bin.add(
    'granite',
    scaleUv(at(new BoxGeometry(plan.courtHalf * 2, 0.12, 78), 0, 0, plan.gateZ - 14), 10, 26),
  );

  // 台階:三十幾級,合批成一個 mesh。沒有人會走近到看得出它們是分開的。
  const rise = plan.podiumHeight / plan.stairSteps;
  for (let i = 0; i < plan.stairSteps; i++) {
    const z = plan.stairZ0 - i * plan.stairRun;
    bin.add(
      'granite',
      scaleUv(
        at(
          new BoxGeometry(plan.stairWidth, rise, plan.stairRun + 0.06),
          0,
          rise * (i + 0.5),
          z - plan.stairRun / 2,
        ),
        2,
        0.4,
      ),
    );
  }
  const stairTopZ = plan.stairZ0 - plan.stairSteps * plan.stairRun;
  // 兩側的垂帶。少了它台階會飄在半空中,因為它本來就沒有跟台基連起來。
  for (const s of [-1, 1]) {
    bin.add(
      'granite',
      scaleUv(
        at(
          new BoxGeometry(0.9, plan.podiumHeight + 0.5, Math.abs(plan.stairZ0 - stairTopZ)),
          s * (plan.stairWidth / 2 + 0.45),
          (plan.podiumHeight + 0.5) / 2 - 0.25,
          (plan.stairZ0 + stairTopZ) / 2,
        ),
        1,
        8,
      ),
    );
  }

  // 台基。木堂站在它上面,而它本身是這個構圖裡的第二條水平線。
  const podiumDepth = Math.abs(stairTopZ - plan.podiumBackZ);
  bin.add(
    'granite',
    scaleUv(
      at(
        new BoxGeometry(plan.courtHalf * 1.5, plan.podiumHeight, podiumDepth),
        0,
        plan.podiumHeight / 2,
        (stairTopZ + plan.podiumBackZ) / 2,
      ),
      8,
      6,
    ),
  );
  bin.add(
    'granite',
    scaleUv(
      at(
        new BoxGeometry(plan.courtHalf * 1.5 + 0.9, 0.4, podiumDepth + 0.9),
        0,
        plan.podiumHeight - 0.2,
        (stairTopZ + plan.podiumBackZ) / 2,
      ),
      8,
      6,
    ),
  );

  bin.flush(group, mats, false);

  // 天空:掛得夠遠,整個視錐都裝得進去。不吃霧也不吃色調映射 ——
  // 它就是背景本身,被霧提亮之後會變成一面灰牆。
  const sky = new Mesh(
    new PlaneGeometry(420, 220),
    new MeshBasicMaterial({ map: lib.get('sky').map, depthWrite: false, fog: false }),
  );
  sky.position.set(0, 66, -160);
  sky.renderOrder = 0;
  group.add(sky);

  // 兩道遠山。fog 關掉:一百公尺外的霧會把黑剪影提到霧色的八成,
  // 於是林線回來的時候是一條**淺色**的帶子,正好是它要避免的東西。
  const ridgeTex = lib.get('ridge').map;
  for (const [z, y, w, h, x, tint] of [
    [-135, 17, 380, 34, 0, 0x070a0e],
    [-98, 12, 260, 24, 22, 0x0b1218],
  ] as const) {
    const ridge = new Mesh(
      new PlaneGeometry(w, h),
      new MeshBasicMaterial({
        map: ridgeTex,
        color: tint,
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    );
    ridge.position.set(x, y, z);
    ridge.renderOrder = 1;
    group.add(ridge);
  }

  // 月亮。它在門的正後方偏右,所以第一章的山門是逆光的剪影。
  const moon = new Mesh(
    new PlaneGeometry(26, 26),
    new MeshBasicMaterial({
      map: lib.get('moon').map,
      transparent: true,
      depthWrite: false,
      fog: false,
      side: DoubleSide,
    }),
  );
  moon.position.set(-16, 40, -148);
  moon.renderOrder = 2;
  group.add(moon);

  return { group, stairTop: { z: stairTopZ, y: plan.podiumHeight } };
}

/** 牌坊與木堂的尺寸,給站位與相機參考。不從外面改,只讀。 */
export const GATE_SIZE = {
  base: GATE_BASE,
  height: GATE_H,
  bay: GATE_BAY,
  side: GATE_SIDE,
  halfWidth: GATE_BAY + GATE_SIDE,
} as const;

export const HALL_SIZE = {
  halfWidth: HALL_HALF_W,
  halfDepth: HALL_HALF_D,
  body: HALL_BODY,
  plinth: HALL_PLINTH,
} as const;
