import { isPlaceholder } from './content';

/**
 * 日期到了沒。
 *
 * 第五章每個日期是梅枝上的一朵花,到期才開。所以要回答的只有一個問題:
 * 這一天到了嗎。三個答案之外多一個 `unknown` —— 日期還沒定案的時候,
 * 花既不是開的也不是「還沒到」,它是**不知道**。把不知道畫成「還沒到」
 * 等於替主辦宣布了一件他還沒決定的事。
 *
 * 比較刻意做在「日」這一級:比賽日期是一天,不是一個時刻。用時刻比的話,
 * 決賽當天早上十點會顯示成「還沒到」,而那天的人正在打決賽。
 */

export type DateState = 'unknown' | 'upcoming' | 'due';

/** `YYYY-MM-DD` → 當地時區那一天的 00:00。格式不合就是 null。 */
export function parseDay(iso: string): Date | null {
  if (isPlaceholder(iso)) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (m === null) return null;
  // 用當地時區建構,不是 Date.parse —— `new Date('2026-10-01')` 是 UTC 午夜,
  // 在台北會變成當天早上八點,而在西半球會變成前一天。日期差一天是這裡最容易
  // 犯、也最難被發現的錯。
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 某一天相對於「現在」是什麼狀態。`now` 由呼叫端給,所以測得起來。 */
export function dateState(iso: string, now: Date): DateState {
  const day = parseDay(iso);
  if (day === null) return 'unknown';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return day.getTime() <= today.getTime() ? 'due' : 'upcoming';
}

/** 花開多少。到期是全開,其餘是花苞 —— 中間值留給序幕那朵被刮開的。 */
export function bloomOf(state: DateState): number {
  return state === 'due' ? 1 : 0;
}

/** 給人讀的一行。未定案就是「待公布」,不是一串大括號。 */
export function formatDay(iso: string): string {
  const day = parseDay(iso);
  if (day === null) return '待公布';
  return `${day.getFullYear()}.${String(day.getMonth() + 1).padStart(2, '0')}.${String(
    day.getDate(),
  ).padStart(2, '0')}`;
}

/** 螢幕閱讀器要聽的狀態。圖示以外一定要有字 —— 花開不開是資訊。 */
export const STATE_LABEL: Readonly<Record<DateState, string>> = {
  unknown: '日期待公布',
  upcoming: '尚未到期',
  due: '已到期',
};
