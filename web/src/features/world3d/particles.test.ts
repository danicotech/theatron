import { AdditiveBlending, ShaderMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { createBambooLeaves, createDust, createEmbers } from './particles';
import { createWindUniforms } from './wind';

const GROVE = { min: new Vector3(5, 4.5, -14), max: new Vector3(32, 12, 30) };

function materialOf(points: { points: { material: unknown } }): ShaderMaterial {
  return points.points.material as ShaderMaterial;
}

describe('竹葉', () => {
  it('全部從竹林裡生出來,不是從天上', () => {
    // 規格明寫的一條。從天上均勻落下的葉子是雪,換個顏色還是雪。
    const leaves = createBambooLeaves(400, GROVE, createWindUniforms());
    const pos = leaves.points.geometry.getAttribute('position');
    expect(pos.count).toBe(400);
    for (let i = 0; i < pos.count; i++) {
      expect(pos.getX(i)).toBeGreaterThanOrEqual(GROVE.min.x);
      expect(pos.getX(i)).toBeLessThanOrEqual(GROVE.max.x);
      expect(pos.getZ(i)).toBeGreaterThanOrEqual(GROVE.min.z);
      expect(pos.getZ(i)).toBeLessThanOrEqual(GROVE.max.z);
      // 高度夾在竹梢那一段 —— 這一行就是「從竹子掉下來」的定義。
      expect(pos.getY(i)).toBeGreaterThanOrEqual(GROVE.min.y);
      expect(pos.getY(i)).toBeLessThanOrEqual(GROVE.max.y);
    }
  });

  it('讀的是竹子那一組風的 uniform,不是自己複製的一份', () => {
    const wind = createWindUniforms();
    const leaves = createBambooLeaves(20, GROVE, wind);
    const mat = materialOf(leaves);
    wind.uTime.value = 12.5;
    // 同一個物件:竹子彎的那一刻,葉子必須正在被同一陣風帶走。
    expect(mat.uniforms.uTime).toBe(wind.uTime);
    expect(mat.uniforms.uWindDir).toBe(wind.uWindDir);
    expect((mat.uniforms.uTime as { value: number }).value).toBe(12.5);
  });

  it('葉子不自己推時間 —— 推兩次就會差一格', () => {
    const wind = createWindUniforms();
    const leaves = createBambooLeaves(10, GROVE, wind);
    leaves.update(99, 0, 0);
    expect(wind.uTime.value).toBe(0);
  });

  it('是細長的葉形,不是圓點', () => {
    const mat = materialOf(createBambooLeaves(10, GROVE, createWindUniforms()));
    // 圓點在這個尺寸下一律讀成雪,所以片元裡是一個被壓扁又旋轉過的橢圓。
    expect(mat.fragmentShader).toContain('vSpin');
    expect(mat.fragmentShader).toContain('0.13');
  });

  it('dispose 收掉幾何與材質', () => {
    const leaves = createBambooLeaves(10, GROVE, createWindUniforms());
    expect(() => leaves.dispose()).not.toThrow();
  });
});

describe('塵埃', () => {
  it('跟著鏡頭走', () => {
    const dust = createDust(120);
    const mat = materialOf(dust);
    expect((mat.uniforms.uFollow as { value: number }).value).toBe(1);
    dust.update(1, 12, -30);
    const centre = mat.uniforms.uCentre as { value: Vector3 };
    expect(centre.value.x).toBe(12);
    expect(centre.value.z).toBe(-30);
  });

  it('不是加色的 —— 加色的塵埃會在暗部糊成一片白霧', () => {
    expect(materialOf(createDust(10)).blending).not.toBe(AdditiveBlending);
  });
});

describe('餘燼', () => {
  it('釘在那一盞燈籠上,不跟著鏡頭跑', () => {
    // 全場只有一盞燈,所以火星只有一個來源。跟著鏡頭走的火星等於「到處都在燒」。
    const origin = new Vector3(-5.2, 3.28, -14.6);
    const embers = createEmbers(30, origin);
    const mat = materialOf(embers);
    expect((mat.uniforms.uFollow as { value: number }).value).toBe(0);
    embers.update(1, 99, 99);
    const centre = mat.uniforms.uCentre as { value: Vector3 };
    expect(centre.value.x).toBe(origin.x);
    expect(centre.value.z).toBe(origin.z);
  });

  it('往上飄,而且是加色的', () => {
    const embers = createEmbers(30, new Vector3());
    const fall = embers.points.geometry.getAttribute('aFall');
    for (let i = 0; i < fall.count; i++) expect(fall.getX(i)).toBeLessThan(0);
    expect(materialOf(embers).blending).toBe(AdditiveBlending);
  });

  it('場很小 —— 火星只在燈籠附近,不是滿天', () => {
    const mat = materialOf(createEmbers(30, new Vector3()));
    const field = (mat.uniforms.uField as { value: Vector3 }).value;
    expect(field.x).toBeLessThan(3);
    expect(field.z).toBeLessThan(3);
  });
});
