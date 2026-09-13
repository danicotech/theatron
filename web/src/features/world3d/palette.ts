/**
 * 《劍塚》的七個顏色。
 *
 * 3D 這一層不吃主題 token(布景不是元件,它沒有「換一套主題」這件事),但也
 * 不能因此就讓每個檔案自己挑顏色 —— 那正是「一個概念只有一個權威位置」要擋
 * 的事。所以色盤住在這裡,`textures.ts` 與 `buildings.ts` 只准從這裡拿。
 *
 * 規格的硬規則,寫在這裡是因為這是唯一有機會違反它們的地方:
 *
 *   **沒有金色。** 上一版的斗栱是鎏金的,整組拿掉了。這座武館荒廢了很多年,
 *   金箔是第一個被刮走的東西。
 *
 *   **朱紅是全站唯一的飽和色**,只給梅花與血墨。木頭、竹子、屋瓦一律不准碰
 *   朱紅 —— 只要牌樓也是紅的,梅花就不再是畫面上唯一的那一點紅。
 *
 *   **只有劍身會發光。** 斗栱不發光、窗紙不發光、燈籠只剩餘燼。夜景的層次
 *   來自剪影與霧,不是來自把東西點亮。
 */
export const PALETTE = {
  /** 夜藍:天、霧、暗部的底。 */
  nightBlue: 0x0a1320,
  /** 霧青:霧、月光打到的側面、苔。 */
  mistCyan: 0x5b7280,
  /** 月白:唯一的冷光源與它照到的高光。 */
  moonWhite: 0xdde7ea,
  /** 朽木褐:所有木構。這座場景八成的面積是這個顏色。 */
  rotBrown: 0x4b3c31,
  /** 枯竹黃:竹身與枯葉。是灰黃,不是鮮黃 —— 這片竹子也死了一半。 */
  deadBamboo: 0x9c9060,
  /** 朱紅:梅花與血墨,沒有第三個用途。 */
  vermilion: 0xb32f28,
  /** 劍光青:劍身。全場唯一准許過曝的顏色。 */
  bladeCyan: 0x86dcd6,
} as const;

export type PaletteKey = keyof typeof PALETTE;

/**
 * 把色盤的值拆成 0…255 三個通道。
 *
 * canvas 的貼圖是逐像素算出來的,需要的是數字不是 CSS 字串;而讓每支 builder
 * 自己寫一次 `>> 16 & 255` 就是三十份一模一樣的位元運算。
 */
export function channels(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

/**
 * 兩個色盤顏色之間的插值,回傳 0…255 三個通道。
 *
 * 風化的木頭不是單一顏色,是「乾的地方偏褐、濕的地方偏青」。與其在每張貼圖
 * 裡各寫一組魔術數字,不如一律寫成「兩個色盤色之間的某一點」—— 這樣色盤真的
 * 改了的時候,所有貼圖會一起跟著改。
 */
export function blendHex(a: number, b: number, t: number): number {
  const [r, g, bl] = blend(a, b, t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

export function blend(a: number, b: number, t: number): [number, number, number] {
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k];
}
