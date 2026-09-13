import { describe, expect, it } from 'vitest';

import { degrade, detectQuality, DPR_CAP } from './quality';

describe('畫質分級', () => {
  it('沒有滑鼠就是低階,不管核心數多少', () => {
    // 不做 UA 嗅探 —— 那份清單永遠會過期。有沒有滑鼠幾乎就等於是不是手機。
    expect(detectQuality({ coarsePointer: true, hardwareConcurrency: 16 }).tier).toBe('low');
  });

  it('核心少也是低階', () => {
    expect(detectQuality({ hardwareConcurrency: 4 }).tier).toBe('low');
    expect(detectQuality({ hardwareConcurrency: 8 }).tier).toBe('high');
  });

  it('探測不到的時候往保守的那一邊倒', () => {
    expect(detectQuality().tier).toBe('low');
  });

  it('DPR 上限永遠不超過 1.5 —— 規格明訂的數字', () => {
    expect(DPR_CAP).toBe(1.5);
    for (const probe of [{ hardwareConcurrency: 32 }, { coarsePointer: true }]) {
      expect(detectQuality(probe).dprCap).toBeLessThanOrEqual(DPR_CAP);
    }
  });

  it('每一個會吃效能的數字在低階都比較小', () => {
    const high = detectQuality({ hardwareConcurrency: 16 });
    const low = detectQuality({ coarsePointer: true });
    const keys = [
      'bambooCount',
      'weedDensity',
      'weedMax',
      'leafCount',
      'dustCount',
      'emberCount',
      'bloomLevels',
    ] as const;
    for (const key of keys) {
      expect(low[key], key).toBeLessThan(high[key]);
    }
    expect(low.samples).toBeLessThanOrEqual(high.samples);
    expect(low.shadows).toBe(false);
    expect(high.shadows).toBe(true);
  });

  it('進一步降級是一階一階往下,而且有底', () => {
    let ratio = DPR_CAP;
    for (let i = 0; i < 10; i++) ratio = degrade(ratio);
    expect(ratio).toBe(0.7);
    expect(degrade(1.5)).toBeLessThan(1.5);
  });
});
