import { parseEventTheme, type EventTheme } from '@theatron/ui';

import raw from './lunjian.json';

/**
 * 《論劍》的活動主題。
 *
 * 色值全部在 lunjian.json:主題是資料(theming.md),日後搬進 tournaments.theme
 * 時就是這一份 JSON 原樣進 DB。第 1 層的 hex 只准出現在主題資料裡,所以是 .json
 * 而不是 .ts —— check-tokens 掃的是程式碼,不掃資料。
 *
 * 色盤只有七個名字:夜藍、霧青、月白、朽木褐、枯竹黃、朱紅、劍光青。**沒有金。**
 * 中性階由深到淺就是夜藍→霧青→月白;朱紅是整站唯一會「滲」的顏色,梅花與血墨
 * 共用它,所以它掛在 live(正在發生 / 危險)這個職責上 —— 職責沒有被挪用,
 * 只是這個世界裡「正在發生」剛好長這個樣子。
 */
export const lunjianTheme: EventTheme = parseEventTheme(raw);

/**
 * 三個色盤裡有、但 EventTheme 的欄位裝不下的顏色。
 *
 * EventTheme 只認六個中性階加 money / win / live —— 那是平台契約,不因為一場活動
 * 想多一個顏色就加欄位(packages/ui 不歸這裡改)。朽木褐(剝漆木牆)、劍光青
 * (唯一會發光的東西是劍)、枯竹黃(枯竹與等寬標籤)是《論劍》自己的三個 slot,
 * 所以由這裡補一條規則掛在同一個 [data-theme] 上。
 *
 * 名字刻意落在既有的語意家族(--surface-* / --accent-*):元件只能碰語意 slot,
 * 新增的也必須是語意 slot,不是第 1 層色階的別名。
 */
const EXTRA_SLOTS: readonly string[] = [
  'surface-wood',
  'accent-blade',
  'accent-bamboo',
  // 紙面。`semantic.css` 已經用中性階的兩端給了預設(任何主題都成立),
  // 這裡只是把它調成宣紙的暖白與墨的黑 —— 冷月白當紙會讓告示讀起來像塑膠。
  'surface-paper',
  'text-on-paper',
  // 陣營辨識與勝敗狀態獨立。
  'accent-side-red',
  'accent-side-blue',
];

/** 主題最終會變成注入頁面的 CSS,所以值進 <style> 之前要擋得住 `}` 跳出宣告區塊。 */
const SAFE = /^[A-Za-z0-9\s#%(),.'\-_]+$/;

export function lunjianExtraCss(): string {
  const extras = (raw as { extras: Record<string, string> }).extras;
  const declarations = EXTRA_SLOTS.map((slot) => {
    const value = (extras[slot] ?? '').trim();
    if (value === '' || !SAFE.test(value)) {
      throw new Error(`主題欄位 extras.${slot} 含有不能注入 CSS 的值`);
    }
    return `--${slot}:${value}`;
  });
  return `[data-theme="${lunjianTheme.id}"]{${declarations.join(';')}}`;
}
