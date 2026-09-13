import { describe, expect, it } from 'vitest';

import {
  clamp,
  damp,
  lerp,
  makeFbm01,
  makeFbm2D,
  makeNoise2D,
  mulberry32,
  smoothstep,
} from './noise';

/**
 * 噪聲的測試只在乎一件事:**可重現**。
 *
 * 整個場景沒有一張圖檔,木紋、剝漆、竹身、地面全部是從這裡長出來的。
 * 一旦它不可重現,「今天看到的那一版」下次進來就不是同一個世界 ——
 * 而那正是 Math.random 做不到、所以這個檔案才存在的理由。
 */
describe('mulberry32', () => {
  it('同一顆種子給出同一串', () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    for (let i = 0; i < 50; i++) expect(a()).toBe(b());
  });

  it('不同種子給出不同的串', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('值域落在 [0, 1)', () => {
    const rand = mulberry32(99);
    for (let i = 0; i < 2000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('梯度噪聲', () => {
  it('同一個點永遠是同一個值', () => {
    const n = makeNoise2D(7);
    expect(n(1.7, -3.2)).toBe(n(1.7, -3.2));
    expect(makeNoise2D(7)(1.7, -3.2)).toBe(n(1.7, -3.2));
  });

  it('格點上是零 —— 梯度噪聲的定義', () => {
    const n = makeNoise2D(11);
    for (const [x, y] of [
      [0, 0],
      [3, -4],
      [12, 9],
    ] as const) {
      expect(Math.abs(n(x, y))).toBeLessThan(1e-9);
    }
  });

  it('值域大致在 [-1, 1]', () => {
    const n = makeNoise2D(3);
    let lo = 0;
    let hi = 0;
    for (let i = 0; i < 4000; i++) {
      const v = n(i * 0.137, i * 0.071);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    expect(lo).toBeGreaterThan(-1.01);
    expect(hi).toBeLessThan(1.01);
    // 而且真的有在動 —— 全是零也會通過上面那兩條。
    expect(hi - lo).toBeGreaterThan(0.8);
  });

  it('是連續的:相鄰兩點不會跳', () => {
    const n = makeNoise2D(5);
    for (let i = 0; i < 500; i++) {
      const x = i * 0.03;
      expect(Math.abs(n(x + 0.001, 2.2) - n(x, 2.2))).toBeLessThan(0.02);
    }
  });
});

describe('fbm', () => {
  it('疊完仍然收在 [-1, 1]', () => {
    const f = makeFbm2D(21, { octaves: 5 });
    for (let i = 0; i < 2000; i++) {
      const v = f(i * 0.11, i * 0.07);
      expect(Math.abs(v)).toBeLessThanOrEqual(1.0001);
    }
  });

  it('01 版本真的落在 [0, 1]', () => {
    const f = makeFbm01(22);
    for (let i = 0; i < 2000; i++) {
      const v = f(i * 0.13, i * 0.09);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('八度越多細節越多', () => {
    const one = makeFbm2D(31, { octaves: 1 });
    const many = makeFbm2D(31, { octaves: 6 });
    const rough = (f: (x: number, y: number) => number) => {
      let sum = 0;
      for (let i = 1; i < 800; i++) sum += Math.abs(f(i * 0.02, 1.5) - f((i - 1) * 0.02, 1.5));
      return sum;
    };
    expect(rough(many)).toBeGreaterThan(rough(one));
  });
});

describe('數值工具', () => {
  it('clamp / lerp / smoothstep', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(lerp(2, 4, 0.5)).toBe(3);
    expect(smoothstep(0, 1, 0)).toBe(0);
    expect(smoothstep(0, 1, 1)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 6);
    // 兩端的一階導數是零 —— 這才是它跟線性內插的差別。
    expect(smoothstep(0, 1, 0.01)).toBeLessThan(0.01);
  });

  it('damp 與影格率無關', () => {
    // 60Hz 走三十格,跟一格走同樣的時間,必須落在同一個地方。
    let stepped = 0;
    for (let i = 0; i < 30; i++) stepped = damp(stepped, 10, 0.2, 1 / 60);
    expect(stepped).toBeCloseTo(damp(0, 10, 0.2, 0.5), 9);
  });

  it('damp 的半衰期真的是半衰期', () => {
    expect(damp(0, 10, 0.25, 0.25)).toBeCloseTo(5, 9);
  });

  it('半衰期為零就直接到位', () => {
    expect(damp(0, 10, 0, 1 / 60)).toBe(10);
  });
});
