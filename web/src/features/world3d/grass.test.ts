import { Mesh, PlaneGeometry, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import {
  buildSurfaceSampler,
  instancePosition,
  makeBladeGeometry,
  samplePoint,
  scatter,
  seededLcg,
} from './grass';
import { createWindUniforms } from './wind';
import { makeWindMaterial } from './grass';

/** 一塊平躺在原點、邊長 10 的地。 */
function flatGround(size = 10, seg = 4): Mesh {
  const geo = new PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geo);
  mesh.updateMatrixWorld(true);
  return mesh;
}

describe('葉片幾何', () => {
  it('單位高、往梢部收尖', () => {
    const geo = makeBladeGeometry(4);
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    expect(box.min.y).toBeCloseTo(0, 6);
    expect(box.max.y).toBeCloseTo(1, 6);
    // 底寬 1(instanceMatrix 才把它縮成真的草)。
    expect(box.max.x - box.min.x).toBeCloseTo(1, 6);
  });

  it('三角形數是 2·segments − 1,永遠是奇數', () => {
    for (const seg of [3, 4, 5, 6]) {
      const geo = makeBladeGeometry(seg);
      expect(geo.index!.count / 3).toBe(2 * seg - 1);
    }
  });

  it('梢部是一個點,不是一條邊', () => {
    const geo = makeBladeGeometry(4);
    const pos = geo.getAttribute('position');
    let atTip = 0;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.999) atTip++;
    expect(atTip).toBe(1);
  });
});

describe('面積加權取樣', () => {
  it('總面積等於那塊地的面積', () => {
    const s = buildSurfaceSampler(flatGround(10, 4));
    expect(s.totalArea).toBeCloseTo(100, 4);
  });

  it('取到的點都落在面上', () => {
    const s = buildSurfaceSampler(flatGround(10, 4));
    const rng = seededLcg(7);
    const p = new Vector3();
    for (let i = 0; i < 400; i++) {
      samplePoint(s, rng, p);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(5.001);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(5.001);
      expect(Math.abs(p.y)).toBeLessThan(1e-6);
    }
  });

  it('大的三角形抽得比較常 —— 這就是「面積加權」的意思', () => {
    // 一塊地由一大一小兩片組成:大的那一片佔九成面積,就該佔九成的取樣。
    const big = new PlaneGeometry(12, 12);
    big.rotateX(-Math.PI / 2);
    big.translate(-20, 0, 0);
    const small = new PlaneGeometry(4, 4);
    small.rotateX(-Math.PI / 2);
    small.translate(20, 0, 0);
    const combined = new Mesh(big);
    combined.updateMatrixWorld(true);
    const a = buildSurfaceSampler(combined);
    const smallMesh = new Mesh(small);
    smallMesh.updateMatrixWorld(true);
    const b = buildSurfaceSampler(smallMesh);
    // 面積比 144 : 16 = 9 : 1。
    expect(a.totalArea / b.totalArea).toBeCloseTo(9, 3);
  });

  it('同一顆種子永遠灑出同一片', () => {
    const s = buildSurfaceSampler(flatGround());
    const first = new Vector3();
    const second = new Vector3();
    samplePoint(s, seededLcg(42), first);
    samplePoint(s, seededLcg(42), second);
    expect(first.distanceTo(second)).toBe(0);
  });
});

describe('scatter', () => {
  const wind = createWindUniforms();
  const material = () =>
    makeWindMaterial({ wind, sway: 0.1, bottom: 0x223322, top: 0x998877, cacheKey: 'test' });

  it('數量 = 密度 × 面積,但不超過上限', () => {
    const ground = flatGround(10, 4);
    const geo = makeBladeGeometry(3);
    expect(
      scatter(ground, {
        geometry: geo,
        material: material(),
        density: 2,
        maxCount: 10000,
        width: [0.05, 0.1],
        height: [0.2, 0.5],
        tiltMax: 0.1,
        seed: 1,
      }).count,
    ).toBe(200);

    expect(
      scatter(ground, {
        geometry: geo,
        material: material(),
        density: 2,
        maxCount: 50,
        width: [0.05, 0.1],
        height: [0.2, 0.5],
        tiltMax: 0.1,
        seed: 1,
      }).count,
    ).toBe(50);
  });

  it('reject 擋住的區域一株都不長', () => {
    // 擋掉整個 +x 半邊。被擋掉的實例會縮成零並丟到地底下,不會偷偷長在那裡。
    const mesh = scatter(flatGround(10, 4), {
      geometry: makeBladeGeometry(3),
      material: material(),
      density: 4,
      maxCount: 2000,
      width: [0.05, 0.1],
      height: [0.2, 0.5],
      tiltMax: 0.1,
      seed: 9,
      reject: (x) => x > 0,
    });
    const p = new Vector3();
    let onSurface = 0;
    for (let i = 0; i < mesh.count; i++) {
      instancePosition(mesh, i, p);
      if (p.y < -100) continue;
      onSurface++;
      expect(p.x).toBeLessThanOrEqual(0.001);
    }
    // 而且大部分還是種下去了 —— 全部被拒絕表示重抽根本沒有作用。
    expect(onSurface).toBeGreaterThan(mesh.count * 0.9);
  });

  it('實例化的植被不投影', () => {
    // vertex shader 位移過的東西沒有 customDepthMaterial 就會投出靜止的影子,
    // 而「東西在搖、影子不動」比沒有影子更糟。見 grass.ts 的檔頭。
    const mesh = scatter(flatGround(), {
      geometry: makeBladeGeometry(3),
      material: material(),
      density: 1,
      maxCount: 50,
      width: [0.05, 0.1],
      height: [0.2, 0.5],
      tiltMax: 0.1,
      seed: 3,
    });
    expect(mesh.castShadow).toBe(false);
    expect(mesh.receiveShadow).toBe(true);
    // 實例放的是世界座標,mesh 自己的包圍盒沒有意義,所以不能交給視錐剔除。
    expect(mesh.frustumCulled).toBe(false);
  });

  it('同一顆種子灑出同一片', () => {
    const opts = {
      geometry: makeBladeGeometry(3),
      material: material(),
      density: 1,
      maxCount: 60,
      width: [0.05, 0.1] as const,
      height: [0.2, 0.5] as const,
      tiltMax: 0.1,
      seed: 77,
    };
    const a = scatter(flatGround(), opts);
    const b = scatter(flatGround(), opts);
    const pa = new Vector3();
    const pb = new Vector3();
    for (let i = 0; i < a.count; i++) {
      expect(instancePosition(a, i, pa).distanceTo(instancePosition(b, i, pb))).toBe(0);
    }
  });
});

describe('風的實例材質', () => {
  it('所有實例材質共用一組風的 uniform', () => {
    const wind = createWindUniforms();
    const a = makeWindMaterial({ wind, sway: 0.1, bottom: 0x111111, top: 0x222222, cacheKey: 'a' });
    const b = makeWindMaterial({ wind, sway: 0.5, bottom: 0x111111, top: 0x222222, cacheKey: 'b' });
    // 同一個 uTime 物件 —— 複製一份的話,竹子與草會在第一次調參數時分家。
    wind.uTime.value = 3;
    expect(wind.uTime.value).toBe(3);
    expect(a.customProgramCacheKey()).toBe('a');
    expect(b.customProgramCacheKey()).toBe('b');
  });
});
