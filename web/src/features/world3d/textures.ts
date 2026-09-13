import {
  ClampToEdgeWrapping,
  CanvasTexture,
  LinearSRGBColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';

import { blend, channels, PALETTE } from './palette';
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
 * 這一版全部重畫過:上一個世界是雪夜的石構參道,這一個是**荒廢多年的木造
 * 武館**。差別不在色調,在「每一面都要看得出被放了很久」—— 龜裂、剝漆、
 * 水漬、苔、蛛網、鏽釘、落葉。石面與雪面整組刪掉,沒有留下來改色的價值。
 *
 * 顏色一律從 `palette.ts` 拿。這裡不准出現第八個顏色,尤其不准出現金色。
 */

/** 一份材質的三張圖。沒有的那張是 null,而不是不存在的屬性 —— 呼叫端少一種分支。 */
export interface TextureSet {
  map: CanvasTexture;
  normal: CanvasTexture | null;
  rough: CanvasTexture | null;
}

export type TextureKey =
  | 'timber'
  | 'plank'
  | 'shingle'
  | 'ground'
  | 'bamboo'
  | 'blossom'
  | 'cobweb'
  | 'paper'
  | 'moon'
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

function rgba(r: number, g: number, b: number, a = 1): string {
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

function tex(canvas: HTMLCanvasElement, srgb: boolean, tile = true): CanvasTexture {
  const t = new CanvasTexture(canvas);
  // 圖集(竹、梅花)不能平鋪:u 超過 1 會把葉子接到竹身上。
  t.wrapS = tile ? RepeatWrapping : ClampToEdgeWrapping;
  t.wrapT = tile ? RepeatWrapping : ClampToEdgeWrapping;
  t.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * 把一張圖的亮度當成高度場,微分成法線貼圖。
 *
 * 差分用環繞取樣(& mask),因為所有這些貼圖都是要平鋪的 —— 邊緣不環繞的話,
 * 每一塊板的接縫上會多出一條不存在的稜線。
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
  tile = true,
): TextureSet {
  return {
    map: tex(map, true, tile),
    normal: normal === null ? null : tex(normal, false, tile),
    rough: rough === null ? null : tex(rough, false, tile),
  };
}

/**
 * 風化的共同語彙。
 *
 * 龜裂、水漬、苔這三件事出現在木構的每一張貼圖上,寫三遍就會變成三種不同的
 * 龜裂 —— 而同一座建築上的裂縫應該是同一個成因。抽成三個函式,參數只有尺度。
 */

/** 裂縫:脊狀噪聲,零附近就是那條縫。回傳 0(沒裂)到 1(縫底)。 */
function cracks(noise: (x: number, y: number) => number, u: number, v: number, edge: number) {
  return smoothstep(edge, 0, Math.abs(noise(u, v)));
}

/** 水漬:往下拖的條紋。木頭的水漬永遠是垂直的,因為水往下流。 */
function damp(noise: (x: number, y: number) => number, u: number, v: number) {
  return clamp(noise(u * 6, v * 0.8) * 1.15, 0, 1);
}

/* ---------------------------------------------------------------- 各張貼圖 */

/**
 * 朽木:柱、樑、欄杆。整座場景八成的面積是這一張。
 *
 * 木紋沿著 v 走(圓柱的 UV 是「繞一圈 × 沿長度」),所以噪聲在 v 方向拉長
 * 三十倍以上。少了這個拉伸會得到一塊「有雜訊的板子」,不是木頭 ——
 * 木頭之所以看得出是木頭,靠的是紋路的方向性,不是紋路本身。
 *
 * 「朽」是三件事疊出來的:順著紋裂開的深縫、從上往下的水漬、以及背陰面長出
 * 來的苔。少了苔它只是舊木頭;有了苔才是**沒有人管的**舊木頭。
 */
function buildTimber(): TextureSet {
  const s = surface(512);
  const grain = makeFbm2D(1741, { octaves: 5, gain: 0.55 });
  const split = makeFbm2D(5519, { octaves: 4, gain: 0.5 });
  const stain = makeFbm2D(9042, { octaves: 3 });
  const moss = makeFbm01(2680, { octaves: 4, gain: 0.58 });
  const rand = mulberry32(2213);
  // 幾個節疤的位置。木頭上沒有節疤就是合成板。
  const knots = Array.from({ length: 5 }, () => ({
    u: rand(),
    v: rand(),
    r: 0.012 + rand() * 0.02,
  }));

  paint(s, (u, v) => {
    let g = grain(u * 34, v * 2.4) * 0.5 + 0.5;
    for (const k of knots) {
      const du = Math.abs(u - k.u);
      const dv = (v - k.v) * 2.6;
      const d = Math.hypot(Math.min(du, 1 - du), dv);
      if (d < k.r * 5) g -= smoothstep(k.r * 5, k.r, d) * 0.42;
    }
    // 縱裂:沿紋理方向拉長的脊狀噪聲。橫著裂的木頭是斷掉的,不是朽的。
    const crack = cracks(split, u * 13, v * 1.6, 0.09);
    const wet = damp(stain, u, v);
    const [r, gr, b] = blend(PALETTE.rotBrown, PALETTE.nightBlue, wet * 0.45 + crack * 0.55);
    // 苔只長在水漬重的地方,而且是一塊一塊的,不是一層。
    const m = smoothstep(0.58, 0.86, moss(u * 7, v * 7)) * wet;
    const [mr, mg, mb] = blend(PALETTE.rotBrown, PALETTE.mistCyan, 0.62);
    const t = 0.62 + g * 0.5;
    return [
      r * t * (1 - m) + mr * m * 0.7,
      gr * t * (1 - m) + mg * m * 0.7,
      b * t * (1 - m) + mb * m * 0.7,
      255,
    ];
  });

  return set(s.canvas, heightToNormal(s.canvas, 3.1), roughFrom(s.canvas, 0.92, 0.22));
}

/**
 * 剝漆木牆。第四章的鏡頭會貼到離它一公尺,所以它是全場唯一一張 1024。
 *
 * 三層,由下往上讀:板縫 → 底下的裸木 → 上面剝了一半的黑漆。漆片的邊緣要
 * **硬**,木紋的邊緣要軟 —— 這個對比是「漆剝落」與「木頭變色」的唯一差別,
 * 兩個都畫成軟的會得到一面髒牆而不是一面剝漆的牆。
 */
function buildPlank(): TextureSet {
  const s = surface(1024);
  const grain = makeFbm2D(3301, { octaves: 5, gain: 0.56 });
  const flake = makeFbm2D(4407, { octaves: 4, gain: 0.62 });
  const stain = makeFbm2D(8123, { octaves: 3 });
  const moss = makeFbm01(6104, { octaves: 4, gain: 0.58 });
  const grit = makeFbm01(7710, { octaves: 3 });
  const PLANKS = 7;

  paint(s, (u, v) => {
    const fu = (u * PLANKS) % 1;
    // 板縫:兩片木板之間的暗線。它同時是「這是一面板牆不是一塊板」的唯一證據。
    const seam = smoothstep(0, 0.022, fu) * smoothstep(1, 0.978, fu);
    // 每一片板自己的色偏。整面同色的板牆是三夾板。
    const plankShade = 0.82 + ((Math.floor(u * PLANKS) * 37) % 11) / 34;

    const g = grain(u * 46, v * 2.2) * 0.5 + 0.5;
    const wet = damp(stain, u, v);
    const [br, bg, bb] = blend(PALETTE.rotBrown, PALETTE.nightBlue, wet * 0.5);
    const bare = (0.58 + g * 0.55) * plankShade;

    // 漆:剩下的那幾片。閾值切出來的邊緣是硬的,正是漆片該有的邊。
    const lacquer = flake(u * 5.5, v * 5.5) > 0.02 ? 1 : 0;
    const lacquerEdge = smoothstep(0.02, 0.055, flake(u * 5.5, v * 5.5));
    const [lr, lg, lb] = blend(PALETTE.nightBlue, PALETTE.rotBrown, 0.22 + g * 0.14);

    const k = lacquer * lacquerEdge * (1 - wet * 0.35);
    let r = br * bare * (1 - k) + lr * k;
    let gg = bg * bare * (1 - k) + lg * k;
    let b = bb * bare * (1 - k) + lb * k;

    const m = smoothstep(0.6, 0.9, moss(u * 9, v * 6)) * clamp(v * 1.6 - 0.25, 0, 1);
    const [mr, mg, mb] = blend(PALETTE.rotBrown, PALETTE.mistCyan, 0.7);
    r = r * (1 - m) + mr * m;
    gg = gg * (1 - m) + mg * m;
    b = b * (1 - m) + mb * m;

    const dust = 0.94 + grit(u * 130, v * 130) * 0.12;
    const shade = seam * 0.72 + 0.28;
    return [r * shade * dust, gg * shade * dust, b * shade * dust, 255];
  });

  // 鏽釘:每片板上兩顆。畫在噪聲之上,逐像素判斷十四顆太慢。
  const nail = mulberry32(1207);
  for (let i = 0; i < PLANKS * 2; i++) {
    const x = ((Math.floor(i / 2) + 0.5) / PLANKS) * s.width;
    const y = (0.12 + (i % 2) * 0.64 + nail() * 0.12) * s.height;
    const [nr, ng, nb] = blend(PALETTE.rotBrown, PALETTE.vermilion, 0.3);
    s.ctx.fillStyle = rgba(nr, ng, nb, 0.85);
    s.ctx.beginPath();
    s.ctx.arc(x, y, 3.4, 0, Math.PI * 2);
    s.ctx.fill();
    // 釘子下面那道鏽痕。鏽從釘子往下流,所以它是水漬的一種。
    const grad = s.ctx.createLinearGradient(x, y, x, y + 46);
    grad.addColorStop(0, rgba(nr, ng, nb, 0.5));
    grad.addColorStop(1, rgba(nr, ng, nb, 0));
    s.ctx.fillStyle = grad;
    s.ctx.fillRect(x - 2.6, y, 5.2, 46);
  }

  return set(s.canvas, heightToNormal(s.canvas, 2.6), roughFrom(s.canvas, 0.9, 0.3));
}

/**
 * 木瓦屋頂。
 *
 * 不是筒瓦 —— 這個世界只有木頭,連屋頂也是。一層一層疊上去的木片,錯縫排,
 * 掉了幾片,縫裡長苔。掉片的地方畫成幾乎全黑:那是看得到底下椽木的陰影,
 * 也是「這個屋頂漏水」在一張平鋪貼圖裡唯一說得出口的方式。
 */
function buildShingle(): TextureSet {
  const s = surface(512);
  const grain = makeFbm2D(881, { octaves: 4, gain: 0.55 });
  const moss = makeFbm01(3392, { octaves: 4, gain: 0.6 });
  const gone = mulberry32(5533);
  const COLS = 11;
  const ROWS = 14;
  // 哪幾片不見了。先抽好,逐像素查表比逐像素亂數快得多。
  const missing = new Uint8Array(COLS * ROWS);
  for (let i = 0; i < missing.length; i++) missing[i] = gone() < 0.07 ? 1 : 0;

  paint(s, (u, v) => {
    const row = Math.floor(v * ROWS);
    // 錯縫:奇數列往旁邊挪半片。對齊的木瓦會漏水,而且讀起來像地磚。
    const offset = (row % 2) * 0.5;
    const col = Math.floor((u * COLS + offset) % COLS);
    const fu = (u * COLS + offset) % 1;
    const fv = v * ROWS - row;

    if (missing[row * COLS + col] === 1) {
      // 缺片:露出椽木的暗。給一點紋理,不然是一塊死黑的方塊。
      const dark = 0.1 + grain(u * 60, v * 20) * 0.06;
      const [r, g, b] = channels(PALETTE.nightBlue);
      return [r * dark * 4, g * dark * 4, b * dark * 4, 255];
    }

    // 下緣壓在下一列上面,所以每一片的下三分之一有一道陰影。
    const lap = smoothstep(0.78, 1, fv);
    const side = smoothstep(0, 0.05, fu) * smoothstep(1, 0.95, fu);
    const g = grain(u * 26, v * 90) * 0.5 + 0.5;
    const m = smoothstep(0.58, 0.88, moss(u * 12, v * 12)) * (1 - lap);
    const [br, bg, bb] = blend(PALETTE.rotBrown, PALETTE.nightBlue, 0.34);
    const [mr, mg, mb] = blend(PALETTE.rotBrown, PALETTE.mistCyan, 0.72);
    const t = (0.5 + g * 0.62) * (1 - lap * 0.62) * (0.42 + side * 0.58);
    return [
      br * t * (1 - m) + mr * m * 0.55,
      bg * t * (1 - m) + mg * m * 0.55,
      bb * t * (1 - m) + mb * m * 0.55,
      255,
    ];
  });

  return set(s.canvas, heightToNormal(s.canvas, 3.4), roughFrom(s.canvas, 0.88, 0.26));
}

/**
 * 地:潮濕的夯土、苔斑、積起來的落葉。
 *
 * 不是雪也不是石舖面 —— 這座武館的前庭早就沒有人掃了。落葉畫成一片一片有
 * 方向的小卵形(不是雜訊),因為落葉堆在畫面上的辨識度全靠「每一片都有邊」。
 */
function buildGround(): TextureSet {
  const s = surface(512);
  const soil = makeFbm01(4129, { octaves: 5, gain: 0.55 });
  const moss = makeFbm01(5150, { octaves: 4, gain: 0.6 });
  const wet = makeFbm01(6271, { octaves: 3 });

  paint(s, (u, v) => {
    const d = soil(u * 11, v * 11);
    const damper = wet(u * 3.5, v * 3.5);
    const [er, eg, eb] = blend(PALETTE.rotBrown, PALETTE.nightBlue, 0.34 + damper * 0.3);
    const t = 0.44 + d * 0.5;
    let r = er * t;
    let g = eg * t;
    let b = eb * t;
    const m = smoothstep(0.55, 0.82, moss(u * 16, v * 16));
    const [mr, mg, mb] = blend(PALETTE.rotBrown, PALETTE.mistCyan, 0.66);
    r = r * (1 - m) + mr * m * 0.8;
    g = g * (1 - m) + mg * m * 0.8;
    b = b * (1 - m) + mb * m * 0.8;
    return [r, g, b, 255];
  });

  // 落葉。畫在土之上,每一片各自的角度 —— 全部同方向就讀成拉絲。
  const rand = mulberry32(9317);
  for (let i = 0; i < 260; i++) {
    const x = rand() * s.width;
    const y = rand() * s.height;
    const a = rand() * Math.PI;
    const len = 5 + rand() * 7;
    const [lr, lg, lb] = blend(PALETTE.deadBamboo, PALETTE.rotBrown, 0.35 + rand() * 0.45);
    s.ctx.save();
    s.ctx.translate(x, y);
    s.ctx.rotate(a);
    s.ctx.fillStyle = rgba(lr, lg, lb, 0.42 + rand() * 0.3);
    s.ctx.beginPath();
    s.ctx.ellipse(0, 0, len, len * 0.36, 0, 0, Math.PI * 2);
    s.ctx.fill();
    s.ctx.restore();
  }

  return set(s.canvas, heightToNormal(s.canvas, 1.4), roughFrom(s.canvas, 0.95, 0.16));
}

/**
 * 竹的圖集:左半是竹身,右半是一叢葉子。
 *
 * 做成圖集是為了讓**一根竹子只有一次 draw call**。竹身要不透明、葉子要
 * alpha,分成兩種材質就是每根兩次;八十四根就是一百六十八次,而它們在畫面上
 * 只是一片影子。同一張貼圖 + alphaTest,兩者就能共用一支材質。
 *
 * 左半必須完全不透明,右半的底必須完全透明 —— 中間那條界線在 uv 上是硬切的,
 * 不能靠 mip 混過去,所以幾何那邊的 uv 要各自留 2% 的邊界。
 */
function buildBamboo(): TextureSet {
  const s = surface(512);
  const streak = makeFbm2D(7744, { octaves: 4, gain: 0.55 });
  const blot = makeFbm01(1191, { octaves: 3 });

  paint(s, (u, v) => {
    if (u >= 0.5) return [0, 0, 0, 0];
    const cu = u * 2;
    // 竹身的圓柱明暗畫進貼圖:一根竹子在畫面上只有幾個像素寬,靠法線算圓
    // 是算給沒人看得到的細節,直接畫死便宜得多。
    const round = Math.sin(cu * Math.PI);
    const g = streak(cu * 3.4, v * 40) * 0.5 + 0.5;
    const patch = smoothstep(0.55, 0.85, blot(cu * 5, v * 9));
    const [br, bg, bb] = blend(PALETTE.deadBamboo, PALETTE.rotBrown, 0.2 + patch * 0.55);
    const t = (0.36 + round * 0.72) * (0.72 + g * 0.42);
    return [br * t, bg * t, bb * t, 255];
  });

  // 葉叢:右半,用 2D API 畫。逐像素算十幾片柳葉形是一整頁的解析幾何,
  // 而 quadraticCurveTo 兩行就畫得出來。
  const rand = mulberry32(4821);
  const cx = s.width * 0.75;
  const cy = s.height * 0.62;
  for (let i = 0; i < 17; i++) {
    const a = -Math.PI * 0.9 + rand() * Math.PI * 0.8;
    const len = s.width * (0.1 + rand() * 0.14);
    const wide = len * (0.1 + rand() * 0.06);
    const [lr, lg, lb] = blend(PALETTE.deadBamboo, PALETTE.nightBlue, 0.28 + rand() * 0.42);
    s.ctx.save();
    s.ctx.translate(cx, cy);
    s.ctx.rotate(a);
    s.ctx.fillStyle = rgba(lr, lg, lb, 0.86);
    s.ctx.beginPath();
    s.ctx.moveTo(0, 0);
    s.ctx.quadraticCurveTo(len * 0.5, -wide, len, 0);
    s.ctx.quadraticCurveTo(len * 0.5, wide, 0, 0);
    s.ctx.fill();
    s.ctx.restore();
  }

  // 圖集不平鋪:平鋪會把葉子接到竹身上。
  return set(s.canvas, null, null, false);
}

/**
 * 梅花:五瓣,朱紅。全站唯一的飽和色就是這一張。
 *
 * 花心刻意畫得比花瓣暗:亮花心會在 bloom 裡變成一個發光的點,而這個世界只有
 * 劍身准許發光。
 */
function buildBlossom(): TextureSet {
  const s = surface(128);
  s.ctx.clearRect(0, 0, s.width, s.height);
  const [pr, pg, pb] = channels(PALETTE.vermilion);
  const cx = s.width / 2;
  const cy = s.height / 2;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const px = cx + Math.cos(a) * s.width * 0.2;
    const py = cy + Math.sin(a) * s.height * 0.2;
    const grad = s.ctx.createRadialGradient(px, py, 1, px, py, s.width * 0.19);
    grad.addColorStop(0, rgba(pr * 1.1, pg * 1.15, pb * 1.15, 0.98));
    grad.addColorStop(0.72, rgba(pr * 0.82, pg * 0.7, pb * 0.7, 0.9));
    grad.addColorStop(1, rgba(pr * 0.5, pg * 0.42, pb * 0.42, 0));
    s.ctx.fillStyle = grad;
    s.ctx.beginPath();
    s.ctx.arc(px, py, s.width * 0.19, 0, Math.PI * 2);
    s.ctx.fill();
  }
  const [dr, dg, db] = blend(PALETTE.vermilion, PALETTE.nightBlue, 0.55);
  s.ctx.fillStyle = rgba(dr, dg, db, 0.9);
  s.ctx.beginPath();
  s.ctx.arc(cx, cy, s.width * 0.05, 0, Math.PI * 2);
  s.ctx.fill();
  return set(s.canvas, null, null, false);
}

/**
 * 蛛網。一張帶 alpha 的貼片,掛在樑角與破窗上。
 *
 * 放射線 + 幾圈螺旋,不是噪聲 —— 蛛網之所以讀得出是蛛網,靠的是那個結構,
 * 而不是「有一些細白線」。
 */
function buildCobweb(): TextureSet {
  const s = surface(256);
  s.ctx.clearRect(0, 0, s.width, s.height);
  const [wr, wg, wb] = channels(PALETTE.mistCyan);
  s.ctx.strokeStyle = rgba(wr, wg, wb, 0.3);
  s.ctx.lineWidth = 0.9;
  const cx = 6;
  const cy = 6;
  const rays = 11;
  for (let i = 0; i < rays; i++) {
    const a = (i / (rays - 1)) * (Math.PI / 2);
    s.ctx.beginPath();
    s.ctx.moveTo(cx, cy);
    s.ctx.lineTo(cx + Math.cos(a) * s.width, cy + Math.sin(a) * s.height);
    s.ctx.stroke();
  }
  const rand = mulberry32(6060);
  for (let ring = 1; ring <= 7; ring++) {
    const r = (ring / 7) * s.width * 0.96;
    s.ctx.beginPath();
    for (let i = 0; i < rays; i++) {
      const a = (i / (rays - 1)) * (Math.PI / 2);
      // 每一段往圓心垂一點:蛛網的環是吊在輻上的弧,不是同心圓。
      const sag = r * (0.86 + rand() * 0.1);
      const x = cx + Math.cos(a) * sag;
      const y = cy + Math.sin(a) * sag;
      if (i === 0) s.ctx.moveTo(x, y);
      else s.ctx.lineTo(x, y);
    }
    s.ctx.stroke();
  }
  return set(s.canvas, null, null, false);
}

/** 燈籠剩下的那半張紙。破洞在邊緣,所以 alpha 從外往內咬進來。 */
function buildPaper(): TextureSet {
  const s = surface(256);
  const fibre = makeFbm01(6611, { octaves: 4, gain: 0.5 });
  const tear = makeFbm01(2287, { octaves: 4, gain: 0.6 });

  paint(s, (u, v) => {
    const f = fibre(u * 3.2, v * 46);
    const [pr, pg, pb] = blend(PALETTE.deadBamboo, PALETTE.rotBrown, 0.34);
    const t = 0.62 + f * 0.3;
    // 破:噪聲低於閾值的地方直接不見。edge 之外再加一圈焦褐。
    const hole = tear(u * 4.5, v * 4.5);
    const a = smoothstep(0.3, 0.42, hole);
    const burn = smoothstep(0.52, 0.36, hole);
    const [br, bg, bb] = blend(PALETTE.rotBrown, PALETTE.nightBlue, 0.5);
    return [
      pr * t * (1 - burn) + br * burn,
      pg * t * (1 - burn) + bg * burn,
      pb * t * (1 - burn) + bb * burn,
      a * 255,
    ];
  });

  return set(s.canvas, null, null, false);
}

/** 月:一片自帶 alpha 的貼片。盤面之外還有一圈暈,暈才是它照得到東西的證據。 */
function buildMoon(): TextureSet {
  const s = surface(256);
  const mare = makeFbm01(1024, { octaves: 4 });
  const [mr, mg, mb] = channels(PALETTE.moonWhite);

  paint(s, (u, v) => {
    const dx = u - 0.5;
    const dy = v - 0.5;
    const r = Math.hypot(dx, dy) * 2;
    const disc = smoothstep(0.34, 0.29, r);
    // 暈畫得比上一版寬而淡:這一版的 bloom 閾值拉高到只有劍身過得去,
    // 月亮的光暈只能靠貼圖自己畫出來。
    const halo = Math.pow(clamp(1 - r, 0, 1), 2.6) * 0.42;
    const m = mare(u * 5, v * 5);
    const l = 0.8 + m * 0.2;
    const a = clamp(disc + halo, 0, 1);
    return [mr * l, mg * l, mb * l, a * 255];
  });

  return set(s.canvas, null, null, false);
}

/**
 * 夜空。
 *
 * 幾乎是純夜藍。上一版在地平線附近加了一條暖帶(遠處有城),這一版拿掉了 ——
 * 這座武館在山裡,方圓十里沒有燈。剩下的層次只有霧與星。
 */
function buildSky(): TextureSet {
  const s = surface(512, 256);
  const mist = makeFbm01(7373, { octaves: 5, gain: 0.55 });
  const rand = mulberry32(4242);
  const stars = Array.from({ length: 190 }, () => ({
    u: rand(),
    v: rand() * 0.66,
    b: 0.22 + rand() * 0.58,
  }));

  paint(s, (u, v) => {
    const up = smoothstep(0, 1, v);
    const band = smoothstep(0.46, 1, v) * mist(u * 4.5, v * 2.4) * 0.6;
    const [nr, ng, nb] = channels(PALETTE.nightBlue);
    const [fr, fg, fb] = blend(PALETTE.nightBlue, PALETTE.mistCyan, 0.5);
    const t = 0.34 + up * 0.66;
    return [nr * t + fr * band * 0.5, ng * t + fg * band * 0.5, nb * t + fb * band * 0.5, 255];
  });

  const [sr, sg, sb] = channels(PALETTE.moonWhite);
  for (const st of stars) {
    s.ctx.fillStyle = rgba(sr, sg, sb, st.b);
    s.ctx.fillRect(st.u * s.width, st.v * s.height, 1, 1);
  }

  return set(s.canvas, null, null, false);
}

/**
 * 加色用的光暈貼片。月暈、餘燼、劍光共用一張。
 *
 * 白的,顏色由 sprite 的材質色給 —— 三個用途的顏色完全不同(月白、朱紅、
 * 劍光青),貼圖自己帶顏色就得存三張。
 */
function buildGlow(): TextureSet {
  const s = surface(128);
  paint(s, (u, v) => {
    const r = Math.hypot(u - 0.5, v - 0.5) * 2;
    const a = Math.pow(clamp(1 - r, 0, 1), 2.6);
    return [255, 255, 255, a * 255];
  });
  return set(s.canvas, null, null, false);
}

const BUILDERS: Record<TextureKey, () => TextureSet> = {
  timber: buildTimber,
  plank: buildPlank,
  shingle: buildShingle,
  ground: buildGround,
  bamboo: buildBamboo,
  blossom: buildBlossom,
  cobweb: buildCobweb,
  paper: buildPaper,
  moon: buildMoon,
  sky: buildSky,
  glow: buildGlow,
};
