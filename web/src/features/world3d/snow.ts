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

/**
 * 雪與火星。
 *
 * 兩個 Points,各一支小 shader。不用 PointsMaterial 是因為要的兩件事它都給不了:
 * 每一片各自的下落速度與擺盪相位(寫進 attribute),以及在片元裡把方形的點
 * 切成圓的(gl_PointCoord)。方形的雪在 bloom 之後會變成一格一格的亮塊。
 *
 * 位置全部在 GPU 上算:CPU 只推一個時間 uniform。兩千六百片雪在 JS 裡逐片
 * 更新是每格兩千六百次寫入加一次 buffer 上傳,那是這個場景裡最貴的一件事。
 */

/** 粒子場的邊長。相機走了七十公尺,所以場要夠大,而它跟著相機走。 */
const FIELD = 90;
const FIELD_HEIGHT = 44;

const SNOW_VS = `
attribute float aSeed;
attribute float aFall;
attribute float aSize;
uniform float uTime;
uniform vec3 uCentre;
uniform float uField;
uniform float uHeight;
varying float vFade;

void main() {
  vec3 p = position;
  // 往下掉,掉出場底就從場頂回來 —— 用 mod 而不是重設位置,所以沒有狀態要存。
  p.y = mod(p.y - uTime * aFall, uHeight);
  // 左右擺盪:相位由種子決定,不然全部的雪會一起往同一邊擺。
  p.x += sin(uTime * 0.42 + aSeed * 6.2831) * 1.5;
  p.z += cos(uTime * 0.31 + aSeed * 6.2831) * 1.1;
  // 場跟著相機走,但只取整數格,免得場自己在動的時候雪看起來被拖著跑。
  p.x = mod(p.x - uCentre.x + uField * 0.5, uField) - uField * 0.5 + uCentre.x;
  p.z = mod(p.z - uCentre.z + uField * 0.5, uField) - uField * 0.5 + uCentre.z;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // 太近的雪片會糊成一團白,所以近處淡掉。遠處交給霧。
  vFade = smoothstep(1.5, 6.0, -mv.z) * smoothstep(70.0, 30.0, -mv.z);
  // 每公尺的像素數。這個常數決定雪看起來是雪還是散景光斑:300 的時候
  // 一片六公尺外的雪佔 170px,整個畫面被白球蓋掉。雪片實際只有幾公分,
  // 所以遠一點就該是幾個像素。上限再夾一次,擋住貼在鏡頭上的那幾片。
  gl_PointSize = clamp(aSize * (13.0 / max(1.0, -mv.z)), 1.0, 8.0);
  gl_Position = projectionMatrix * mv;
}
`;

const SNOW_FS = `
uniform vec3 uColour;
uniform float uOpacity;
varying float vFade;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.12, length(d)) * vFade * uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColour, a);
}
`;

export interface Particles {
  points: Points;
  update(time: number, x: number, z: number): void;
  dispose(): void;
}

function build(
  count: number,
  seed: number,
  colour: [number, number, number],
  opacity: number,
  sizeRange: [number, number],
  fallRange: [number, number],
  additive: boolean,
  height: number,
): Particles {
  const rand = mulberry32(seed);
  const position = new Float32Array(count * 3);
  const aSeed = new Float32Array(count);
  const aFall = new Float32Array(count);
  const aSize = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    position[i * 3] = (rand() - 0.5) * FIELD;
    position[i * 3 + 1] = rand() * height;
    position[i * 3 + 2] = (rand() - 0.5) * FIELD;
    aSeed[i] = rand();
    aFall[i] = fallRange[0] + rand() * (fallRange[1] - fallRange[0]);
    aSize[i] = sizeRange[0] + rand() * (sizeRange[1] - sizeRange[0]);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setAttribute('aSeed', new Float32BufferAttribute(aSeed, 1));
  geometry.setAttribute('aFall', new Float32BufferAttribute(aFall, 1));
  geometry.setAttribute('aSize', new Float32BufferAttribute(aSize, 1));

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCentre: { value: new Vector3() },
      uField: { value: FIELD },
      uHeight: { value: height },
      uColour: { value: colour },
      uOpacity: { value: opacity },
    },
    vertexShader: SNOW_VS,
    fragmentShader: SNOW_FS,
    transparent: true,
    depthWrite: false,
    blending: additive ? AdditiveBlending : NormalBlending,
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;
  const centre = material.uniforms.uCentre!.value as Vector3;

  return {
    points,
    update(time, x, z) {
      material.uniforms.uTime!.value = time;
      centre.x = x;
      centre.z = z;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

/** 飄雪。落得慢、擺得大,因為它是天氣不是特效。 */
export function createSnow(count: number): Particles {
  return build(count, 8801, [0.84, 0.89, 0.93], 0.62, [1.4, 3.4], [0.7, 2.0], false, FIELD_HEIGHT);
}

/** 火星。少、上升得快、加色,因為它是燈籠與火盆的證據。 */
export function createEmbers(count: number): Particles {
  return build(count, 4477, [1, 0.62, 0.24], 0.9, [2.0, 4.6], [-1.6, -0.7], true, 18);
}
