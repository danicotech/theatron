import { CanvasTexture, LinearSRGBColorSpace, RepeatWrapping, SRGBColorSpace } from 'three';

import { clamp, makeFbm01, makeFbm2D, mulberry32, smoothstep } from './noise';

/**
 * 全部的材質,在執行期用 Canvas 2D 畫出來。
 *
 * 一張圖檔都沒有。理由不是炫技:這一頁的第一屏已經要載字體、章節本文與近景
 * 去背素材,再加十張 PBR 貼圖就是一秒以上的白畫面;而程序材質的成本是幾十
 * 毫秒的 CPU,還可以排在世界組裝的同一個 tick 裡。
 *
 * 每一張的做法都一樣:種子亂數 + fbm 畫出 albedo,再把亮度當高度場微分成
 * 法線貼圖,需要的時候另出一張粗糙度。所以一塊木頭是三張圖,而不是一張。
 *
 * 顏色一律用 rgb() 字串寫。這個 repo 的 custom lint 禁止在 ts/css 裡出現
 * 十六進位色 —— 那條規則是為了「換主題不用重新部署」,3D 的布景雖然不吃語意
 * token,但沒有理由為它開一個例外的語法。
 */

/** 一份材質的三張圖。沒有的那張是 null,而不是不存在的屬性 —— 呼叫端少一種分支。 */
export interface TextureSet {
  map: CanvasTexture;
  normal: CanvasTexture | null;
  rough: CanvasTexture | null;
}

export type TextureKey =
  | 'timber'
  | 'granite'
  | 'lacquer'
  | 'paper'
  | 'roofTile'
  | 'snowGround'
  | 'moon'
  | 'ridge'
  | 'sky'
  | 'glow';

export interface TextureLibrary {
  get(key: TextureKey): TextureSet;
  dispose(): void;
}

/**
 * 一次掛載用一份庫。
 *
 * 快取做成實例而不是模組層的全域:世界會隨頁面掛載與卸載,全域快取在卸載後
 * 仍然握著十張 canvas 與它們的 GPU 資源,而那正是「沒有記憶體洩漏」要防的事。
 */
export function createTextureLibrary(): TextureLibrary {
  const cache = new Map<TextureKey, TextureSet>();

  return {
    get(key) {
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      const made = BUILDERS[key]();
      cache.set(key, made);
      return made;
    },
    dispose() {
      for (const set of cache.values()) {
        set.map.dispose();
        set.normal?.dispose();
        set.rough?.dispose();
      }
      cache.clear();
    },
  };
}

interface Surface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

function surface(width: number, height = width): Surface {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('世界材質:拿不到 2D context');
  return { canvas, ctx, width, height };
}

function rgb(r: number, g: number, b: number, a = 1): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

/** 逐像素填一張圖。回呼拿正規化座標,回傳 0..255 的四個通道。 */
function paint(
  s: Surface,
  fill: (u: number, v: number, x: number, y: number) => [number, number, number, number],
): void {
  const img = s.ctx.createImageData(s.width, s.height);
  const data = img.data;
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const [r, g, b, a] = fill(x / s.width, y / s.height, x, y);
      const i = (y * s.width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  s.ctx.putImageData(img, 0, 0);
}

function tex(canvas: HTMLCanvasElement, srgb: boolean): CanvasTexture {
  const t = new CanvasTexture(canvas);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * 把一張圖的亮度當成高度場,微分成法線貼圖。
 *
 * 差分用環繞取樣(& mask),因為所有這些貼圖都是要平鋪的 —— 邊緣不環繞的話,
 * 每一塊磚的接縫上會多出一條不存在的稜線。
 */
export function heightToNormal(source: HTMLCanvasElement, strength = 2.2): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const src = source.getContext('2d');
  if (src === null) throw new Error('世界材質:拿不到來源 context');
  const input = src.getImageData(0, 0, w, h).data;

  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    lum[i] =
      (0.2126 * input[i * 4]! + 0.7152 * input[i * 4 + 1]! + 0.0722 * input[i * 4 + 2]!) / 255;
  }

  const out = surface(w, h);
  const img = out.ctx.createImageData(w, h);
  const data = img.data;
  const at = (x: number, y: number) => lum[(((y % h) + h) % h) * w + (((x % w) + w) % w)]!;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(-dx, -dy, 1);
      const i = (y * w + x) * 4;
      data[i] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((1 / len) * 0.5 * 255 + 127.5);
      data[i + 3] = 255;
    }
  }
  out.ctx.putImageData(img, 0, 0);
  return out.canvas;
}

/** 從已經畫好的 albedo 生一張粗糙度:暗的地方粗、亮的地方略光。 */
function roughFrom(source: HTMLCanvasElement, base: number, swing: number): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const src = source.getContext('2d');
  if (src === null) throw new Error('世界材質:拿不到來源 context');
  const input = src.getImageData(0, 0, w, h).data;
  const out = surface(w, h);
  const img = out.ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const l =
      (0.2126 * input[i * 4]! + 0.7152 * input[i * 4 + 1]! + 0.0722 * input[i * 4 + 2]!) / 255;
    const r = clamp(base - (l - 0.5) * swing, 0, 1) * 255;
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = r;
    img.data[i * 4 + 2] = r;
    img.data[i * 4 + 3] = 255;
  }
  out.ctx.putImageData(img, 0, 0);
  return out.canvas;
}

function set(
  map: HTMLCanvasElement,
  normal: HTMLCanvasElement | null,
  rough: HTMLCanvasElement | null,
): TextureSet {
  return {
    map: tex(map, true),
    normal: normal === null ? null : tex(normal, false),
    rough: rough === null ? null : tex(rough, false),
  };
}

/* ---------------------------------------------------------------- 各張貼圖 */

/**
 * 焦過的木料。
 *
 * 木紋沿著 v 走(圓柱的 UV 是「繞一圈 × 沿長度」),所以噪聲在 v 方向拉長
 * 三十倍以上。少了這個拉伸會得到一塊「有雜訊的板子」,不是木頭 ——
 * 木頭之所以看得出是木頭,靠的是紋路的方向性,不是紋路本身。
 */
function buildTimber(): TextureSet {
  const s = surface(512);
  const grain = makeFbm2D(1741, { octaves: 5, gain: 0.55 });
  const blotch = makeFbm01(9042, { octaves: 3 });
  const rand = mulberry32(2213);
  // 幾個節疤的位置。木頭上沒有節疤就是合成板。
  const knots = Array.from({ length: 5 }, () => ({
    u: rand(),
    v: rand(),
    r: 0.012 + rand() * 0.02,
  }));

  paint(s, (u, v) => {
    let g = grain(u * 34, v * 2.4) * 0.5 + 0.5;
    // 節疤把紋路往外推,所以離節疤越近頻率越高。
    for (const k of knots) {
      const du = Math.abs(u - k.u);
      const dv = (v - k.v) * 2.6;
      const d = Math.hypot(Math.min(du, 1 - du), dv);
      if (d < k.r * 5) {
        g -= smoothstep(k.r * 5, k.r, d) * 0.42;
      }
    }
    const wash = blotch(u * 5, v * 5);
    const t = clamp(g * 0.72 + wash * 0.28, 0, 1);
    // 炭化過的深棕,紅略高於綠、綠略高於藍,不然會走成純灰。
    const r = 20 + t * 40;
    const gr = 16 + t * 32;
    const b = 14 + t * 26;
    return [r, gr, b, 255];
  });

  return set(s.canvas, heightToNormal(s.canvas, 2.6), roughFrom(s.canvas, 0.86, 0.24));
}

/** 切割過的花崗石舖面。灰中帶青,接縫是切出來的直線,不是風化出來的裂縫。 */
function buildGranite(): TextureSet {
  const s = surface(512);
  const speck = makeFbm01(553, { octaves: 5, gain: 0.62 });
  const stain = makeFbm01(7781, { octaves: 3 });
  const TILES = 4;

  paint(s, (u, v) => {
    const fu = (u * TILES) % 1;
    const fv = (v * TILES) % 1;
    // 接縫:兩側各留一點,邊緣才有磨圓的過渡而不是一條硬線。
    const joint = Math.min(
      smoothstep(0, 0.035, fu) * smoothstep(1, 0.965, fu),
      smoothstep(0, 0.035, fv) * smoothstep(1, 0.965, fv),
    );
    const grit = speck(u * 120, v * 120);
    const wash = stain(u * 7, v * 7);
    let t = 0.46 + grit * 0.34 + wash * 0.2;
    t *= 0.34 + joint * 0.66;
    const l = clamp(t, 0, 1);
    return [38 + l * 62, 43 + l * 66, 46 + l * 66, 255];
  });

  return set(s.canvas, heightToNormal(s.canvas, 1.5), roughFrom(s.canvas, 0.8, 0.3));
}

/**
 * 風化的朱漆。
 *
 * 刻意畫得很不紅 —— 彩度由材質色補回去(見 buildings.ts 的 lacquerMaterial)。
 * 把彩度畫進貼圖再整體提亮,朱紅在 ACES 之後會變成磚紅;把紅通道單獨拉高才
 * 留得住那個顏色。
 */
function buildLacquer(): TextureSet {
  const s = surface(256);
  const crack = makeFbm2D(3301, { octaves: 5, gain: 0.6 });
  const wear = makeFbm01(4407, { octaves: 3 });

  paint(s, (u, v) => {
    const c = Math.abs(crack(u * 26, v * 26));
    // 漆面的龜裂是網狀的:取 fbm 的絕對值,零附近就是那張網。
    const veins = smoothstep(0.16, 0, c);
    const w = wear(u * 4, v * 6);
    const t = clamp(0.62 + w * 0.34 - veins * 0.46, 0, 1);
    return [96 + t * 86, 74 + t * 54, 68 + t * 46, 255];
  });

  return set(s.canvas, heightToNormal(s.canvas, 1.8), null);
}

/** 紙:燈籠與木堂的格扇。纖維走橫向,因為紙是一張一張橫著糊上去的。 */
function buildPaper(): TextureSet {
  const s = surface(256);
  const fibre = makeFbm01(6611, { octaves: 4, gain: 0.5 });
  const blot = makeFbm01(2287, { octaves: 3 });

  paint(s, (u, v) => {
    const f = fibre(u * 3.2, v * 46);
    const b = blot(u * 6, v * 6);
    const t = clamp(0.66 + f * 0.24 + b * 0.16, 0, 1);
    return [196 + t * 58, 168 + t * 56, 124 + t * 46, 255];
  });

  return set(s.canvas, heightToNormal(s.canvas, 0.9), null);
}

/** 筒瓦。一條一條的半圓凸起沿 u 排,橫向的瓦當線沿 v 排。 */
function buildRoofTile(): TextureSet {
  const s = surface(512);
  const grit = makeFbm01(881, { octaves: 4 });
  const RIBS = 16;
  const ROWS = 9;

  paint(s, (u, v) => {
    const fu = (u * RIBS) % 1;
    // 半圓的明暗:中央高、兩側低,並在溝底再壓一次。
    const barrel = Math.sin(fu * Math.PI);
    const valley = smoothstep(0.12, 0, Math.min(fu, 1 - fu));
    const fv = (v * ROWS) % 1;
    const course = smoothstep(0, 0.06, fv) * smoothstep(1, 0.94, fv);
    const g = grit(u * 60, v * 60);
    const t = clamp(barrel * 0.52 - valley * 0.3 + g * 0.24 + course * 0.18, 0, 1);
    return [24 + t * 46, 28 + t * 48, 32 + t * 50, 255];
  });

  return set(s.canvas, heightToNormal(s.canvas, 3.2), roughFrom(s.canvas, 0.74, 0.28));
}

/** 積雪的地。它不是白的 —— 夜裡的雪是月光的顏色,偏青。 */
function buildSnowGround(): TextureSet {
  const s = surface(512);
  const drift = makeFbm01(4129, { octaves: 5, gain: 0.55 });
  const grit = makeFbm01(5150, { octaves: 3 });

  paint(s, (u, v) => {
    // 風吹出來的皺褶:噪聲拉長成一個方向,雪面才有走向。
    const d = drift(u * 9, v * 3.2);
    const g = grit(u * 90, v * 90);
    const t = clamp(0.42 + d * 0.46 + g * 0.12, 0, 1);
    return [72 + t * 108, 84 + t * 116, 94 + t * 122, 255];
  });

  return set(s.canvas, heightToNormal(s.canvas, 1.1), null);
}

/** 月亮:一片自帶 alpha 的貼片。盤面之外還有一圈暈,暈才是它照得到東西的證據。 */
function buildMoon(): TextureSet {
  const s = surface(256);
  const mare = makeFbm01(1024, { octaves: 4 });

  paint(s, (u, v) => {
    const dx = u - 0.5;
    const dy = v - 0.5;
    const r = Math.hypot(dx, dy) * 2;
    const disc = smoothstep(0.44, 0.38, r);
    const halo = Math.pow(clamp(1 - r, 0, 1), 3.4) * 0.5;
    const m = mare(u * 5, v * 5);
    const l = 0.82 + m * 0.18;
    const a = clamp(disc + halo, 0, 1);
    return [226 * l, 234 * l, 236 * l, a * 255];
  });

  return set(s.canvas, null, null);
}

/** 遠山的剪影:天際線以下不透明,以上全空。只有 alpha 有用,顏色由材質給。 */
function buildRidge(): TextureSet {
  const s = surface(1024, 256);
  const crest = makeFbm2D(9911, { octaves: 5, gain: 0.52 });
  const trees = makeFbm01(3377, { octaves: 3 });

  paint(s, (u, v) => {
    // 天際線:一條 1D 的 fbm。第二層高頻是林線,不是山本身。
    const line = 0.52 + crest(u * 3.4, 0.5) * 0.3 + crest(u * 11, 7.5) * 0.06;
    const tree = trees(u * 140, 3) * 0.05;
    const edge = line - tree;
    const a = smoothstep(edge - 0.012, edge + 0.012, v);
    return [255, 255, 255, a * 255];
  });

  return set(s.canvas, null, null);
}

/** 天空。夜是有層次的:地平線附近略暖一點,因為底下有城與燈。 */
function buildSky(): TextureSet {
  const s = surface(512, 256);
  const cloud = makeFbm01(7373, { octaves: 5, gain: 0.55 });
  const rand = mulberry32(4242);
  const stars = Array.from({ length: 220 }, () => ({
    u: rand(),
    v: rand() * 0.72,
    b: 0.3 + rand() * 0.7,
  }));

  paint(s, (u, v) => {
    const sky = smoothstep(0, 1, v);
    const c = cloud(u * 4.5, v * 2.4);
    // 雲只在地平線附近有份量;天頂的雲會把月亮的位置弄糊。
    const band = smoothstep(0.4, 1, v) * c * 0.5;
    const r = 5 + sky * 16 + band * 26;
    const g = 8 + sky * 20 + band * 26;
    const b = 13 + sky * 28 + band * 28;
    return [r, g, b, 255];
  });

  // 星點畫在噪聲之上:逐像素判斷兩百個點太慢,直接用 2D API 點上去。
  for (const st of stars) {
    s.ctx.fillStyle = rgb(214, 226, 232, st.b);
    s.ctx.fillRect(st.u * s.width, st.v * s.height, 1, 1);
  }

  return set(s.canvas, null, null);
}

/** 加色用的光暈貼片。燈籠、月暈、火星共用一張。 */
function buildGlow(): TextureSet {
  const s = surface(128);
  paint(s, (u, v) => {
    const r = Math.hypot(u - 0.5, v - 0.5) * 2;
    const a = Math.pow(clamp(1 - r, 0, 1), 2.6);
    return [255, 214, 150, a * 255];
  });
  return set(s.canvas, null, null);
}

const BUILDERS: Record<TextureKey, () => TextureSet> = {
  timber: buildTimber,
  granite: buildGranite,
  lacquer: buildLacquer,
  paper: buildPaper,
  roofTile: buildRoofTile,
  snowGround: buildSnowGround,
  moon: buildMoon,
  ridge: buildRidge,
  sky: buildSky,
  glow: buildGlow,
};
