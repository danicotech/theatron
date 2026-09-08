// 第 1 層 token 的變數名清單。
//
// 為什麼這份清單在這裡而不是在 theme/:主題注入是「把 JSON 寫進這些名字」,
// 名字的權威位置就該跟宣告它們的 primitives.css 放在一起。改色票時兩個檔案一起改,
// 不會有一邊漏掉。

/** 六個中性階,由深到淺。主題 JSON 的 `primitives.neutral` 依序對應。 */
export const NEUTRAL_VARS = [
  '--plum-900',
  '--plum-800',
  '--plum-700',
  '--plum-500',
  '--plum-300',
  '--plum-050',
] as const;

/** 三個語意色的第 1 層來源。職責固定,主題只換色值。 */
export const SEMANTIC_COLOR_VARS = {
  money: '--amber-400',
  win: '--mint-400',
  live: '--rose-400',
} as const;

/** 顯示字體。內文與等寬字體不開放自訂,所以不在這裡。 */
export const DISPLAY_FONT_VAR = '--raw-font-display';

/** 圓角三個值,主題只能等比縮放。 */
export const RADIUS_VARS = {
  card: '--raw-radius-card',
  control: '--raw-radius-control',
  pill: '--raw-radius-pill',
} as const;

/** 圓角基準值(px),radiusScale 乘在這上面。0 = 全直角。 */
export const RADIUS_BASE_PX = {
  card: 10,
  control: 6,
  pill: 999,
} as const;

/**
 * 中性階。刻意不是六元組:主題是從 DB 來的資料,長度只能在執行期驗
 * (toCssVars 會擋),用 tuple 型別假裝編譯期驗過了反而誤導。
 */
export type NeutralRamp = readonly string[];
