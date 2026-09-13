import { describe, expect, it } from 'vitest';

import { inkVars, transitionAt } from './ink';

function radius(p: number): number {
  return Number(
    String(inkVars(p)['--ink-radius' as keyof ReturnType<typeof inkVars>]).replace('%', ''),
  );
}

describe('墨暈', () => {
  it('兩端是零與滿,而且不回頭', () => {
    expect(radius(0)).toBe(0);
    expect(radius(1)).toBeCloseTo(150, 3);
    let last = -1;
    for (let p = 0; p <= 1.0001; p += 0.01) {
      const r = radius(p);
      expect(r).toBeGreaterThanOrEqual(last);
      last = r;
    }
  });

  it('超出範圍被夾住 —— 捲過頭不會把墨暈成負的', () => {
    expect(radius(-2)).toBe(0);
    expect(radius(7)).toBeCloseTo(150, 3);
  });

  it('起點由 origin 決定,三個名字各有各的位置', () => {
    expect(inkVars(1, { origin: 'tear' })['--ink-x' as never]).toBe('62%');
    expect(inkVars(1, { origin: 'centre' })['--ink-x' as never]).toBe('50%');
  });

  // 墨剛滴上去時前緣最糊,吃飽之後銳利下來。
  it('前緣越滲越銳利', () => {
    const early = Number(String(inkVars(0.1)['--ink-edge' as never]).replace('%', ''));
    const late = Number(String(inkVars(0.9)['--ink-edge' as never]).replace('%', ''));
    expect(late).toBeLessThan(early);
  });
});

describe('章節之間的轉場', () => {
  // 整數是章節的中心,不是交界 —— 這是最容易搞反、也最容易只在實機上才看出來的事。
  it('章節正中央沒有墨', () => {
    for (const p of [0, 1, 2, 6]) expect(transitionAt(p)).toBe(0);
  });

  // 序幕比一屏高四倍,而它的錨點被釘在 0 —— 所以 0.5 不是交界,是序幕演到一半。
  // 在那裡潑墨會跟正要滲開的血墨打架。
  it('序幕那一整段不潑墨', () => {
    for (let p = 0; p < 1; p += 0.05) expect(transitionAt(p)).toBe(0);
    expect(transitionAt(0.5)).toBe(0);
  });

  it('墨暈開又收掉,在兩章之間最濃', () => {
    expect(transitionAt(2.5)).toBeCloseTo(1, 6);
    expect(transitionAt(2.49)).toBeGreaterThan(0);
    expect(transitionAt(2.51)).toBeGreaterThan(0);
  });

  it('轉場帶之外一律是零 —— 讀字的時候畫面上不該有東西', () => {
    expect(transitionAt(2.1)).toBe(0);
    expect(transitionAt(2.9)).toBe(0);
  });

  // 它是位置的函式,所以中途換方向不需要「中斷」任何東西 —— 沒有東西在播。
  it('轉場帶裡對稱:同一段距離的兩側是同一個值', () => {
    for (let k = 1; k <= 16; k += 1) {
      const d = (k / 16) * 0.17;
      expect(transitionAt(2.5 - d)).toBeCloseTo(transitionAt(2.5 + d), 9);
    }
  });

  it('往回走跟往前走,同一個位置得到同一個值', () => {
    const ups: number[] = [];
    for (let k = 0; k <= 40; k += 1) ups.push(transitionAt(2.3 + k * 0.01));
    const downs: number[] = [];
    for (let k = 40; k >= 0; k -= 1) downs.unshift(transitionAt(2.3 + k * 0.01));
    expect(downs).toEqual(ups);
  });
});
