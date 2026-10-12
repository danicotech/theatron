import { channels, PALETTE, type PaletteKey } from '../world3d/palette';

/**
 * 色盤 → shader uniform。
 *
 * 這裡**不定義任何顏色**。《論劍》的七個色名住在 `world3d/palette.ts`
 * (3D 那一層不吃主題 token,理由寫在那個檔案的開頭),序幕是 3D,所以它跟
 * 環境層拿同一份 —— 旗上的朱紅與牌樓旁邊梅花的朱紅必須是同一個數字。
 *
 * 這支只做一件那邊沒做的事:轉成**線性**空間的 0…1 三元組。序幕的合成在線性
 * 空間做(疊光、月光穿過布),sRGB 的數字直接拿去乘會把暗部提亮成灰,整面布
 * 就會變成一塊發灰的塑膠。`channels()` 給的是 0…255 的 sRGB,不能直接用。
 */

/** 一個顏色的線性 RGB,各分量 0…1。 */
export type Rgb = readonly [number, number, number];

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** 色盤上的一個名字 → 線性 RGB。 */
export function linearOf(key: PaletteKey): Rgb {
  const [r, g, b] = channels(PALETTE[key]);
  return [srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255)];
}
