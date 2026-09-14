import { describe, expect, it } from 'vitest';

import {
  prologueState,
  prologueUniforms,
  stageAt,
  STAGE_BOUNDS,
  type PrologueStageId,
} from './stages';

/** 從 0 掃到 1 的取樣點。步長刻意不整除邊界,免得剛好每次都踩在邊界上。 */
function sweep(step = 0.007): number[] {
  const out: number[] = [];
  for (let p = 0; p <= 1 + 1e-9; p += step) out.push(Math.min(1, Number(p.toFixed(6))));
  return out;
}

describe('序幕的四段', () => {
  it('邊界就是規格給的那四段', () => {
    expect(STAGE_BOUNDS.map((b) => [b.id, b.from, b.to])).toEqual([
      ['duel', 0, 0.25],
      ['tear', 0.25, 0.45],
      ['bleed', 0.45, 0.75],
      ['fall', 0.75, 1],
    ]);
  });

  it('每一段的起點屬於那一段,終點屬於下一段', () => {
    const expected: Array<[number, PrologueStageId]> = [
      [0, 'duel'],
      [0.24, 'duel'],
      [0.25, 'tear'],
      [0.44, 'tear'],
      [0.45, 'bleed'],
      [0.74, 'bleed'],
      [0.75, 'fall'],
      [1, 'fall'],
    ];
    for (const [p, id] of expected) expect(prologueState(p).stage).toBe(id);
  });

  it('段內進度在每一段的兩端都是 0 與 1', () => {
    for (const bound of STAGE_BOUNDS) {
      expect(prologueState(bound.from).stageProgress).toBeCloseTo(0, 6);
      // 終點屬於下一段,所以往回退一點點取樣。
      expect(prologueState(bound.to - 1e-6).stageProgress).toBeCloseTo(1, 3);
    }
  });

  it('超出範圍的進度被夾住,不會長出第五段', () => {
    expect(prologueState(-3).stage).toBe('duel');
    expect(prologueState(9).stage).toBe('fall');
    expect(stageAt(-3)).toBe(0);
    expect(stageAt(9)).toBe(STAGE_BOUNDS.length - 1);
  });
});

describe('序幕是進度的純函式', () => {
  // 這是整段戲能正反刮的唯一理由:沒有播放頭,只有一個數字。
  it('正著掃跟倒著掃,每一點都得到同一個狀態', () => {
    const forward = sweep().map((p) => prologueState(p));
    const backward = sweep()
      .slice()
      .reverse()
      .map((p) => prologueState(p))
      .reverse();
    expect(backward).toEqual(forward);
  });

  it('同一個進度算幾次都一樣 —— 沒有任何一格記得上一格', () => {
    const once = prologueState(0.37);
    // 中間刻意跑過整段,如果有任何狀態被藏在模組裡,這一行會把它推到別的地方。
    sweep(0.013).forEach((p) => prologueState(p));
    expect(prologueState(0.37)).toEqual(once);
  });

  it('布被劃破就不會自己癒合:裂口與血墨單調不減', () => {
    let tear = -1;
    let bleed = -1;
    for (const p of sweep()) {
      const s = prologueState(p);
      expect(s.tear).toBeGreaterThanOrEqual(tear);
      expect(s.bleed).toBeGreaterThanOrEqual(bleed);
      tear = s.tear;
      bleed = s.bleed;
    }
  });

  it('刺穿之前沒有裂口,血墨在裂口拖完之前不滲', () => {
    expect(prologueState(0.24).tear).toBe(0);
    expect(prologueState(0.44).bleed).toBe(0);
    expect(prologueState(0.45).tear).toBe(1);
  });

  it('紅不消失,它收進下一章的印 —— 所以最後一格 seal 是滿的', () => {
    const end = prologueState(1);
    expect(end.bleed).toBe(1);
    expect(end.seal).toBe(1);
    expect(end.blossom).toBe(1);
    expect(end.fall).toBe(1);
  });

  it('身影在布被劃破之後就不在了', () => {
    expect(prologueState(0.1).duel).toBeGreaterThan(0.9);
    expect(prologueState(0.7).duel).toBe(0);
  });

  // 震顫是進度的凸起,不是時間的衰減:倒著刮要再顫一次,而且顫得一樣。
  it('刺穿那一下的震顫在兩端是零、中間是一', () => {
    expect(prologueState(0.25).shudder).toBeCloseTo(0, 6);
    expect(prologueState(0.36).shudder).toBeCloseTo(0, 6);
    expect(prologueState(0.305).shudder).toBeGreaterThan(0.99);
  });
});

describe('shader 的 uniform', () => {
  it('跟 DOM 那層讀的是同一份狀態', () => {
    const s = prologueState(0.62);
    const u = prologueUniforms(0.62);
    expect(u).toEqual({
      uTear: s.tear,
      uBleed: s.bleed,
      uFall: s.fall,
      uDuel: s.duel,
      uMoon: s.moonThrough,
      uShudder: s.shudder,
      uBillow: s.billow,
    });
  });

  it('裂口與血墨的 uniform 掃過全程都不回頭', () => {
    let tear = -1;
    let bleed = -1;
    for (const p of sweep()) {
      const u = prologueUniforms(p);
      expect(u.uTear).toBeGreaterThanOrEqual(tear);
      expect(u.uBleed).toBeGreaterThanOrEqual(bleed);
      tear = u.uTear;
      bleed = u.uBleed;
    }
    expect(tear).toBe(1);
    expect(bleed).toBe(1);
  });

  // 月光是從裂口進來的,所以它不可能在布還完整的時候就有值。
  it('月光是裂口的函式,不是另一條獨立曲線', () => {
    expect(prologueUniforms(0.2).uMoon).toBe(0);
    expect(prologueUniforms(0.5).uMoon).toBeGreaterThan(0);
  });
});
