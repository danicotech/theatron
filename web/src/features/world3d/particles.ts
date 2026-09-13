import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  NormalBlending,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';

import { mulberry32 } from './noise';
import { PALETTE, channels } from './palette';
import { WIND_GLSL, type WindUniforms } from './wind';

/**
 * 空氣裡的三種東西:竹葉、塵埃、餘燼。
 *
 * **雪不在這個世界裡。** 上一版是雪夜的參道,整組刪掉了 —— 不是改色,是刪掉:
 * 一片飄雪會立刻把「荒廢的木造武館」讀成「冬天的古蹟」,而這兩件事的差別
 * 正是這個站要講的。
 *
 * 三種各有各的來歷,這是它們必須分開的原因:
 *
 *   竹葉  **從竹林長出來的**,不是從天上掉下來的。生成點被夾在竹梢那一段
 *         高度與竹林的平面範圍裡,而且吃的是與竹身同一個風場(`WIND_GLSL`)——
 *         同一陣風把竹子吹彎、也把葉子帶走,兩件事必須同時發生。
 *   塵埃  跟著鏡頭走,因為它是「空氣本身」。它沒有來源。
 *   餘燼  從那一盞燈籠冒出來,所以它的場是**釘在燈籠上**的一小塊,不跟鏡頭走。
 *
 * 位置全部在 GPU 上算:CPU 每格只推一個時間 uniform。兩千顆粒子在 JS 裡逐顆
 * 更新是每格兩千次寫入加一次 buffer 上傳,那會是這個場景裡最貴的一件事。
 */

/** 塵埃場的邊長。鏡頭走了七十公尺,所以場要夠大,而它跟著鏡頭走。 */
const DUST_FIELD = 46;
const DUST_HEIGHT = 16;

export interface Particles {
  points: Points;
  /** 每格一次。x/z 是鏡頭位置 —— 只有會跟著鏡頭的場用得到。 */
  update(time: number, x: number, z: number): void;
  dispose(): void;
}

/* ------------------------------------------------------------------ 場 */

const FIELD_VS = /* glsl */ `
attribute float aSeed;
attribute float aFall;
attribute float aSize;
uniform float uTime;
uniform vec3 uCentre;
uniform vec3 uField;
uniform float uFollow;
varying float vFade;

void main() {
  vec3 p = position;
  // 往下(或往上)飄,飄出場外就從另一頭回來 —— 用 mod 而不是重設位置,
  // 所以沒有任何狀態要存。
  p.y = mod(p.y - uTime * aFall, uField.y);
  p.x += sin(uTime * 0.31 + aSeed * 6.2831) * 0.9;
  p.z += cos(uTime * 0.24 + aSeed * 6.2831) * 0.7;
  // uFollow = 1 的場跟著鏡頭走,但只取整數格,免得場自己在動的時候粒子
  // 看起來被拖著跑。
  vec2 c = mix(vec2(0.0), uCentre.xz, uFollow);
  p.x = mod(p.x - c.x + uField.x * 0.5, uField.x) - uField.x * 0.5 + c.x;
  p.z = mod(p.z - c.y + uField.z * 0.5, uField.z) - uField.z * 0.5 + c.y;
  p += vec3(uCentre.x * (1.0 - uFollow), 0.0, uCentre.z * (1.0 - uFollow));
  p.y += uCentre.y * (1.0 - uFollow);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // 太近的粒子會糊成一團,所以近處淡掉;遠處交給霧與這條 smoothstep。
  vFade = smoothstep(0.8, 3.5, -mv.z) * smoothstep(64.0, 26.0, -mv.z);
  gl_PointSize = clamp(aSize * (13.0 / max(1.0, -mv.z)), 1.0, 7.0);
  gl_Position = projectionMatrix * mv;
}
`;

const ROUND_FS = /* glsl */ `
uniform vec3 uColour;
uniform float uOpacity;
varying float vFade;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.1, length(d)) * vFade * uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColour, a);
}
`;

interface FieldOptions {
  count: number;
  seed: number;
  colour: number;
  opacity: number;
  size: readonly [number, number];
  /** 每秒掉多少公尺。負的是往上。 */
  fall: readonly [number, number];
  field: readonly [number, number, number];
  additive: boolean;
  /** true = 跟著鏡頭走;false = 釘在 origin 上。 */
  follow: boolean;
  origin?: Vector3;
}

function buildField(o: FieldOptions): Particles {
  const rand = mulberry32(o.seed);
  const position = new Float32Array(o.count * 3);
  const aSeed = new Float32Array(o.count);
  const aFall = new Float32Array(o.count);
  const aSize = new Float32Array(o.count);

  for (let i = 0; i < o.count; i++) {
    position[i * 3] = (rand() - 0.5) * o.field[0];
    position[i * 3 + 1] = rand() * o.field[1];
    position[i * 3 + 2] = (rand() - 0.5) * o.field[2];
    aSeed[i] = rand();
    aFall[i] = o.fall[0] + rand() * (o.fall[1] - o.fall[0]);
    aSize[i] = o.size[0] + rand() * (o.size[1] - o.size[0]);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setAttribute('aSeed', new Float32BufferAttribute(aSeed, 1));
  geometry.setAttribute('aFall', new Float32BufferAttribute(aFall, 1));
  geometry.setAttribute('aSize', new Float32BufferAttribute(aSize, 1));

  const [r, g, b] = channels(o.colour);
  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCentre: { value: o.origin?.clone() ?? new Vector3() },
      uField: { value: new Vector3(o.field[0], o.field[1], o.field[2]) },
      uFollow: { value: o.follow ? 1 : 0 },
      uColour: { value: [r / 255, g / 255, b / 255] },
      uOpacity: { value: o.opacity },
    },
    vertexShader: FIELD_VS,
    fragmentShader: ROUND_FS,
    transparent: true,
    depthWrite: false,
    blending: o.additive ? AdditiveBlending : NormalBlending,
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;
  const centre = material.uniforms.uCentre!.value as Vector3;

  return {
    points,
    update(time, x, z) {
      material.uniforms.uTime!.value = time;
      if (o.follow) {
        centre.x = x;
        centre.z = z;
      }
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

/**
 * 塵埃。跟著鏡頭走,幾乎不動,月白。
 *
 * 它是「這個空間裡有空氣」的唯一證據。沒有它,室內那三章的黑就是死的。
 */
export function createDust(count: number): Particles {
  return buildField({
    count,
    seed: 7731,
    colour: PALETTE.moonWhite,
    opacity: 0.3,
    size: [0.7, 1.9],
    fall: [0.06, 0.22],
    field: [DUST_FIELD, DUST_HEIGHT, DUST_FIELD],
    additive: false,
    follow: true,
  });
}

/**
 * 餘燼。少、往上飄、加色,而且**釘在那一盞燈籠上**。
 *
 * 全場只有一盞燈,所以火星只有一個來源。跟著鏡頭走的火星等於「到處都在燒」,
 * 那跟這座已經沒有人的武館是相反的意思。
 */
export function createEmbers(count: number, origin: Vector3): Particles {
  return buildField({
    count,
    seed: 4477,
    colour: PALETTE.vermilion,
    opacity: 0.75,
    size: [1.4, 3.2],
    fall: [-1.1, -0.45],
    field: [1.5, 4.2, 1.5],
    additive: true,
    follow: false,
    origin: origin.clone().add(new Vector3(0, -1.0, 0)),
  });
}

/* ---------------------------------------------------------------- 竹葉 */

/**
 * 竹葉。
 *
 * 規格明寫「**從竹子長出來,不是從天上掉下來**」,所以生成點被夾在竹林的
 * 平面範圍與竹梢那一段高度裡(`uGrove`),而不是一整片天空。這不是細節:
 * 從天上均勻落下的葉子是雪,換個顏色還是雪。
 *
 * 飄的方式吃的是與竹身**同一個** `windAt()`:陣風走到哪一段竹林,那一段的
 * 葉子才會被帶走。所以葉子的密度會跟著波前走,而竹子在同一刻正好彎下去。
 * 兩邊要是各自寫一套公式,這個同步立刻散掉,而散掉之後沒有人說得出哪裡怪。
 */
const LEAF_VS = /* glsl */ `
attribute float aSeed;
attribute float aRate;
attribute float aSize;
attribute float aSpin;
uniform vec3 uGroveMin;
uniform vec3 uGroveMax;
varying float vFade;
varying float vSpin;

void main() {
  // 年齡 0…1:0 是剛離開竹梢,1 是落到地面。相位由種子錯開,不然整片葉子
  // 會同時離枝。
  float age = fract(uTime * aRate + aSeed);
  vec3 spawn = position;

  float gust = windAt(spawn.xz, uTime);
  // 落下的同時被風帶走。帶多遠由陣風決定 —— 風強的那一刻葉子飛得遠,
  // 風停的時候幾乎是垂直落下。
  float drift = (1.4 + gust * 1.1) * age * 6.0;
  vec3 p = spawn;
  p.y -= age * (spawn.y - uGroveMin.y + 1.2);
  p.xz += uWindDir * drift;
  // 翻轉造成的橫向擺盪。葉子不是質點,它會邊落邊翻。
  p.x += sin(age * 9.0 + aSeed * 6.2831) * 0.5;
  p.z += cos(age * 7.4 + aSeed * 6.2831) * 0.4;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // 剛離枝與快落地時各淡一次:突然出現與突然消失都會被看見。
  vFade = smoothstep(0.0, 0.12, age) * smoothstep(1.0, 0.82, age)
        * smoothstep(0.8, 3.0, -mv.z) * smoothstep(70.0, 30.0, -mv.z);
  vSpin = aSpin + age * 6.0;
  gl_PointSize = clamp(aSize * (34.0 / max(1.0, -mv.z)), 1.5, 14.0);
  gl_Position = projectionMatrix * mv;
}
`;

/** 葉片是細長的橢圓,不是圓點。圓點在這個尺寸下一律讀成雪。 */
const LEAF_FS = /* glsl */ `
uniform vec3 uColour;
uniform float uOpacity;
varying float vFade;
varying float vSpin;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float c = cos(vSpin);
  float s = sin(vSpin);
  vec2 r = vec2(d.x * c - d.y * s, d.x * s + d.y * c);
  float e = length(vec2(r.x / 0.45, r.y / 0.13));
  float a = smoothstep(1.0, 0.55, e) * vFade * uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColour, a);
}
`;

export interface Grove {
  min: Vector3;
  max: Vector3;
}

export function createBambooLeaves(count: number, grove: Grove, wind: WindUniforms): Particles {
  const rand = mulberry32(6142);
  const position = new Float32Array(count * 3);
  const aSeed = new Float32Array(count);
  const aRate = new Float32Array(count);
  const aSize = new Float32Array(count);
  const aSpin = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    position[i * 3] = grove.min.x + rand() * (grove.max.x - grove.min.x);
    // 生成高度只在竹梢那一段。這一行就是「從竹子落下」與「從天上落下」的差別。
    position[i * 3 + 1] = grove.min.y + rand() * (grove.max.y - grove.min.y);
    position[i * 3 + 2] = grove.min.z + rand() * (grove.max.z - grove.min.z);
    aSeed[i] = rand();
    aRate[i] = 0.045 + rand() * 0.05;
    aSize[i] = 0.5 + rand() * 0.7;
    aSpin[i] = rand() * Math.PI * 2;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setAttribute('aSeed', new Float32BufferAttribute(aSeed, 1));
  geometry.setAttribute('aRate', new Float32BufferAttribute(aRate, 1));
  geometry.setAttribute('aSize', new Float32BufferAttribute(aSize, 1));
  geometry.setAttribute('aSpin', new Float32BufferAttribute(aSpin, 1));

  const [r, g, b] = channels(PALETTE.deadBamboo);
  const material = new ShaderMaterial({
    // 風的 uniform 是**共用的那一組物件**,不是複製的值:竹身與竹葉必須讀到
    // 同一個 uTime 與同一組參數,複製一份就會在第一次調參數時分家。
    uniforms: {
      ...wind,
      uGroveMin: { value: grove.min.clone() },
      uGroveMax: { value: grove.max.clone() },
      uColour: { value: [r / 255, g / 255, b / 255] },
      uOpacity: { value: 0.7 },
    },
    vertexShader: `${WIND_GLSL}\n${LEAF_VS}`,
    fragmentShader: LEAF_FS,
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;

  return {
    points,
    // 時間由風場自己推(`wind.update`),這裡不能再寫一次 —— 寫兩次就會有
    // 一格的落差,而那一格的落差正好是「葉子與竹子不同步」。
    update() {},
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
