import { describe, expect, it } from 'vitest';

import {
  actOneProgress,
  applyMatrix,
  PANELS,
  panelAt,
  panelIndexAt,
  panelMatrix,
  panelOf,
} from './panels';
import { STAGE_BOUNDS } from './stages';

/** 幕內進度的取樣點。步長刻意不整除邊界,免得每次都剛好踩在格的起點上。 */
function sweep(step = 0.003): number[] {
  const out: number[] = [];
  for (let p = 0; p <= 1 + 1e-9; p += step) out.push(Math.min(1, Number(p.toFixed(6))));
  return out;
}

/** 畫布尺寸隨便給,但要非方形 —— 方形會讓 x/y 寫反的錯誤剛好對消。 */
const W = 1792;
const H = 1176;

describe('第一幕的五個分鏡格', () => {
  it('五格就是分鏡表那五格,數字一個不差', () => {
    expect(PANELS.map((p) => [p.id, p.from, p.leftDx, p.rightDx, p.camY, p.camWidth])).toEqual([
      ['standoff', 0, -0.055, 0.055, 0.5, 1],
      ['clash', 0.35, 0, 0, 0.5, 1],
      ['press', 0.47, 0.005, -0.005, 0.34, 0.62],
      ['edge', 0.59, 0.015, -0.015, 0.2, 0.3],
      ['recoil', 0.7, -0.07, 0.07, 0.52, 1.04],
    ]);
  });

  it('每一格的起點屬於那一格,再往回一點就是上一格', () => {
    PANELS.forEach((panel, i) => {
      expect(panelIndexAt(panel.from)).toBe(i);
      if (i > 0) expect(panelIndexAt(panel.from - 1e-6)).toBe(i - 1);
    });
  });

  it('最後一格撐到幕尾 —— 分鏡表的 0.85 之後不會長出第六格', () => {
    expect(panelIndexAt(0.85)).toBe(PANELS.length - 1);
    expect(panelIndexAt(1)).toBe(PANELS.length - 1);
    expect(panelIndexAt(9)).toBe(PANELS.length - 1);
    expect(panelIndexAt(-3)).toBe(0);
  });

  // 這是「快滑、反滑都不會跳」的全部理由:沒有播放頭,只有一個數字。
  it('正著掃跟倒著掃,每一點都落在同一格', () => {
    const forward = sweep().map((p) => panelIndexAt(p));
    const backward = sweep()
      .slice()
      .reverse()
      .map((p) => panelIndexAt(p))
      .reverse();
    expect(backward).toEqual(forward);
  });

  it('格號單調不減:往前刮不會倒回上一格', () => {
    let last = -1;
    for (const p of sweep()) {
      const i = panelIndexAt(p);
      expect(i).toBeGreaterThanOrEqual(last);
      last = i;
    }
    expect(last).toBe(PANELS.length - 1);
  });

  // 分鏡的讀法全在位移的方向上:對峙是分開的,交鋒是合上的,後撤退得更開。
  it('對峙分開、交鋒歸零、後撤退得比對峙更開', () => {
    const [standoff, clash, , , recoil] = PANELS;
    expect(standoff!.leftDx).toBeLessThan(0);
    expect(standoff!.rightDx).toBeGreaterThan(0);
    expect(clash!.leftDx).toBe(0);
    expect(clash!.rightDx).toBe(0);
    expect(recoil!.leftDx).toBeLessThan(standoff!.leftDx);
    expect(recoil!.rightDx).toBeGreaterThan(standoff!.rightDx);
  });

  it('推近與極近是靠裁切,不是把人畫大', () => {
    const [, , press, edge] = PANELS;
    expect(press!.camWidth).toBeLessThan(1);
    expect(edge!.camWidth).toBeLessThan(press!.camWidth);
    // 極近那一格放大三倍多 —— 離屏 canvas 的解析度就是照這個倍率選的。
    expect(1 / edge!.camWidth).toBeGreaterThan(3);
  });
});

describe('幕內進度', () => {
  it('第一幕就是 stages 的第一段,邊界不另外寫一份', () => {
    const end = STAGE_BOUNDS[0]!.to;
    expect(actOneProgress(0)).toBe(0);
    expect(actOneProgress(end / 2)).toBeCloseTo(0.5, 6);
    expect(actOneProgress(end)).toBe(1);
  });

  it('第一幕結束之後一律停在幕尾那一格', () => {
    const end = STAGE_BOUNDS[0]!.to;
    expect(panelAt(end)).toBe(PANELS.length - 1);
    // 布被劃破時身影還在淡出,這段期間分鏡不該再動。
    expect(panelAt(0.5)).toBe(PANELS.length - 1);
    expect(panelAt(1)).toBe(PANELS.length - 1);
  });

  it('分鏡表的五段各自對得上一格', () => {
    const end = STAGE_BOUNDS[0]!.to;
    const expected: Array<[number, string]> = [
      [0.15, 'standoff'],
      [0.4, 'clash'],
      [0.52, 'press'],
      [0.64, 'edge'],
      [0.78, 'recoil'],
    ];
    for (const [inAct, id] of expected) expect(panelOf(inAct * end).id).toBe(id);
  });
});

describe('取景框的矩陣', () => {
  // y 方向寫反的症狀是極近那一格的取景整個掉到畫面外,只剩一塊空布 ——
  // 看起來像剪影沒載進來,不像座標錯了。所以這一條是這個檔案最重要的斷言。
  it('(0.5, camY) 這一點永遠落在畫布正中央', () => {
    for (const panel of PANELS) {
      const m = panelMatrix(panel, W, H);
      const [x, y] = applyMatrix(m, 0.5 * W, panel.camY * H);
      expect(x).toBeCloseTo(W / 2, 6);
      expect(y).toBeCloseTo(H / 2, 6);
    }
  });

  it('取景框的四角正好是畫布的四角', () => {
    for (const panel of PANELS) {
      const m = panelMatrix(panel, W, H);
      const half = panel.camWidth / 2;
      const [x0, y0] = applyMatrix(m, (0.5 - half) * W, (panel.camY - half) * H);
      const [x1, y1] = applyMatrix(m, (0.5 + half) * W, (panel.camY + half) * H);
      expect(x0).toBeCloseTo(0, 6);
      expect(y0).toBeCloseTo(0, 6);
      expect(x1).toBeCloseTo(W, 6);
      expect(y1).toBeCloseTo(H, 6);
    }
  });

  it('極近那一格取的還是素材裡面那一塊,沒有掉到畫面外', () => {
    const edge = PANELS[3]!;
    const half = edge.camWidth / 2;
    expect(edge.camY - half).toBeGreaterThan(0);
    expect(edge.camY + half).toBeLessThan(1);
  });

  it('放大倍率就是取景寬的倒數,而且沒有旋轉、沒有鏡射', () => {
    for (const panel of PANELS) {
      const [a, b, c, d] = panelMatrix(panel, W, H);
      expect(a).toBeCloseTo(1 / panel.camWidth, 9);
      expect(d).toBeCloseTo(1 / panel.camWidth, 9);
      expect(b).toBe(0);
      expect(c).toBe(0);
    }
  });
});
