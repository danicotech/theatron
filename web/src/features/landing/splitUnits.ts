/** 一個空白的記號。切出來的陣列裡遇到它就照原樣輸出空白,不包成出場單位。 */
export const SPACE = ' ';

const HAN = /\p{Script=Han}/u;
/** 跟在前一個字後面的標點:它不該自己一個人出場。 */
const TRAILING = /[,.;:!?、,。;:!?」』)】〕》…—]/u;
/** 開在下一個字前面的標點。 */
const LEADING = /[「『(【〔《]/u;
/** `\s` 在 unicode 模式下已經含全形空白(U+3000),不必再列一次。 */
const WHITESPACE = /\s/u;

/**
 * 把中文標題切成逐字出場的單位。
 *
 * 英文是逐詞,中文沒有詞界,所以逐字;但「BP」「2026」這種夾在中間的拉丁字串
 * 要當一個單位,拆成 B、P 兩個字母各自浮起來會像壞掉。
 * 標點黏在鄰字上 —— 一個逗號自己從遮罩裡升起來,看的人只看到一粒東西在跳。
 */
export function splitUnits(text: string): string[] {
  const out: string[] = [];
  let latin = '';
  let pendingLead = '';

  const flushLatin = () => {
    if (latin !== '') {
      out.push(pendingLead + latin);
      latin = '';
      pendingLead = '';
    }
  };
  const attachTrailing = (ch: string) => {
    const last = out.length - 1;
    if (last >= 0 && out[last] !== SPACE) out[last] += ch;
    else out.push(ch);
  };

  for (const ch of text) {
    if (WHITESPACE.test(ch)) {
      flushLatin();
      if (out[out.length - 1] !== SPACE) out.push(SPACE);
    } else if (HAN.test(ch)) {
      flushLatin();
      out.push(pendingLead + ch);
      pendingLead = '';
    } else if (TRAILING.test(ch)) {
      if (latin !== '') latin += ch;
      else attachTrailing(ch);
    } else if (LEADING.test(ch)) {
      flushLatin();
      pendingLead += ch;
    } else {
      latin += ch;
    }
  }
  flushLatin();
  if (pendingLead !== '') out.push(pendingLead);
  return out;
}
