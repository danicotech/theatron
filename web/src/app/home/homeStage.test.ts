import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const source = readFileSync('web/public/lunjian/home-stage.js', 'utf8')
  .replace('export async function', 'async function')
  .replace(
    "await import('./stage3d.js')",
    "({stageMode:()=>new URLSearchParams(location.search).get('stage')||'2d',stageControls:()=>{}})",
  )
  .replace("await import('./home-intro.js')", '({createHomeIntro:mockIntro})')
  .replace("await import('./stage3d.js')", '({mountStage3D:mockStage})')
  .replace("await import('jz/js/scene.js')", '({createScene:mockCreate})');
const factory = runInThisContext(
  '(function(mockCreate,mockIntro,mockStage){' + source + ';return mountHomeStage;})',
) as (
  create: unknown,
  intro?: unknown,
  stage?: unknown,
) => (canvas: HTMLCanvasElement, signal: AbortSignal) => Promise<void>;
const create = vi.fn();
const scene = { render: vi.fn(), seek: vi.fn(), dispose: vi.fn() };
let media: EventTarget & { matches: boolean };
let controller: AbortController;
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  history.replaceState(null, '', '/home?stage=3d');
  document.body.innerHTML =
    '<div class="baiye-home"><canvas></canvas><h1 data-home-depth=".35" data-home-title></h1><img data-home-depth="2.2" data-home-side="1"></div>';
  media = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal('matchMedia', () => media);
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  create.mockResolvedValue(scene);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  controller = new AbortController();
});
afterEach(() => {
  controller.abort();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
it('首頁以原山門鏡位啟動；卸載停止繪製並回收場景', async () => {
  await factory(create)(document.querySelector('canvas')!, controller.signal);
  expect(scene.seek).toHaveBeenCalledWith(0);
  expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  controller.abort();
  expect(scene.dispose).toHaveBeenCalledTimes(1);
  expect(cancelAnimationFrame).toHaveBeenCalled();
  document.dispatchEvent(new Event('visibilitychange'));
  expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
});
it('輕量場景保留分層運鏡，卸載停止繪製且不建立 3D 世界', async () => {
  history.replaceState(null, '', '/home?intro=0');
  vi.stubGlobal('matchMedia', (query: string) =>
    query.includes('pointer') ? Object.assign(new EventTarget(), { matches: true }) : media,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  document.querySelector('.baiye-home')!.setAttribute('data-scene-fallback', '');
  await factory(create)(document.querySelector('canvas')!, controller.signal);
  expect(create).not.toHaveBeenCalled();
  window.dispatchEvent(
    new MouseEvent('pointermove', { clientX: innerWidth, clientY: innerHeight }),
  );
  vi.mocked(requestAnimationFrame).mock.calls[0]![0](100);
  const foreground = document.querySelector<HTMLElement>('img')!;
  expect(foreground.style.transform).toContain('translate3d(-');
  expect(foreground.style.transform).not.toBe(
    document.querySelector<HTMLElement>('h1')!.style.transform,
  );
  controller.abort();
  expect(foreground.style.transform).toBe('');
  expect(document.querySelector('.home-snow')).toBeNull();
  expect(cancelAnimationFrame).toHaveBeenCalled();
  vi.restoreAllMocks();
});
it('首頁月亮隨尺寸調整；交接內頁前還原月亮和天空光暈', async () => {
  function vector(x: number, y: number, z: number) {
    return {
      x,
      y,
      z,
      clone() {
        return vector(this.x, this.y, this.z);
      },
      copy(v: { x: number; y: number; z: number }) {
        Object.assign(this, v);
        return this;
      },
      set(a: number, b: number, c: number) {
        this.x = a;
        this.y = b;
        this.z = c;
        return this;
      },
      normalize() {
        const length = Math.hypot(this.x, this.y, this.z);
        this.x /= length;
        this.y /= length;
        this.z /= length;
        return this;
      },
    };
  }
  const position = vector(60, 54, -148);
  const direction = position.clone().normalize();
  const originalDirection = [direction.x, direction.y, direction.z];
  vi.stubGlobal('__JZ3D', {
    environment: {
      moon: { position },
      sky: { material: { uniforms: { uMoon: { value: direction } } } },
    },
  });
  vi.stubGlobal('innerWidth', 1055);
  vi.stubGlobal('innerHeight', 884);
  await factory(create)(document.querySelector('canvas')!, controller.signal);
  expect([position.x, position.y, position.z]).toEqual([-64, 156, -148]);
  vi.stubGlobal('innerWidth', 375);
  window.dispatchEvent(new Event('resize'));
  expect([position.x, position.y, position.z]).toEqual([-34, 150, -148]);
  document.dispatchEvent(new Event('lunjian:home-handoff'));
  expect([position.x, position.y, position.z]).toEqual([60, 54, -148]);
  expect([direction.x, direction.y, direction.z]).toEqual(originalDirection);
  window.dispatchEvent(new Event('resize'));
  expect([position.x, position.y, position.z]).toEqual([60, 54, -148]);
  runInThisContext('window.__LUNJIAN_SCENE_TRANSFER.dispose()');
});
it('場景還在載入時離頁，完成後立即回收且不啟動 RAF', async () => {
  let resolve!: (value: typeof scene) => void;
  create.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const pending = factory(create)(document.querySelector('canvas')!, controller.signal);
  await Promise.resolve();
  controller.abort();
  resolve(scene);
  await pending;
  expect(scene.dispose).toHaveBeenCalledTimes(1);
  expect(requestAnimationFrame).not.toHaveBeenCalled();
});
it.each(['reduced', '2d'])('%s 使用靜態底圖、不建立 3D 場景', async (mode) => {
  if (mode === 'reduced') media.matches = true;
  else history.replaceState(null, '', '/home?stage=2d');
  await factory(create)(document.querySelector('canvas')!, controller.signal);
  expect(create).not.toHaveBeenCalled();
});

it('首頁 ready 在第一幀 render 後才送出，而非模型剛建立時', async () => {
  const ready = vi.fn();
  document.addEventListener('lunjian:home-ready', ready, { signal: controller.signal });
  await factory(create)(document.querySelector('canvas')!, controller.signal);
  await Promise.resolve();
  expect(ready).not.toHaveBeenCalled();
  vi.mocked(requestAnimationFrame).mock.calls[0]![0](100);
  await Promise.resolve();
  await Promise.resolve();
  expect(scene.render).toHaveBeenCalled();
  expect(ready).toHaveBeenCalledOnce();
});

it('過場逾時後固定備援，遲到的 3D 不可再突然切換底圖', async () => {
  let resolve!: (value: typeof scene) => void;
  create.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const pending = factory(create)(document.querySelector('canvas')!, controller.signal);
  await Promise.resolve();
  document.dispatchEvent(new Event('lunjian:home-fallback'));
  resolve(scene);
  await pending;
  expect(scene.dispose).toHaveBeenCalledOnce();
  expect(requestAnimationFrame).not.toHaveBeenCalled();
  expect(document.querySelector('.baiye-home')).not.toHaveAttribute('data-scene');
});

it('題字與前景沿同一鏡頭輸入產生不同深度，卸載清除位移', async () => {
  await factory(create)(document.querySelector('canvas')!, controller.signal);
  const frame = vi.mocked(requestAnimationFrame).mock.calls[0]![0];
  frame(100);
  window.dispatchEvent(
    new MouseEvent('pointermove', { clientX: window.innerWidth, clientY: window.innerHeight }),
  );
  frame(150);
  const title = document.querySelector('h1')!;
  const foreground = document.querySelector('img')!;
  expect(scene.render.mock.calls.at(-1)![5]).toBeGreaterThan(0);
  expect(title.style.transform).toContain('translate3d(-');
  expect(foreground.style.transform).not.toEqual(title.style.transform);
  expect(title.style.transform).toContain('rotateY(');
  expect(foreground.style.transform).not.toContain('rotateY(');
  const initialTitle = title.style.transform;
  frame(200);
  expect(title.style.transform).not.toEqual(initialTitle);
  controller.abort();
  expect(title.style.transform).toBe('');
  expect(foreground.style.transform).toBe('');
});
it('改為減少動態立即停止場景與所有前景位移', async () => {
  await factory(create)(document.querySelector('canvas')!, controller.signal);
  vi.mocked(requestAnimationFrame).mock.calls[0]![0](100);
  media.matches = true;
  media.dispatchEvent(new Event('change'));
  expect(scene.dispose).toHaveBeenCalledTimes(1);
  expect(document.querySelector('h1')!.style.transform).toBe('');
  const calls = scene.render.mock.calls.length;
  vi.mocked(requestAnimationFrame).mock.calls[0]![0](200);
  expect(scene.render).toHaveBeenCalledTimes(calls);
});
it('站內切頁交接同一個 canvas 與場景，不在首頁卸載時回收', async () => {
  await factory(create)(document.querySelector('canvas')!, controller.signal);
  const canvas = document.querySelector('canvas')!;
  document.dispatchEvent(new Event('lunjian:home-handoff'));
  controller.abort();
  expect(scene.dispose).not.toHaveBeenCalled();
  const placeholder = document.createElement('canvas');
  placeholder.id = 'world';
  document.body.append(placeholder);
  const shared: unknown = runInThisContext(
    "window.__LUNJIAN_SCENE_TRANSFER.take(document.getElementById('world'))",
  );
  expect(shared).toBe(scene);
  expect(document.getElementById('world')).toBe(canvas);
  expect(document.getElementById('world-transfer')).toBeNull();
  scene.dispose();
  canvas.remove();
});
it('切頁未接手，逾時自動回收保留的 GPU 場景', async () => {
  vi.useFakeTimers();
  await factory(create)(document.querySelector('canvas')!, controller.signal);
  document.dispatchEvent(new Event('lunjian:home-handoff'));
  controller.abort();
  await vi.advanceTimersByTimeAsync(15000);
  expect(scene.dispose).toHaveBeenCalledTimes(1);
  expect(document.getElementById('world-transfer')).toBeNull();
  vi.useRealTimers();
});

it('完成開場後返回首頁，不再次掛載開場控制器', async () => {
  sessionStorage.setItem('lunjian:opening-seen:v1', '1');
  document
    .querySelector('.baiye-home')!
    .insertAdjacentHTML('beforeend', '<div id="boot" hidden></div>');
  await factory(create)(document.querySelector('canvas')!, controller.signal);
  expect(create).toHaveBeenCalledTimes(1);
  expect(document.getElementById('boot')!.hidden).toBe(true);
  expect(document.body.hasAttribute('data-intro')).toBe(false);
});

it('明確重播 3D 時即使看過開場，仍以原布幕 runtime 渲染到入場後才交棒', async () => {
  history.replaceState(null, '', '/home?stage=3d&intro=1');
  sessionStorage.setItem('lunjian:opening-seen:v1', '1');
  document.querySelector('.baiye-home')!.insertAdjacentHTML('beforeend', '<div id="boot"></div>');
  let enter = () => {};
  const intro = { S: { render3d: vi.fn() }, destroy: vi.fn() };
  const makeIntro = vi.fn(
    (_host: HTMLElement, _canvas: HTMLCanvasElement, _signal: AbortSignal, onEnter: () => void) => {
      enter = onEnter;
      return intro;
    },
  );
  const mountStage = vi.fn().mockResolvedValue(scene);
  await factory(
    create,
    makeIntro,
    mountStage,
  )(document.querySelector('canvas')!, controller.signal);
  expect(create).not.toHaveBeenCalled();
  expect(mountStage).toHaveBeenCalledWith(intro);
  const frame = vi.mocked(requestAnimationFrame).mock.calls[0]![0];
  frame(100);
  expect(intro.S.render3d).toHaveBeenCalled();
  expect(scene.render).not.toHaveBeenCalled();
  enter();
  frame(150);
  expect(scene.render.mock.calls.at(-1)![1]).toBe(1);
  controller.abort();
  expect(intro.destroy).toHaveBeenCalledOnce();
  expect(scene.dispose).toHaveBeenCalledOnce();
});

it('2D 運鏡只在指標移動時啟動，收斂後不再排幀且不移動文字', async () => {
  history.replaceState(null, '', '/home?stage=2d');
  const fine = Object.assign(new EventTarget(), { matches: true });
  vi.stubGlobal('matchMedia', (query: string) => (query.includes('pointer') ? fine : media));
  const pending = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      pending.set(++nextId, callback);
      return nextId;
    }),
  );
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id: number) => pending.delete(id)),
  );
  await factory(create)(document.querySelector('canvas')!, controller.signal);
  expect(pending.size).toBe(0);
  expect(document.querySelector('.home-snow')).toBeNull();
  for (let i = 0; i < 20; i++)
    window.dispatchEvent(
      new MouseEvent('pointermove', { clientX: innerWidth, clientY: innerHeight }),
    );
  expect(pending.size).toBe(1);
  for (let frame = 1; frame <= 120 && pending.size; frame++) {
    const callbacks = [...pending.values()];
    pending.clear();
    callbacks.forEach((callback) => callback(frame * 16.667));
  }
  expect(pending.size).toBe(0);
  expect(document.querySelector('h1')!.style.transform).toBe('');
  expect(document.querySelector('img')!.style.transform).toContain(
    'translate3d(-26.40px,-17.60px,0)',
  );
  window.dispatchEvent(new MouseEvent('pointermove', { clientX: 0, clientY: 0 }));
  expect(pending.size).toBe(1);
  fine.matches = false;
  fine.dispatchEvent(new Event('change'));
  expect(pending.size).toBe(0);
  expect(document.querySelector('img')!.style.transform).toBe('');
  window.dispatchEvent(new MouseEvent('pointermove', { clientX: innerWidth }));
  expect(pending.size).toBe(0);
  fine.matches = true;
  window.dispatchEvent(new MouseEvent('pointermove', { clientX: innerWidth }));
  expect(pending.size).toBe(1);
  controller.abort();
  expect(pending.size).toBe(0);
  window.dispatchEvent(new MouseEvent('pointermove', { clientX: 0 }));
  expect(pending.size).toBe(0);
});

it('2D 觸控與小螢幕維持靜態，不建立雪景或動畫迴圈', async () => {
  history.replaceState(null, '', '/home?stage=2d');
  await factory(create)(document.querySelector('canvas')!, controller.signal);
  window.dispatchEvent(new MouseEvent('pointermove', { clientX: 300, clientY: 400 }));
  window.dispatchEvent(new Event('pageshow'));
  expect(requestAnimationFrame).not.toHaveBeenCalled();
  expect(document.querySelector('.home-snow')).toBeNull();
  expect(create).not.toHaveBeenCalled();
});
