import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

type Style = 'bloom' | 'flow' | 'mist';
type Ink = {
  render: (progress: number) => void;
  prepare: (w: number, h: number) => void;
  dispose: () => void;
};
const source = readFileSync('web/public/lunjian/ink-transitions.js', 'utf8');
const engine = runInThisContext(
  '(function(){' +
    source.replace(/export /g, '') +
    ';return {resolveInkStyle,inkPhase,createInkTransition};})()',
) as {
  resolveInkStyle: (value: string) => Style;
  inkPhase: (progress: number, style: Style) => { swap: boolean; done: boolean };
  createInkTransition: (
    canvas: unknown,
    options: { style: Style; workerUrl?: string; onReady?: (ready: boolean) => void },
  ) => Ink | null;
};

function canvasFixture() {
  let pixels: Uint8ClampedArray = new Uint8ClampedArray();
  const clearRect = vi.fn();
  const canvas = {
    width: 0,
    height: 0,
    getBoundingClientRect: () => ({ width: 500, height: 320 }),
    getContext: () => ({
      clearRect,
      createImageData: (width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
      }),
      putImageData: (image: { data: Uint8ClampedArray }) => {
        pixels = image.data;
      },
    }),
  };
  return { canvas, clearRect, pixels: () => pixels };
}

describe('宣紙暈墨共用渲染器', () => {
  it('背景計算尚未完成時使用備援，忽略過期尺寸並在離頁終止工作', () => {
    const workers: FakeWorker[] = [];
    class FakeWorker {
      onmessage?: (event: { data: unknown }) => void;
      onerror?: () => void;
      postMessage = vi.fn<(request: { revision: number }) => void>();
      terminate = vi.fn();
      constructor() {
        workers.push(this);
      }
    }
    vi.stubGlobal('Worker', FakeWorker);
    try {
      const fixture = canvasFixture();
      Object.assign(fixture.canvas, {
        parentElement: { getBoundingClientRect: () => ({ width: 1000, height: 700 }) },
        getBoundingClientRect: () => ({ width: 0, height: 0 }),
      });
      const ready = vi.fn();
      const ink = engine.createInkTransition(fixture.canvas, {
        style: 'flow',
        workerUrl: '/ink-worker.js',
        onReady: ready,
      })!;
      const worker = workers[0]!;
      ink.prepare(500, 320);
      const first = worker.postMessage.mock.calls[0]![0];
      ink.prepare(1000, 700);
      ink.render(0.2);
      ink.render(0.3);
      ink.render(1);
      expect(worker.postMessage).toHaveBeenCalledTimes(2);
      worker.onmessage!({ data: { revision: first.revision, map: {} } });
      expect(ready.mock.calls.every(([value]) => value === false)).toBe(true);
      const next = worker.postMessage.mock.calls[1]![0];
      worker.onmessage!({ data: { revision: next.revision, map: {} } });
      expect(ready).toHaveBeenLastCalledWith(true);
      ink.dispose();
      expect(worker.terminate).toHaveBeenCalledOnce();
      ready.mockClear();
      worker.onmessage!({ data: { revision: next.revision, map: {} } });
      expect(ready).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('瀏覽器沒有 Worker 時不退回阻塞主執行緒的墨紋生成', () => {
    vi.stubGlobal('Worker', undefined);
    try {
      const fixture = canvasFixture();
      const ready = vi.fn();
      const ink = engine.createInkTransition(fixture.canvas, {
        style: 'flow',
        workerUrl: '/ink-worker.js',
        onReady: ready,
      })!;
      ink.render(0.46);
      expect(fixture.pixels()).toHaveLength(0);
      expect(ready).toHaveBeenLastCalledWith(false);
      ink.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it.each<Style>(['bloom', 'flow', 'mist'])(
    '%s 在換頁點完整覆蓋，兩端清空，釋放後停止繪製',
    (style) => {
      const fixture = canvasFixture();
      const ink = engine.createInkTransition(fixture.canvas, { style })!;
      ink.render(0);
      expect(fixture.clearRect).toHaveBeenCalledOnce();
      expect(engine.inkPhase(0.459, style).swap).toBe(false);
      ink.render(0.46);
      expect(engine.inkPhase(0.46, style).swap).toBe(true);
      const alpha = fixture.pixels().filter((_, index) => index % 4 === 3);
      expect(alpha.length).toBeGreaterThan(1000);
      expect(alpha.every((value) => value === 255)).toBe(true);
      ink.render(0.8);
      const revealing = fixture.pixels().filter((_, index) => index % 4 === 3);
      expect(revealing.some((value) => value < 255)).toBe(true);
      expect(revealing.some((value) => value > 0)).toBe(true);
      ink.render(1);
      expect(fixture.clearRect).toHaveBeenCalledTimes(2);
      ink.dispose();
      expect(fixture.canvas.width).toBe(1);
      ink.render(0);
      expect(fixture.clearRect).toHaveBeenCalledTimes(2);
    },
  );

  it('三版具有不同的暈染輪廓與半透明濕邊', () => {
    const samples = (['bloom', 'flow', 'mist'] as const).map((style) => {
      const fixture = canvasFixture();
      const ink = engine.createInkTransition(fixture.canvas, { style })!;
      ink.render(0.2);
      const alpha = fixture.pixels().filter((_, index) => index % 4 === 3);
      expect(alpha.some((value) => value > 0 && value < 255)).toBe(true);
      const fingerprint = alpha.reduce((sum, value, index) => sum + value * (index % 97), 0);
      ink.dispose();
      return fingerprint;
    });
    expect(new Set(samples).size).toBe(3);
  });

  it('B 保留游墨覆蓋，揭幕與 A 完全相同，從中央展出漫畫', () => {
    const sample = (style: Style, progress: number) => {
      const fixture = canvasFixture();
      const ink = engine.createInkTransition(fixture.canvas, { style })!;
      ink.render(progress);
      const alpha = Array.from(fixture.pixels().filter((_, index) => index % 4 === 3));
      ink.dispose();
      return alpha;
    };
    expect(sample('flow', 0.2)).not.toEqual(sample('bloom', 0.2));
    for (const progress of [0.6, 0.7, 0.8, 0.9]) {
      expect(sample('flow', progress)).toEqual(sample('bloom', progress));
    }
  });
  it('未知版本使用游墨行雲，Canvas 不可用則交還 CSS 備援', () => {
    expect(engine.resolveInkStyle('unknown')).toBe('flow');
    expect(engine.createInkTransition({ getContext: () => null }, { style: 'flow' })).toBeNull();
  });
});
