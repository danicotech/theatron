import { afterEach, expect, it, vi, type Mock } from 'vitest';
import { mountHomeOpening, mountChapterOpening } from './homeOpening';

const animation = vi.hoisted(() => ({
  kill: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  to: vi.fn<(state: { progress: number }, options: { onUpdate: () => void }) => void>(),
  complete: () => {},
}));
const editorial = vi.hoisted(() => vi.fn());
vi.mock('./editorialHomeOpening', () => ({ mountEditorialHomeOpening: editorial }));
const particles = vi.hoisted(() => ({ render: vi.fn(), dispose: vi.fn() }));
const makeParticles = vi.hoisted(() => vi.fn());
vi.mock('./paperFire3d', () => ({
  createPaperFire: (...args: unknown[]) => {
    makeParticles(...args);
    return particles;
  },
}));
vi.mock('gsap', () => ({
  gsap: {
    timeline: (options: { onComplete: () => void }) => {
      animation.complete = options.onComplete;
      return animation;
    },
  },
}));
let controller: AbortController;
function setup(reduced = false, chapter = false, mode = '2d') {
  history.replaceState(null, '', '/home?intro=1' + (mode ? `&stage=${mode}` : ''));
  vi.stubGlobal('matchMedia', () => ({ matches: reduced, addEventListener: vi.fn() }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    scale: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    drawImage: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  document.body.innerHTML =
    '<div class="baiye-home"><header class="site-header"></header><main><div class="home-actions"><a href="#">入場</a></div></main><div id="boot" tabindex="-1" hidden><div class="boot-fallback"></div><div class="boot-loading"></div><button id="ignite" disabled>點燃</button></div></div>';
  controller = new AbortController();
  const done = vi.fn(() => {
    if (chapter) {
      expect(document.body.hasAttribute('data-intro')).toBe(true);
      document.body.removeAttribute('data-intro');
      document.querySelector('main')!.inert = false;
    }
  });
  if (chapter) {
    const boot = document.querySelector<HTMLElement>('#boot')!;
    boot.hidden = false;
    boot.dataset.state = 'loading';
    document.body.dataset.intro = 'curtain';
    document.querySelector('main')!.inert = true;
    mountChapterOpening(document.querySelector('.baiye-home'), controller.signal, done);
  } else mountHomeOpening(document.querySelector('.baiye-home'), controller.signal, done);
  return { done, button: document.querySelector<HTMLButtonElement>('#ignite')! };
}
afterEach(() => {
  controller?.abort();
  sessionStorage.clear();
  localStorage.clear();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it('starts the original 3D runtime before ignition without drawing a flat curtain', () => {
  const { done, button } = setup(false, false, '3d');
  expect(done).toHaveBeenCalledOnce();
  expect(button.disabled).toBe(true);
  expect(button.dataset.inkWave).toBe('off');
  expect(document.querySelector('#boot')!.getAttribute('data-state')).toBe('loading');
  expect(document.querySelector('.opening-fire')).toBeNull();
  expect(document.querySelector('.opening-mode small')).toBeNull();
  expect(makeParticles).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('lunjian:opening-seen:v1')).toBeNull();
});
it('a failed home 3D setup burns once in 2D and signals the original runtime to enter', async () => {
  const { button } = setup(false, false, '3d');
  const host = document.querySelector('.baiye-home')!;
  const enter = vi.fn();
  host.addEventListener('lunjian:home-opening-fallback-complete', enter);
  const boot = document.querySelector<HTMLElement>('#boot')!;
  boot.dataset.fallback = '';
  boot.dataset.state = 'ready';
  await Promise.resolve();
  button.click();
  await vi.waitFor(() => expect(animation.to).toHaveBeenCalledOnce());
  animation.complete();
  expect(enter).toHaveBeenCalledOnce();
  expect(makeParticles).not.toHaveBeenCalled();
});
it('aborting a pending 2D editorial import never starts the opening', async () => {
  const { done } = setup();
  controller.abort();
  await Promise.resolve();
  expect(editorial).not.toHaveBeenCalled();
  expect(done).not.toHaveBeenCalled();
  expect(document.querySelector('.opening-fire')).toBeNull();
});
it('reduced motion skips the curtain without allocating a canvas', () => {
  const { done } = setup(true);
  expect(done).toHaveBeenCalledOnce();
  expect(document.querySelector('.opening-fire')).toBeNull();
});
it('defaults to the editorial cover without allocating a burn canvas', async () => {
  const { done } = setup(false, false, '');
  await vi.waitFor(() => expect(editorial).toHaveBeenCalledOnce());
  expect(document.querySelector('#boot')).toHaveAttribute('data-editorial');
  expect(document.querySelector('.opening-fire')).toBeNull();
  expect(done).not.toHaveBeenCalled();
});
it('explicit 2D overrides a saved 3D preference with the editorial opening', async () => {
  localStorage.setItem('lunjian:stage-mode:v1', '3d');
  setup();
  await vi.waitFor(() => expect(editorial).toHaveBeenCalledOnce());
  expect(makeParticles).not.toHaveBeenCalled();
  expect(document.querySelector('.opening-fire')).toBeNull();
});
it('renders consecutive timeline updates without a second FPS gate and pauses in a hidden tab', async () => {
  const { button } = setup(false, true, '3d');
  const boot = document.querySelector<HTMLElement>('#boot')!;
  boot.dataset.fallback = '';
  boot.dataset.state = 'ready';
  await Promise.resolve();
  button.click();
  await vi.waitFor(() => expect(animation.to).toHaveBeenCalledOnce());
  const canvas = document.querySelector<HTMLCanvasElement>('.opening-fire')!;
  const ctx = canvas.getContext('2d') as unknown as { clearRect: Mock };
  const [state, options] = animation.to.mock.calls[0]!;
  state.progress = 0.2;
  options.onUpdate();
  options.onUpdate();
  expect(ctx.clearRect).toHaveBeenCalledTimes(2);
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  document.dispatchEvent(new Event('visibilitychange'));
  expect(animation.pause).toHaveBeenCalled();
  hidden.mockReturnValue(false);
  document.dispatchEvent(new Event('visibilitychange'));
  expect(animation.resume).toHaveBeenCalled();
  animation.complete();
  expect(document.querySelector('#boot')).not.toHaveAttribute('data-raster');
  window.dispatchEvent(new Event('resize'));
  expect(document.querySelector('#boot')).not.toHaveAttribute('data-raster');
});
it('uses the remembered 3D opening when the URL does not override it', () => {
  localStorage.setItem('lunjian:stage-mode:v1', '3d');
  const { done, button } = setup(false, false, '');
  expect(done).toHaveBeenCalledOnce();
  expect(button.disabled).toBe(true);
  expect(makeParticles).not.toHaveBeenCalled();
});
it('offers both modes during chapter loading and cycles keyboard focus without igniting', () => {
  const { button } = setup(false, true);
  const links = document.querySelectorAll<HTMLAnchorElement>('.opening-mode a');
  expect(links).toHaveLength(2);
  const target = new URL(links[1]!.href);
  expect(target.searchParams.get('stage')).toBe('3d');
  expect(target.searchParams.get('intro')).toBe('1');
  links[1]!.addEventListener('click', (event) => event.preventDefault());
  links[1]!.click();
  expect(localStorage.getItem('lunjian:stage-mode:v1')).toBe('3d');
  expect(animation.to).not.toHaveBeenCalled();
  links[1]!.focus();
  links[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  expect(document.activeElement).toBe(links[0]);
  button.disabled = false;
  links[1]!.focus();
  links[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  expect(document.activeElement).toBe(button);
  controller.abort();
  expect(document.querySelector('.opening-mode')).toBeNull();
});
it('keeps chapter loading, replaces only the ready 2D burn and finishes the original entry once', async () => {
  const { done, button } = setup(false, true, '3d');
  const legacyBurn = vi.fn();
  button.addEventListener('click', legacyBurn);
  expect(document.querySelector('.opening-fire')).toBeNull();
  const boot = document.querySelector<HTMLElement>('#boot')!;
  boot.dataset.state = 'ready';
  await Promise.resolve();
  // The ready WebGL curtain still owns its own rendering.
  expect(document.querySelector('.opening-fire')).toBeNull();
  boot.dataset.fallback = '';
  await Promise.resolve();
  expect(document.querySelectorAll('.opening-fire')).toHaveLength(1);
  button.click();
  await vi.waitFor(() => expect(animation.to).toHaveBeenCalledOnce());
  expect(legacyBurn).not.toHaveBeenCalled();
  expect(animation.to).toHaveBeenCalledOnce();
  // A failed 3D scene must keep its opening fallback pure 2D too.
  expect(makeParticles).not.toHaveBeenCalled();
  animation.complete();
  expect(done).toHaveBeenCalledOnce();
  expect(document.querySelector('main')!.inert).toBe(false);
  expect(boot.hidden).toBe(true);
  expect(document.body.hasAttribute('data-intro')).toBe(false);
});
it('disconnects the chapter loader observer when the route unmounts before assets are ready', async () => {
  const { done } = setup(false, true);
  controller.abort();
  const boot = document.querySelector<HTMLElement>('#boot')!;
  boot.dataset.state = 'ready';
  boot.dataset.fallback = '';
  await Promise.resolve();
  expect(document.querySelector('.opening-fire')).toBeNull();
  expect(done).not.toHaveBeenCalled();
});

it('chapter-entry 2D also mounts the editorial cover instead of the old burning curtain', async () => {
  setup(false, true, '2d');
  const boot = document.querySelector<HTMLElement>('#boot')!;
  boot.dataset.fallback = '';
  boot.dataset.state = 'ready';
  await vi.waitFor(() => expect(editorial).toHaveBeenCalledOnce());
  expect(boot).toHaveAttribute('data-editorial');
  expect(document.querySelector('.opening-fire')).toBeNull();
});
