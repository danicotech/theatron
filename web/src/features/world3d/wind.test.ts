import { Object3D, Vector2 } from 'three';
import { describe, expect, it } from 'vitest';

import {
  createWind,
  createWindUniforms,
  DEFAULT_WIND,
  gustTravelTime,
  windAt,
  WIND_GLSL,
  WIND_VERTEX_CHUNK,
} from './wind';

/**
 * 風場的測試只有一個重點:**陣風會走**。
 *
 * 這個檔案存在的全部理由是「同一陣風先吹上風處、再吹下風處」。如果沒有這件事,
 * 那每一株各自用一個隨機相位抖,結果在畫面上是一樣的 —— 而那樣就不需要一個
 * 共用的場,也不需要 GPU 與 CPU 兩份逐項相同的公式。
 *
 * 量法用互相關,不是「找波峰再比時間」。原因在公式裡:垂直風向的擾動項對
 * 同一條風向線上的兩點是**完全一樣**的,它會把兩個訊號都推一下,波峰的位置
 * 因此會漂。互相關把這個共同項變成一個固定在 lag 0 的小凸起(振幅 0.045),
 * 遠小於主波的 0.5,所以峰值仍然落在真正的傳遞時間上。
 */

const PARAMS = { ...DEFAULT_WIND, direction: new Vector2(1, 0) };

/** 兩個訊號在某個時間延遲下的相關係數(未正規化,只比大小)。 */
function correlate(a: readonly number[], b: readonly number[], lagSteps: number): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    const j = i + lagSteps;
    if (j < 0 || j >= b.length) continue;
    sum += a[i]! * b[j]!;
    n++;
  }
  return n === 0 ? 0 : sum / n;
}

function sampleOver(x: number, z: number, steps: number, dt: number): number[] {
  const u = createWindUniforms(PARAMS);
  const out: number[] = [];
  for (let i = 0; i < steps; i++) out.push(windAt(x, z, i * dt, u));
  return out;
}

describe('風場', () => {
  it('一陣風先到上風處,後到下風處', () => {
    // 距離刻意取小:傳遞時間 d·freq/speed 必須小於主波週期的一半
    // (2π/speed ÷ 2 ≈ 2.5 秒),否則互相關的峰值會繞回去,量到的是別一圈的
    // 同一個波峰。四公尺在這組參數下是 1.34 秒,安全。
    const DIST = 4;
    const DT = 0.02;
    const STEPS = 900;
    const upwind = sampleOver(0, 0, STEPS, DT);
    const downwind = sampleOver(DIST, 0, STEPS, DT);

    const maxLag = Math.round(2.4 / DT);
    let bestLag = -maxLag;
    let best = -Infinity;
    for (let lag = -maxLag; lag <= maxLag; lag++) {
      const c = correlate(upwind, downwind, lag);
      if (c > best) {
        best = c;
        bestLag = lag;
      }
    }

    const lagSeconds = bestLag * DT;
    // 這一行就是整個檔案的重點:延遲是正的 —— 下風處晚到。
    expect(lagSeconds).toBeGreaterThan(0.2);

    // 而且晚的量在主波的傳遞時間附近。不是「等於」:訊號是三層疊加的,
    // 二次諧波自己的傳遞時間是主波的 1.44 倍(頻率 ×2.6、速度 ×1.8),
    // 它會把互相關的峰值往後拉一點。所以量的是「落在主波與諧波之間」,
    // 而這正是這條波該有的樣子。
    const primary = gustTravelTime(DIST, PARAMS);
    const harmonic = (primary * 2.6) / 1.8;
    expect(lagSeconds).toBeGreaterThanOrEqual(primary * 0.9);
    expect(lagSeconds).toBeLessThanOrEqual(harmonic * 1.1);
  });

  it('把兩點對調,延遲就變成負的', () => {
    const DT = 0.02;
    const STEPS = 900;
    const upwind = sampleOver(0, 0, STEPS, DT);
    const downwind = sampleOver(4, 0, STEPS, DT);

    const maxLag = Math.round(2.4 / DT);
    let bestLag = 0;
    let best = -Infinity;
    for (let lag = -maxLag; lag <= maxLag; lag++) {
      const c = correlate(downwind, upwind, lag);
      if (c > best) {
        best = c;
        bestLag = lag;
      }
    }
    expect(bestLag * DT).toBeLessThan(-0.2);
  });

  it('垂直風向的兩點同時吃到同一陣風', () => {
    const u = createWindUniforms(PARAMS);
    // 風向是 +x,所以 z 軸上的兩點沿風向的投影相同 —— 主波對它們是同一個值。
    // 只有擾動項會差,而擾動項的權重是 0.3。
    const a = windAt(0, 0, 1.7, u);
    const b = windAt(0, 9, 1.7, u);
    expect(Math.abs(a - b)).toBeLessThan(0.62);
  });

  it('同一個時間與位置永遠給同一個值', () => {
    const u = createWindUniforms(PARAMS);
    expect(windAt(3.1, -4.2, 2.5, u)).toBe(windAt(3.1, -4.2, 2.5, u));
  });

  it('GPU 與 CPU 兩份公式的項數對得上', () => {
    // 逐項比對做不到(一邊是字串),但至少擋住「有人只改了一邊的正負號」
    // 這個最常見的漂移:兩邊的時間項都必須是減號。
    expect(WIND_GLSL).toContain('- t * uWindSpeed');
    expect(WIND_GLSL).toContain('- t * uWindSpeed * 1.8');
    expect(WIND_GLSL).not.toContain('+ t * uWindSpeed');
  });

  it('實例位移的那一段有除以 instance 的縮放', () => {
    // 少了這一行,同一個場吹三十公分的草會只動兩公分,吹九公尺的竹子會動九公尺。
    expect(WIND_VERTEX_CHUNK).toContain('instScale');
    expect(WIND_VERTEX_CHUNK).toContain('transpose(instRot)');
    expect(WIND_VERTEX_CHUNK).toContain('hMask = wH * wH');
  });

  it('註冊的東西會被吹,而且倒向下風處', () => {
    const field = createWind(PARAMS);
    const pivot = new Object3D();
    pivot.position.set(0, 0, 0);
    const off = field.add(pivot, 1);
    expect(field.count).toBe(1);

    // 風向 +x,所以彎的是繞 z 軸。
    let sawBend = false;
    for (let i = 0; i < 40; i++) {
      field.update(i * 0.1);
      if (Math.abs(pivot.rotation.z) > 0.02) sawBend = true;
    }
    expect(sawBend).toBe(true);

    off();
    expect(field.count).toBe(0);
  });

  it('update 會把時間推進共用的 uniform', () => {
    const field = createWind(PARAMS);
    field.update(4.25);
    expect(field.uniforms.uTime.value).toBe(4.25);
  });
});
