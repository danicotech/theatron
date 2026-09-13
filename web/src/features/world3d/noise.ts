/**
 * 世界的亂數來源。
 *
 * 整個場景沒有一張圖檔、沒有一個模型檔,木紋、石面、山脊的天際線全部是從這裡
 * 長出來的。所以它必須**可重現**:同一顆種子在任何機器上都要畫出同一塊木頭,
 * 否則「今天看到的那一版」下次進來就不是同一個世界了。Math.random 做不到這件事。
 *
 * 三層:mulberry32 給位元、梯度噪聲給平滑的起伏、fbm 疊出細節。
 * 值域刻意都收在 [-1, 1] 或 [0, 1],呼叫端才不用記得每一個的尺度。
 */

/** 洗牌用的排列表大小。256 是 2 的冪次,index 可以用 & 255 取代取餘數。 */
const PERM_SIZE = 256;

/**
 * mulberry32:32 位元狀態的 PRNG。
 *
 * 選它不是因為它最亂,是因為它只有一個 32 位元狀態、十行內寫得完,而且
 * 在 JS 的整數運算下行為完全確定。噪聲要的是「看起來沒有規律」,不是密碼學強度。
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 八個方向的單位梯度。
 *
 * 用固定的八向而不是隨機角度:方向數少一點,噪聲會帶一點方格的傾向,
 * 而木紋與石面本來就有方向性,這個偏差反而幫得上忙。
 */
const GRADIENTS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.70710678, 0.70710678],
  [-0.70710678, 0.70710678],
  [0.70710678, -0.70710678],
  [-0.70710678, -0.70710678],
];

export type Noise2D = (x: number, y: number) => number;

/** 五次淡入淡出。三次的版本在格點上二階不連續,放大之後看得出格線。 */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * 2D 梯度噪聲(Perlin 形式),值域約 [-1, 1]。
 *
 * 每個整數格點配一個固定方向的梯度,取樣點對四個角落各做一次點積再內插。
 * 排列表由種子洗出來,所以「哪個格點配哪個方向」也是可重現的。
 */
export function makeNoise2D(seed: number): Noise2D {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(PERM_SIZE * 2);
  for (let i = 0; i < PERM_SIZE; i++) perm[i] = i;
  for (let i = PERM_SIZE - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = perm[i]!;
    perm[i] = perm[j]!;
    perm[j] = t;
  }
  for (let i = 0; i < PERM_SIZE; i++) perm[PERM_SIZE + i] = perm[i]!;

  const dot = (hash: number, dx: number, dy: number) => {
    const g = GRADIENTS[hash & 7]!;
    return g[0] * dx + g[1] * dy;
  };

  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const gx = xi & (PERM_SIZE - 1);
    const gy = yi & (PERM_SIZE - 1);

    const a = perm[gx]! + gy;
    const b = perm[gx + 1]! + gy;
    const n00 = dot(perm[a]!, xf, yf);
    const n10 = dot(perm[b]!, xf - 1, yf);
    const n01 = dot(perm[a + 1]!, xf, yf - 1);
    const n11 = dot(perm[b + 1]!, xf - 1, yf - 1);

    const u = fade(xf);
    const v = fade(yf);
    const top = n00 + u * (n10 - n00);
    const bottom = n01 + u * (n11 - n01);
    return top + v * (bottom - top);
  };
}

export interface FbmOptions {
  octaves?: number;
  /** 每一層頻率的倍數。2 是慣例,略微偏離可以打散層與層之間對齊的格線。 */
  lacunarity?: number;
  /** 每一層振幅的倍數。0.5 以下細節被壓得看不見,以上則整張變成雜訊。 */
  gain?: number;
}

/**
 * 疊加八度的分形噪聲,值域正規化回約 [-1, 1]。
 *
 * 木紋要的是「大起伏 + 細纖維」同時存在,單一頻率的噪聲只能給其中一種。
 */
export function makeFbm2D(seed: number, options: FbmOptions = {}): Noise2D {
  const octaves = options.octaves ?? 4;
  const lacunarity = options.lacunarity ?? 2.03;
  const gain = options.gain ?? 0.5;
  const noise = makeNoise2D(seed);

  // 先把總振幅算出來,取樣時就不用每次再跑一次迴圈。
  let norm = 0;
  let amp = 1;
  for (let i = 0; i < octaves; i++) {
    norm += amp;
    amp *= gain;
  }

  return (x, y) => {
    let sum = 0;
    let a = 1;
    let f = 1;
    for (let i = 0; i < octaves; i++) {
      sum += a * noise(x * f, y * f);
      a *= gain;
      f *= lacunarity;
    }
    return sum / norm;
  };
}

/** [0, 1] 的 fbm。畫布上大多數用途要的是亮度,不是有號的位移。 */
export function makeFbm01(seed: number, options?: FbmOptions): Noise2D {
  const fbm = makeFbm2D(seed, options);
  return (x, y) => fbm(x, y) * 0.5 + 0.5;
}

/** 夾在兩端之間的三次平滑過渡。GLSL 的 smoothstep,只是這裡跑在 CPU 上。 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0 || 1e-6)));
  return t * t * (3 - 2 * t);
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 與影格率無關的指數阻尼。
 *
 * `current += (target - current) * rate` 這種寫法在 144Hz 的機器上會比 60Hz 快
 * 兩倍收斂 —— 同一個場景在不同螢幕上動得不一樣快。改成以「半衰期」計時,
 * 就跟一格有多長無關了。
 */
export function damp(current: number, target: number, halfLife: number, dt: number): number {
  if (halfLife <= 0) return target;
  return target + (current - target) * Math.pow(2, -dt / halfLife);
}
