import { Box3, BufferGeometry, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import {
  at,
  flaredRoof,
  flaredRoofHeight,
  lean,
  mergeGeos,
  offsetUv,
  scaleUv,
  sweepProfile,
  type FlaredRoofOptions,
} from './geometry';

const SECTION = [
  [-0.3, -0.2],
  [0.3, -0.2],
  [0.34, 0.04],
  [0.24, 0.24],
  [-0.24, 0.24],
  [-0.34, 0.04],
] as const;

function bounds(geo: BufferGeometry): Box3 {
  geo.computeBoundingBox();
  return geo.boundingBox!;
}

/** 一份幾何裡所有三角形的重心。破洞是不是真的空的,只有逐面問才知道。 */
function faceCentres(geo: BufferGeometry): Vector3[] {
  const pos = geo.getAttribute('position');
  const idx = geo.index!;
  const out: Vector3[] = [];
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (let f = 0; f < idx.count / 3; f++) {
    a.fromBufferAttribute(pos, idx.getX(f * 3));
    b.fromBufferAttribute(pos, idx.getX(f * 3 + 1));
    c.fromBufferAttribute(pos, idx.getX(f * 3 + 2));
    out.push(new Vector3().add(a).add(b).add(c).divideScalar(3));
  }
  return out;
}

/**
 * 某一段高度區間裡所有頂點的平均 x。
 *
 * 「歪掉」這件事量不出來的話,它就只是「看起來有點怪」。包圍盒量不到 ——
 * 一根往一邊倒的柱子,包圍盒只會變寬。要量的是**柱頂的中心跑了多遠**。
 */
function sliceCentreX(geo: BufferGeometry, from: number, to: number): number {
  const pos = geo.getAttribute('position');
  const box = bounds(geo);
  const lo = box.min.y + (box.max.y - box.min.y) * from;
  const hi = box.min.y + (box.max.y - box.min.y) * to;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < lo || y > hi) continue;
    sum += pos.getX(i);
    n++;
  }
  return n === 0 ? 0 : sum / n;
}

describe('sweepProfile', () => {
  it('頂點數 = 路徑點 × 剖面點 + 兩個蓋心', () => {
    const path = [new Vector3(-2, 0, 0), new Vector3(0, 0.4, 0), new Vector3(2, 0, 0)];
    const geo = sweepProfile(path, SECTION);
    expect(geo.getAttribute('position').count).toBe(3 * SECTION.length + 2);
  });

  it('掃出來的東西包住整條路徑', () => {
    const path = [new Vector3(-3, 0, 0), new Vector3(0, 0.8, 0), new Vector3(3, 0, 0)];
    const box = bounds(sweepProfile(path, SECTION));
    expect(box.min.x).toBeLessThanOrEqual(-3);
    expect(box.max.x).toBeGreaterThanOrEqual(3);
    expect(box.max.y).toBeGreaterThan(0.8);
  });

  it('路徑少於兩點就丟例外,不是默默給一個空的幾何', () => {
    expect(() => sweepProfile([new Vector3()], SECTION)).toThrow();
  });
});

describe('flaredRoof', () => {
  const OPTIONS: FlaredRoofOptions = {
    halfWidth: 12,
    halfDepth: 15.3,
    ridgeHalf: 4.3,
    rise: 4.4,
    thickness: 0.4,
    flare: 0.6,
    segX: 40,
    segZ: 34,
  };

  it('簷角比簷中高 —— 這是飛簷與碟子的差別', () => {
    const { halfWidth: A, halfDepth: B } = OPTIONS;
    const corner = flaredRoofHeight(OPTIONS, A, B);
    const midEaveX = flaredRoofHeight(OPTIONS, 0, B);
    const midEaveZ = flaredRoofHeight(OPTIONS, A, 0);
    expect(corner).toBeGreaterThan(midEaveX);
    expect(corner).toBeGreaterThan(midEaveZ);
    // 而且差得夠多。差個幾公分的話,那條輪廓在三十公尺外完全看不出來。
    expect(corner - midEaveX).toBeGreaterThan(0.5);
  });

  it('屋脊是最高的地方,而且脊上那一段是平的', () => {
    const ridge = flaredRoofHeight(OPTIONS, 0, 0);
    expect(ridge).toBeCloseTo(OPTIONS.rise, 5);
    // ridgeHalf 之內沿 x 走高度不變 —— 脊是一條線,不是一個點。
    expect(flaredRoofHeight(OPTIONS, OPTIONS.ridgeHalf * 0.9, 0)).toBeCloseTo(ridge, 5);
    expect(flaredRoofHeight(OPTIONS, OPTIONS.halfWidth, 0)).toBeLessThan(ridge);
  });

  it('屋面是下垂的,不是斜的平面', () => {
    // 從脊到簷,半途的高度必須**低於**脊與簷的連線 —— 那條凹下去的曲線就是
    // 「下垂」。高於連線是鼓起來的屋頂,那是帳篷。
    const B = OPTIONS.halfDepth;
    const mid = flaredRoofHeight(OPTIONS, 0, B * 0.5);
    const straight = (flaredRoofHeight(OPTIONS, 0, 0) + flaredRoofHeight(OPTIONS, 0, B)) / 2;
    expect(mid).toBeLessThan(straight);
    // 但也不能垂到貼著簷口:那樣就是一塊平板加一圈翹邊。
    expect(mid).toBeGreaterThan(flaredRoofHeight(OPTIONS, 0, B));
  });

  it('破洞是真的空的,而且洞緣有斷面', () => {
    const withHole: FlaredRoofOptions = {
      ...OPTIONS,
      hole: { x: 1.6, z: -12.7, rx: 3.5, rz: 2.9, ragged: 0.26, seed: 13 },
    };
    const solid = flaredRoof(OPTIONS);
    const holed = flaredRoof(withHole);

    // 洞心附近的橢圓內側不該有任何三角形。半徑取六成,避開鋸齒的那一圈。
    const inside = faceCentres(holed).filter((p) => {
      const dx = (p.x - 1.6) / (3.5 * 0.6);
      const dz = (p.z + 12.7) / (2.9 * 0.6);
      return Math.hypot(dx, dz) < 1;
    });
    expect(inside).toHaveLength(0);

    // 沒有洞的版本在同一塊區域必須是有面的 —— 否則上面那一條是永遠成立的廢話。
    const solidInside = faceCentres(solid).filter((p) => {
      const dx = (p.x - 1.6) / (3.5 * 0.6);
      const dz = (p.z + 12.7) / (2.9 * 0.6);
      return Math.hypot(dx, dz) < 1;
    });
    expect(solidInside.length).toBeGreaterThan(10);

    // 洞緣的斷面讓頂點數變多,即使三角形變少。
    expect(holed.getAttribute('position').count).toBeGreaterThan(
      solid.getAttribute('position').count,
    );
  });

  it('開了洞,外圍的尺寸完全不變', () => {
    const solid = bounds(flaredRoof(OPTIONS));
    const holed = bounds(flaredRoof({ ...OPTIONS, hole: { x: 1.6, z: -12.7, rx: 3.5, rz: 2.9 } }));
    expect(holed.min.x).toBeCloseTo(solid.min.x, 6);
    expect(holed.max.x).toBeCloseTo(solid.max.x, 6);
    expect(holed.min.z).toBeCloseTo(solid.min.z, 6);
    expect(holed.max.z).toBeCloseTo(solid.max.z, 6);
  });
});

describe('lean', () => {
  it('繞地面那一點傾斜:腳留在原地,頂偏出去', () => {
    const geo = at(
      sweepProfile([new Vector3(0, 0, 0), new Vector3(0, 4, 0), new Vector3(0, 8, 0)], SECTION),
      0,
      0,
      0,
    );
    const beforeTop = sliceCentreX(geo, 0.85, 1);
    const beforeFoot = sliceCentreX(geo, 0, 0.15);
    lean(geo, 0.12, 0, 0);
    const afterTop = sliceCentreX(geo, 0.85, 1);
    const afterFoot = sliceCentreX(geo, 0, 0.15);

    // 柱腳幾乎不動 —— 樞紐在地面。
    expect(Math.abs(afterFoot - beforeFoot)).toBeLessThan(0.15);
    // 柱頂明顯偏出去。八公尺 × sin(0.12) ≈ 0.96 公尺。
    expect(Math.abs(afterTop - beforeTop)).toBeGreaterThan(0.7);
  });
});

describe('uv 工具', () => {
  it('scaleUv 乘上去、offsetUv 加上去', () => {
    const geo = sweepProfile([new Vector3(0, 0, 0), new Vector3(1, 0, 0)], SECTION);
    const uv = geo.getAttribute('uv');
    const u0 = uv.getX(1);
    scaleUv(geo, 0.5, 1);
    expect(uv.getX(1)).toBeCloseTo(u0 * 0.5, 6);
    offsetUv(geo, 0.5, 0);
    expect(uv.getX(1)).toBeCloseTo(u0 * 0.5 + 0.5, 6);
  });
});

describe('mergeGeos', () => {
  it('合併之後的頂點數是各部分的總和', () => {
    const a = sweepProfile([new Vector3(0, 0, 0), new Vector3(1, 0, 0)], SECTION);
    const b = sweepProfile([new Vector3(0, 1, 0), new Vector3(1, 1, 0)], SECTION);
    const total = a.getAttribute('position').count + b.getAttribute('position').count;
    expect(mergeGeos([a, b]).getAttribute('position').count).toBe(total);
  });

  it('沒有東西可以合併就丟例外', () => {
    expect(() => mergeGeos([])).toThrow();
  });
});
