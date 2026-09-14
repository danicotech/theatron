import { describe, expect, it } from 'vitest';

import { ACTS, anchorOffsets, frameAt, COMIC_FRAMES, HOLD_MOBILE } from './acts';
import { stateAt, type ActLayout } from './useActProgress';

const VH = 900;

/** 一幕:高 4 個視窗,一個定格點在 0.5,平台佔 1 個視窗。 */
const ONE: ActLayout[] = [
  { id: 'i', top: 0, height: VH * 4, stops: [{ id: 'prologue', at: 0.5, hold: VH }] },
];

/** 兩個定格點,用來驗平台之間的區段。 */
const TWO: ActLayout[] = [
  {
    id: 'iii',
    top: 0,
    height: VH * 5,
    stops: [
      { id: 'format', at: 0.25, hold: VH * 0.5 },
      { id: 'prize', at: 0.75, hold: VH * 0.5 },
    ],
  },
];

describe('stateAt', () => {
  it('幕還沒到,進度是 0', () => {
    expect(stateAt(0, VH, ONE).progress.i).toBe(0);
  });

  it('走完整幕,進度是 1', () => {
    expect(stateAt(VH * 99, VH, ONE).progress.i).toBe(1);
  });

  // 定格是平台:那一段捲動距離裡進度不動。這是整個機制的核心,
  // 壞掉的話卡片會在讀到一半時被推走。
  it('在平台上進度鎖住不動', () => {
    // 可捲距離 3vh,平台 1vh,所以推進段共 2vh;定格在 0.5 → 第一段 1vh。
    const a = stateAt(VH * 1.0 + 1, VH, ONE);
    const b = stateAt(VH * 1.9, VH, ONE);
    expect(a.progress.i).toBeCloseTo(0.5, 3);
    expect(b.progress.i).toBeCloseTo(0.5, 3);
    expect(a.held).toBe('prologue');
    expect(b.held).toBe('prologue');
  });

  it('平台走了多少會回報,卡片靠它浮上', () => {
    const start = stateAt(VH * 1.0 + 1, VH, ONE);
    const mid = stateAt(VH * 1.5, VH, ONE);
    expect(start.holdT).toBeLessThan(0.05);
    expect(mid.holdT).toBeCloseTo(0.5, 1);
  });

  it('離開平台之後進度繼續往前,而且不會倒退', () => {
    const held = stateAt(VH * 1.9, VH, ONE).progress.i;
    const after = stateAt(VH * 2.4, VH, ONE).progress.i;
    expect(after).toBeGreaterThan(held);
    expect(stateAt(VH * 3, VH, ONE).progress.i).toBeCloseTo(1, 2);
  });

  // 純函式最重要的性質:同一個捲動位置永遠得到同一個畫面。
  // 「往回捲保留進度」不是功能,是這件事的結果。
  it('反向捲動得到與正向完全相同的值', () => {
    const ys = [0, VH * 0.4, VH * 1.2, VH * 1.8, VH * 2.6, VH * 3];
    const forward = ys.map((y) => stateAt(y, VH, ONE));
    const backward = [...ys]
      .reverse()
      .map((y) => stateAt(y, VH, ONE))
      .reverse();
    expect(backward).toEqual(forward);
  });

  it('進度單調不減 —— 捲得越深,進度只會往前', () => {
    let prev = -1;
    for (let y = 0; y <= VH * 4; y += VH / 24) {
      const p = stateAt(y, VH, ONE).progress.i;
      expect(p).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = p;
    }
  });

  it('多個定格點各自有自己的平台,不會互相吃掉', () => {
    const seen = new Set<string>();
    for (let y = 0; y <= VH * 5; y += VH / 40) {
      const s = stateAt(y, VH, TWO);
      if (s.held !== null) seen.add(s.held);
    }
    expect([...seen].sort()).toEqual(['format', 'prize']);
  });

  it('兩個定格點之間進度是連續的,不會跳過中段', () => {
    const between: number[] = [];
    for (let y = 0; y <= VH * 5; y += VH / 60) {
      const s = stateAt(y, VH, TWO);
      if (s.held === null) between.push(s.progress.iii);
    }
    const mid = between.filter((p) => p > 0.3 && p < 0.7);
    expect(mid.length).toBeGreaterThan(3);
  });

  it('沒有幕的時候不炸,回傳全 0', () => {
    const s = stateAt(1234, VH, []);
    expect(s.progress).toEqual({ i: 0, ii: 0, iii: 0 });
    expect(s.held).toBeNull();
  });

  // 視窗比 section 還高時 travel 會是負的。手機橫放、或內容還沒載完時會發生。
  it('section 比視窗矮也不會除以零', () => {
    const tiny: ActLayout[] = [{ id: 'i', top: 0, height: 10, stops: [] }];
    expect(() => stateAt(500, VH, tiny)).not.toThrow();
    expect(stateAt(500, VH, tiny).progress.i).toBeLessThanOrEqual(1);
  });
});

describe('frameAt', () => {
  it('進度落在哪一格是純函式,不插值', () => {
    expect(frameAt(0).index).toBe(0);
    expect(frameAt(0.2).index).toBe(0);
    expect(frameAt(0.35).index).toBe(1);
    expect(frameAt(0.5).index).toBe(2);
    expect(frameAt(0.6).index).toBe(3);
    expect(frameAt(0.9).index).toBe(4);
  });

  // 格與格之間不插值,所以同一格內任何進度都得到完全相同的取景 ——
  // 這正是快滑反滑不會跳的原因。
  it('同一格內的取景完全相同', () => {
    expect(frameAt(0.36)).toBe(frameAt(0.46));
    expect(frameAt(0.6)).toBe(frameAt(0.69));
  });

  it('格的邊界不重疊也不留縫', () => {
    for (let i = 1; i < COMIC_FRAMES.length; i++) {
      expect(COMIC_FRAMES[i]!.from).toBeGreaterThan(COMIC_FRAMES[i - 1]!.from);
    }
    expect(COMIC_FRAMES[0]!.from).toBe(0);
  });
});

/**
 * 錨點與進度是兩條公式在算同一件事。
 *
 * 它們一旦漂開,`#stop-signup` 就會跳到別的地方,而點連結的人不會知道
 * 自己看到的是不是對的 —— 沒有任何東西會報錯。這是這一組測試存在的主要理由。
 * (實際發生過:錨點用整個幕高、進度用「幕高減一個視窗」,差一個視窗,
 * 誤差累積到最後一個定格點就跳錯。)
 */
describe('anchorOffsets 與 stateAt 是同一條曲線', () => {
  const VIEW = 900;

  function layoutOf(actIndex: number, hold: number) {
    const act = ACTS[actIndex]!;
    return [
      {
        id: act.id,
        top: 0,
        height: (act.span / 100) * VIEW,
        stops: act.stops.map((s) => ({ id: s.id, at: s.at, hold: (hold / 100) * VIEW })),
      },
    ];
  }

  for (const [i, act] of ACTS.entries()) {
    for (const hold of [80, HOLD_MOBILE]) {
      it(`第 ${i + 1} 幕、平台 ${hold}vh:每個錨點都落在自己的平台上`, () => {
        const layout = layoutOf(i, hold);
        for (const o of anchorOffsets(act)) {
          // 錨點的位置:推進段 + 前面幾個平台。與 CSS 的 calc() 是同一個算式。
          const y = ((o.baseVh + o.holdFactor * hold) / 100) * VIEW;
          // 錨點已經指向平台的四分之一處,所以直接量就該中。
          const s = stateAt(y, VIEW, layout);
          expect(s.held).toBe(o.id);
        }
      });
    }
  }

  it('錨點依序往下,不會有兩個疊在一起', () => {
    for (const act of ACTS) {
      const ys = anchorOffsets(act).map((o) => o.baseVh + o.holdFactor * 80);
      for (let i = 1; i < ys.length; i++) {
        expect(ys[i]!).toBeGreaterThan(ys[i - 1]!);
      }
    }
  });

  it('最後一個錨點仍然在幕的可捲範圍裡', () => {
    for (const act of ACTS) {
      const offsets = anchorOffsets(act);
      const last = offsets[offsets.length - 1];
      if (last === undefined) continue;
      const holdTotal = act.stops.reduce((n, s) => n + s.hold, 0);
      expect(last.baseVh + last.holdFactor * 80 + 80).toBeLessThanOrEqual(act.span - 100 + 1);
      expect(holdTotal).toBeLessThan(act.span - 100);
    }
  });
});
