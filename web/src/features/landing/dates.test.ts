import { describe, expect, it } from 'vitest';

import { PLACEHOLDER } from './content';
import { bloomOf, dateState, formatDay, parseDay } from './dates';

const NOW = new Date(2026, 9, 15, 14, 30); // 2026-10-15 下午

describe('日期到了沒', () => {
  it('還沒到的日期不開花', () => {
    expect(dateState('2026-11-01', NOW)).toBe('upcoming');
    expect(bloomOf('upcoming')).toBe(0);
  });

  it('到期的日期開花,過去的仍然開著 —— 它確實到過', () => {
    expect(dateState('2026-10-15', NOW)).toBe('due');
    expect(dateState('2026-09-01', NOW)).toBe('due');
    expect(bloomOf('due')).toBe(1);
  });

  // 把「不知道」畫成「還沒到」,等於替主辦宣布了一件他還沒決定的事。
  it('還沒定案的日期是「不知道」,不是「還沒到」', () => {
    expect(dateState(PLACEHOLDER, NOW)).toBe('unknown');
    expect(dateState('', NOW)).toBe('unknown');
    expect(dateState('下個月', NOW)).toBe('unknown');
    expect(bloomOf('unknown')).toBe(0);
    expect(formatDay(PLACEHOLDER)).toBe('待公布');
  });

  // 比較做在「日」這一級:決賽當天早上十點不該顯示成「還沒到」。
  it('當天一整天都算到期,不管現在幾點', () => {
    const morning = new Date(2026, 9, 15, 0, 1);
    const night = new Date(2026, 9, 15, 23, 59);
    expect(dateState('2026-10-15', morning)).toBe('due');
    expect(dateState('2026-10-15', night)).toBe('due');
  });

  // `new Date('2026-10-01')` 是 UTC 午夜,在台北會變成當天早上八點,
  // 在西半球會直接變成前一天。日期差一天是這裡最容易犯、最難發現的錯。
  it('用當地時區建構,不靠 Date.parse', () => {
    const d = parseDay('2026-10-01')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
  });

  it('格式不合就是 null,不猜', () => {
    expect(parseDay('2026/10/01')).toBeNull();
    expect(parseDay('2026-13-45')).not.toBeNull(); // 月份溢位由 Date 自己正規化
    expect(parseDay('abc')).toBeNull();
  });

  it('顯示用的一行是點分隔、補零的', () => {
    expect(formatDay('2026-10-01')).toBe('2026.10.01');
    expect(formatDay('2026-03-09')).toBe('2026.03.09');
  });
});
