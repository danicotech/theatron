import { beforeEach, describe, expect, it } from 'vitest';

import {
  addLeg,
  clear,
  parlayMultiplierMilli,
  potentialPayout,
  readSlip,
  removeLeg,
  replaceOdds,
  sanitizeStake,
  setStake,
  storageKey,
  type SlipLeg,
} from './betSlipStore';

const LEG_A: SlipLeg = {
  matchPublicId: 'm1',
  marketPublicId: 'mk-1',
  outcome: 'p1',
  label: '李璃',
  oddsMilli: 1430n,
  marketTitle: '整場勝負',
};

const LEG_B: SlipLeg = {
  matchPublicId: 'm2',
  marketPublicId: 'mk-2',
  outcome: 'over',
  label: '超過 90 秒',
  oddsMilli: 2860n,
  marketTitle: '第 1 回合時長',
};

describe('betSlipStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // 一場只能一腿是伺服器規則;這裡先替換,而且原位替換 —— 列表不該在眼前跳。
  it('同一場再加一腿是換掉,不是多一腿,而且位置不變', () => {
    addLeg('s', LEG_A);
    addLeg('s', LEG_B);
    addLeg('s', { ...LEG_A, marketPublicId: 'mk-1s', outcome: 'p1_2_0', label: '2:0' });

    const legs = readSlip('s').legs;
    expect(legs).toHaveLength(2);
    expect(legs[0]?.outcome).toBe('p1_2_0');
    expect(legs[1]?.matchPublicId).toBe('m2');
  });

  // 與伺服器 ParlayMultiplierMilli 同一個捨去順序:1000 → 1430 → 4089(不是 4089.8)。
  it('派彩用 BigInt 逐步捨去:100 × 1.43 × 2.86 = 408', () => {
    expect(parlayMultiplierMilli([LEG_A, LEG_B])).toBe(4089n);
    expect(potentialPayout(100n, [LEG_A, LEG_B])).toBe(408n);
    expect(parlayMultiplierMilli([])).toBe(1000n);
    expect(potentialPayout(0n, [LEG_A])).toBe(0n);
  });

  it('超過 2^53 也不失真', () => {
    const legs = [{ oddsMilli: 12000n }, { oddsMilli: 12000n }];
    expect(potentialPayout(1_000_000_000_000_000n, legs)).toBe(144_000_000_000_000_000n);
  });

  it('本金只留數字、去前導零', () => {
    expect(sanitizeStake('0012a')).toBe('12');
    expect(sanitizeStake('0')).toBe('');
    expect(sanitizeStake('')).toBe('');
    setStake('s', ' 1,000 ');
    expect(readSlip('s').stake).toBe('1000');
  });

  it('寫進 localStorage,重新讀回來還在;清掉就沒了', () => {
    addLeg('s', LEG_A);
    setStake('s', '50');
    const raw = localStorage.getItem(storageKey('s'));
    expect(raw).not.toBeNull();
    // bigint 進不了 JSON,存的是字串。
    expect(raw).toContain('"oddsMilli":"1430"');

    // 模擬另一個分頁或重新整理:直接改 storage,再讀就是新的。
    localStorage.setItem(
      storageKey('s'),
      JSON.stringify({ legs: [{ ...LEG_B, oddsMilli: '2860' }], stake: '7' }),
    );
    const state = readSlip('s');
    expect(state.legs[0]?.oddsMilli).toBe(2860n);
    expect(state.stake).toBe('7');

    clear('s');
    expect(localStorage.getItem(storageKey('s'))).toBeNull();
    expect(readSlip('s').legs).toHaveLength(0);
  });

  it('壞掉的內容當成空的,不會把投注單卡死', () => {
    localStorage.setItem(storageKey('s'), '{not json');
    expect(readSlip('s').legs).toHaveLength(0);
    localStorage.setItem(storageKey('s'), JSON.stringify({ legs: [{ matchPublicId: 1 }] }));
    expect(readSlip('s').legs).toHaveLength(0);
  });

  it('賠率變動只換數字,腿不動;移除靠場次', () => {
    addLeg('s', LEG_A);
    addLeg('s', LEG_B);
    replaceOdds('s', [{ marketPublicId: 'mk-1', outcome: 'p1', label: '李璃', oddsMilli: 1520n }]);
    expect(readSlip('s').legs.map((l) => l.oddsMilli)).toEqual([1520n, 2860n]);

    removeLeg('s', 'm1');
    expect(readSlip('s').legs.map((l) => l.matchPublicId)).toEqual(['m2']);
  });
});
