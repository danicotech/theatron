import { labSource } from '../../../scripts/lab-source';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Execute the generated integration with only WebGL I/O replaced. The opening
// state machine, progress, interaction and lifetime handling remain real code.
const source = readFileSync('web/public/lunjian/stage3d.js', 'utf8');
const mount = runInThisContext(
  '(async function(imports){' +
    source
      .replace('export async function', 'async function')
      .replace("import('jz/js/scene.js')", 'Promise.resolve(imports.scene)')
      .replace("import('jz/vendor/three.module.js')", 'Promise.resolve(imports.three)') +
    ';return mountStage3D();})',
) as (imports: Record<string, unknown>) => Promise<unknown>;

class Resource {
  image = { width: 1536, height: 1024 };
  position = { z: 0 };
  scale = { set: vi.fn() };
  dispose = vi.fn();
  removeFromParent = vi.fn();
}

const cleanups: Array<() => void> = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  document.body.replaceChildren();
  document.body.removeAttribute('data-stage');
  document.body.classList.remove('reading');
  vi.unstubAllGlobals();
});

function fixture() {
  history.replaceState(null, '', '/?stage=3d');
  document.body.innerHTML =
    '<canvas id="world"></canvas><div id="boot" style="--ink:var(--surface-base)"></div><img id="boot-duel" src="/wide.png"><source id="boot-duel-portrait" srcset="/tall.png">';
  for (const id of ['prologue', 'rules', 'invitation', 'register', 'duel', 'schedule', 'rewards']) {
    const chapter = document.createElement('section');
    chapter.className = 'chapter';
    chapter.id = id;
    document.body.append(chapter);
  }
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  const controller = new AbortController();
  cleanups.push(() => controller.abort());
  const resources: Resource[] = [];
  const path = { entry: 0, current: 0 };
  const start = vi.fn(),
    render = vi.fn((_time: number, progress: number) => {
      // The frozen engine returns to the opening shot while rendering the curtain.
      if (progress < 1) path.current = 0;
    }),
    enter = vi.fn();
  vi.stubGlobal('__JZ3D', { path });
  let report = (_name: string) => {};
  const scene = {
    camera: { fov: 42 },
    banner: {
      mesh: { parent: { add: vi.fn() } },
      hit: vi.fn(() => null),
      start,
      prepare: vi.fn().mockResolvedValue(undefined),
    },
    prepare: vi.fn(() => {
      report('shaders');
    }),
    seek: vi.fn((shot: number) => {
      path.current = shot;
    }),
    render,
    dispose: vi.fn(),
  };
  let ignite: (event: { detail: number; clientX: number; clientY: number }) => void = () => {};
  const runtime = {
    S: { shown: 0, shot: 0, frac: 0, mx: 0, my: 0, render3d: (_now: number, _dt: number) => {} },
    lifetime: controller,
    cleanups,
    beginIntro: vi.fn(),
    introProgress: vi.fn(),
    applyGrid: vi.fn(),
    readyIntro: (action: typeof ignite) => {
      ignite = action;
    },
    burningIntro: vi.fn(),
    enterStage: enter,
    prepareFallback: vi.fn(),
  };
  vi.stubGlobal('__LUNJIAN', runtime);
  vi.stubGlobal('__stage3d', false);
  const imports = {
    scene: {
      createScene: vi.fn((_canvas: unknown, stage: (name: string) => void) => {
        report = stage;
        [
          'renderer',
          'texture-banner-cloth',
          'texture-wood',
          'texture-cloth',
          'geometry',
          'title',
          'art',
        ].forEach(stage);
        return Promise.resolve(scene);
      }),
    },
    three: {
      TextureLoader: class {
        loadAsync() {
          const texture = new Resource();
          resources.push(texture);
          return Promise.resolve(texture);
        }
      },
      PlaneGeometry: Resource,
      MeshBasicMaterial: Resource,
      Mesh: Resource,
      MathUtils: { degToRad: (degrees: number) => (degrees * Math.PI) / 180 },
      SRGBColorSpace: 'srgb',
    },
  };
  return {
    imports,
    runtime,
    resources,
    controller,
    scene,
    path,
    start,
    render,
    enter,
    ignite: () => ignite({ detail: 1, clientX: 0, clientY: 0 }),
  };
}

describe('燃布開場', () => {
  it.each([
    { shown: 3, shot: 3, entry: 0.16 },
    { shown: 4, shot: 3, entry: 0.2 },
    { shown: 6, shot: 4, entry: 0.18 },
  ])('直接進章 $shown 保持鏡位 $shot 並以小幅入鏡在四秒內收束', async ({ shown, shot, entry }) => {
    const f = fixture();
    Object.assign(f.runtime.S, { shown, shot, frac: 0.4, mx: 1, my: -1 });
    await mount(f.imports);
    expect(f.scene.seek).toHaveBeenLastCalledWith(shot);
    expect(f.path.current).toBe(shot);
    expect(f.path.entry).toBe(entry);
    for (let frame = 0; frame < 40; frame++) f.runtime.S.render3d(frame * 50, 50);
    expect(f.path.entry).toBeCloseTo(entry / 2);
    expect(f.render).toHaveBeenLastCalledWith(expect.any(Number), 1, 0.4, 0.05, 0, 0.35, -0.35, 1);
    for (let frame = 40; frame < 80; frame++) f.runtime.S.render3d(frame * 50, 50);
    expect(f.path.entry).toBeCloseTo(0);
  });

  it('報名與對決共用擂台仍按章重新入鏡，其他章清除殘留偏移', async () => {
    const f = fixture();
    Object.assign(f.runtime.S, { shown: 1, shot: 2, mx: 1 });
    await mount(f.imports);
    expect(f.path.entry).toBe(0);
    for (const [shown, shot, entry] of [
      [3, 3, 0.16],
      [4, 3, 0.2],
      [6, 4, 0.18],
    ] as const) {
      Object.assign(f.runtime.S, { shown, shot });
      f.scene.seek(shot); // swapTo performs this beneath the opaque ink cover.
      f.runtime.S.render3d(0, 0);
      expect(f.path.current).toBe(shot);
      expect(f.path.entry).toBe(entry);
    }
    Object.assign(f.runtime.S, { shown: 2, shot: 1 });
    f.scene.seek(1);
    f.runtime.S.render3d(0, 0);
    expect(f.path.entry).toBe(0);
    expect(f.render).toHaveBeenLastCalledWith(expect.any(Number), 1, 0, 0, 0, 1, 0, 1);
  });

  it('入鏡幅度依章節識別，而非共用的場景鏡位', async () => {
    const f = fixture();
    document.getElementById('register')!.id = 'temporary';
    document.getElementById('duel')!.id = 'register';
    document.getElementById('temporary')!.id = 'duel';
    Object.assign(f.runtime.S, { shown: 3, shot: 3 });
    await mount(f.imports);
    expect(f.path.entry).toBe(0.2);
    f.runtime.S.shown = 4;
    f.runtime.S.render3d(0, 0);
    expect(f.path.entry).toBe(0.16);
  });

  it('首頁燃幕後保留原幅度，閱讀模式與卸載不留下入鏡動畫', async () => {
    const f = fixture();
    await mount(f.imports);
    f.ignite();
    f.runtime.S.render3d(performance.now() + 6000, 0);
    expect(f.path.entry).toBe(1);
    expect(f.path.current).toBe(0);
    document.body.classList.add('reading');
    f.runtime.S.render3d(performance.now() + 6050, 50);
    expect(f.path.entry).toBe(0);
    const calls = f.render.mock.calls.length;
    f.controller.abort();
    f.runtime.S.render3d(performance.now() + 6100, 50);
    expect(f.render.mock.calls).toHaveLength(calls);
  });

  it('布幕投影素材準備完成前不能出現點燃入口', async () => {
    const f = fixture();
    const ready = vi.spyOn(f.runtime, 'readyIntro');
    let finish!: () => void;
    f.scene.banner.prepare.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = mount(f.imports);
    await vi.waitFor(() => expect(f.scene.banner.prepare).toHaveBeenCalledOnce());
    expect(ready).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(ready).toHaveBeenCalledOnce();
  });
  it('投影素材失敗時回到 2D，不能靜默顯示沒有人的 3D 布幕', async () => {
    const f = fixture();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    f.scene.banner.prepare.mockRejectedValue(new Error('shadow image unavailable'));
    await mount(f.imports);
    expect(f.runtime.prepareFallback).toHaveBeenCalledOnce();
    expect(f.scene.dispose).toHaveBeenCalledOnce();
    warning.mockRestore();
  });
  it('生成的布幕材質與 lab 正本一致，投影素材路徑已轉換', () => {
    const lab = readFileSync(labSource('jz/js/cloth.js'), 'utf8')
      .replace(/^\uFEFF/, '')
      .replaceAll('\r\n', '\n')
      .replace('../../art/curtain-figures.webp', '../../lunjian/art/curtain-figures.webp');
    expect(readFileSync('web/public/jz/js/cloth.js', 'utf8')).toBe(lab);
  });
  it('旗面外點擊也點燃；真實時間推進後入場，釋放幕後圖片', async () => {
    const f = fixture();
    await mount(f.imports);
    expect(f.runtime.introProgress).toHaveBeenLastCalledWith(100, '江湖已開');
    expect(f.enter).not.toHaveBeenCalled();
    f.ignite();
    expect(f.start).toHaveBeenCalledWith({ x: 0.5, y: 0.5 });
    f.ignite();
    expect(f.start).toHaveBeenCalledOnce();
    f.runtime.S.render3d(performance.now() + 4000, 16);
    expect(document.querySelector('#boot')?.getAttribute('data-state')).toBe('reveal');
    expect(f.enter).not.toHaveBeenCalled();
    f.runtime.S.render3d(performance.now() + 6000, 16);
    expect(f.enter).toHaveBeenCalledOnce();
    for (const texture of f.resources) expect(texture.dispose).toHaveBeenCalled();
    expect(f.render.mock.lastCall?.[1]).toBe(1);
  });
  it('非同步場景完成前離頁，不留下場景或開場更新', async () => {
    const f = fixture();
    let finish!: (scene: typeof f.scene) => void;
    f.imports.scene.createScene.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = mount(f.imports);
    await Promise.resolve();
    f.controller.abort();
    finish(f.scene);
    await pending;
    expect(f.scene.dispose).toHaveBeenCalledOnce();
    expect(f.enter).not.toHaveBeenCalled();
    expect(f.resources).toHaveLength(0);
  });
});
it('首頁交接到內頁時沿用既有場景，不重建材質或重播布幕', async () => {
  const f = fixture();
  f.runtime.S.shown = 1;
  f.runtime.S.shot = 1;
  vi.stubGlobal('__LUNJIAN_SCENE_TRANSFER', { take: vi.fn(() => f.scene) });
  await mount(f.imports);
  expect(f.imports.scene.createScene).not.toHaveBeenCalled();
  expect(f.scene.banner.prepare).not.toHaveBeenCalled();
  expect(f.scene.prepare).not.toHaveBeenCalled();
  expect(f.render.mock.calls.every((call) => call[1] === 1)).toBe(true);
  expect(f.runtime.applyGrid).toHaveBeenCalledWith(1, { animate: false });
});
