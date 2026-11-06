import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { gsap } from 'gsap';
import { mountEditorialHomeOpening } from './editorialHomeOpening';

const playback = vi.hoisted(() => ({ timeline: null as gsap.core.Timeline | null, play: vi.fn() }));
vi.mock('../../../public/lunjian/boot-symbol.js', () => ({ createBootSymbol: () => vi.fn() }));
vi.mock('../../app/opening-study/motion', async () => {
  const { gsap } = await import('gsap');
  return {
    openingTimeline: (
      _root: HTMLElement,
      _id: string,
      _reduced: boolean,
      _update: () => void,
      done: () => void,
    ) => {
      const timeline = gsap.timeline({ paused: true, onComplete: done });
      timeline.to({ progress: 0 }, { progress: 1, duration: 1.5 });
      playback.timeline = timeline;
      vi.spyOn(timeline, 'play').mockImplementation(() => {
        playback.play();
        return timeline;
      });
      return timeline;
    },
  };
});
let controller: AbortController;
beforeEach(() => {
  history.replaceState(null, '', '/home?stage=2d&intro=1');
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn() }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  document.body.dataset.intro = 'curtain';
  document.body.innerHTML =
    '<div class="baiye-home"><header class="site-header"></header><main class="home-hero"><img src="/gate.webp"><div class="home-copy"><div class="home-actions"><a href="/#prologue">了解賽制</a></div></div></main><div id="boot" data-editorial tabindex="-1"><div class="boot-loading"><canvas class="boot-mark"></canvas><canvas class="boot-plume"></canvas><progress id="load-progress" max="100"></progress><span id="load-number"></span><span id="load-label"></span></div><button id="ignite" disabled>點燃</button></div></div>';
  controller = new AbortController();
});
afterEach(async () => {
  await act(async () => {
    controller.abort();
    window.dispatchEvent(new Event('pagehide'));
    await Promise.resolve();
  });
  sessionStorage.clear();
  localStorage.clear();
  document.body.replaceChildren();
  document.body.removeAttribute('data-intro');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  playback.play.mockClear();
});
async function mount() {
  const host = document.querySelector<HTMLElement>('.baiye-home')!;
  const boot = document.querySelector<HTMLElement>('#boot')!;
  const done = vi.fn();
  await act(async () => {
    mountEditorialHomeOpening(host, boot, controller.signal, done);
    await Promise.resolve();
  });
  return { host, boot, done, button: boot.querySelector<HTMLButtonElement>('#ignite')! };
}
it('waits for decoded images and keeps background inert until a single user entry completes', async () => {
  const state = await mount();
  await waitFor(() => expect(state.button.disabled).toBe(false), { timeout: 3000 });
  expect(document.querySelector('main')!.inert).toBe(true);
  expect(state.boot.querySelectorAll('canvas')).toHaveLength(2);
  expect(state.boot.querySelector('.boot-loading')).toHaveAttribute('aria-hidden', 'true');
  expect(state.boot.querySelector<HTMLProgressElement>('#load-progress')!.value).toBe(100);
  expect(state.boot.querySelector('[data-wire-background] img')?.getAttribute('src')).toBe(
    '/lunjian/art/bg/scene-gate.webp',
  );
  expect(state.boot.querySelector('[data-sharp-home-scene]')).toBeNull();
  expect(state.boot.querySelector('[data-live-veil]')).not.toBeNull();
  expect(state.boot.querySelector('img[src$="/background.webp"]')).toBeNull();
  expect(state.boot.textContent).not.toContain('MAKIMA');
  expect(state.boot.textContent).not.toContain('↗');
  expect(state.boot.querySelector('a[href="/#schedule"]')).toBeNull();
  expect(state.button.hidden).toBe(true);
  expect(state.boot.textContent).not.toContain('點擊入境');
  expect(state.boot.querySelector('[data-ed-type]')).toHaveTextContent('BAIYE SHIFENG');
  expect(state.boot.querySelector('a[href="/#prologue"]')).toBeNull();
  expect(state.boot.textContent).not.toContain('夜鴉閣 · 以武會友');
  expect(state.boot.querySelector('[data-frame-entry]')).toHaveAttribute(
    'aria-label',
    '開啟人物畫框，前往首頁',
  );
  expect(state.boot.querySelector('a[href="/#rules"]')).toHaveTextContent('規則說明');
  expect(state.boot.querySelector('a[href="/#register"]')).toHaveTextContent('報名');
  expect(state.done).not.toHaveBeenCalled();
  state.boot.focus();
  for (let step = 0; step < 3; step++) {
    state.boot.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  }
  expect(document.activeElement).toBe(state.boot.querySelector('[data-frame-entry]'));
  await act(async () => {
    state.boot.querySelector<HTMLAnchorElement>('[data-frame-entry]')!.click();
    state.boot.querySelector<HTMLAnchorElement>('[data-frame-entry]')!.click();
    await Promise.resolve();
  });
  expect(playback.play).toHaveBeenCalledOnce();
  await act(async () => {
    playback.timeline!.progress(1);
    await Promise.resolve();
  });
  expect(state.done).toHaveBeenCalledOnce();
  expect(state.boot.hidden).toBe(true);
  expect(document.querySelector('main')!.inert).toBe(false);
  expect(document.body.hasAttribute('data-intro')).toBe(false);
  expect(document.activeElement).toBe(document.querySelector('.home-actions a'));
  expect(sessionStorage.getItem('lunjian:opening-seen:v1')).toBe('1');
  expect(state.boot.querySelector('[data-editorial-opening]')).toBeNull();
  expect(document.querySelector<HTMLElement>('.home-copy')!.style.opacity).toBe('');
});
it('does not enable entry while an image is still decoding', async () => {
  let resolve!: () => void;
  const pending = new Promise<void>((done) => {
    resolve = done;
  });
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    value: vi.fn(() => pending),
  });
  const state = await mount();
  expect(state.button.disabled).toBe(true);
  expect(state.boot.dataset.state).toBe('loading');
  expect(state.boot.querySelector<HTMLProgressElement>('#load-progress')!.value).toBe(0);
  expect(state.boot.querySelector('.boot-loading')).not.toHaveAttribute('aria-hidden');
  await act(async () => {
    resolve();
    await pending;
  });
  await waitFor(() => expect(state.button.disabled).toBe(false), { timeout: 3000 });
  Reflect.deleteProperty(HTMLImageElement.prototype, 'decode');
});
it('route disposal restores focusability without entering or remembering an unfinished opening', async () => {
  const state = await mount();
  await act(async () => {
    state.button.click();
    controller.abort();
    await Promise.resolve();
  });
  expect(state.done).not.toHaveBeenCalled();
  expect(document.querySelector('main')!.inert).toBe(false);
  expect(sessionStorage.getItem('lunjian:opening-seen:v1')).toBeNull();
  expect(state.boot.querySelector('[data-editorial-opening]')).toBeNull();
});

it.each([
  ['chapter', '/home?intro=0&stage=2d'],
  ['chapter', '/#register'],
])('plays before navigating from %s to %s with unavailable storage', async (kind, href) => {
  history.replaceState(null, '', '/home?stage=2d&intro=1&sportsEvent=event-one');
  if (kind === 'chapter') document.querySelector('main')!.className = 'chapter-stage';
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Unavailable');
  });
  const state = await mount();
  const navigate = vi.fn((event: Event) => event.preventDefault());
  state.host.addEventListener('lunjian:editorial-navigate', navigate);
  await waitFor(() => expect(state.button.disabled).toBe(false), { timeout: 3000 });
  const link = state.boot.querySelector<HTMLAnchorElement>(`[data-cover-link][href="${href}"]`)!;
  await act(async () => {
    link.click();
    link.click();
    await Promise.resolve();
  });
  expect(playback.play).toHaveBeenCalledOnce();
  expect(navigate).not.toHaveBeenCalled();
  expect(state.boot.dataset.state).toBe('burning');
  await act(async () => {
    playback.timeline!.progress(1);
    await Promise.resolve();
  });
  expect(navigate).toHaveBeenCalledOnce();
  const destination = new URL(
    (navigate.mock.calls[0]![0] as CustomEvent<{ href: string }>).detail.href,
  );
  expect(destination.hash).toBe(new URL(href, location.href).hash);
  expect(destination.searchParams.get('intro')).toBe('0');
  expect(destination.searchParams.get('sportsEvent')).toBe('event-one');
});
it('switches to the 3D opening only after the editorial exit completes', async () => {
  const state = await mount();
  const navigate = vi.fn((event: Event) => event.preventDefault());
  state.host.addEventListener('lunjian:editorial-navigate', navigate);
  await waitFor(() => expect(state.button.disabled).toBe(false), { timeout: 3000 });
  await act(async () => {
    state.boot.querySelector<HTMLAnchorElement>('[data-opening-mode="3d"]')!.click();
    await Promise.resolve();
  });
  expect(playback.play).toHaveBeenCalledOnce();
  expect(navigate).not.toHaveBeenCalled();
  await act(async () => {
    playback.timeline!.progress(1);
    await Promise.resolve();
  });
  const destination = new URL(
    (navigate.mock.calls[0]![0] as CustomEvent<{ href: string }>).detail.href,
  );
  expect(destination.searchParams.get('intro')).toBe('1');
  expect(destination.searchParams.get('stage')).toBe('3d');
});

it.each(['rules', 'register'])(
  'reveals %s from its selected portrait after the real route is ready',
  async (chapterId) => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Unavailable');
    });
    const state = await mount();
    const navigate = vi.fn((event: Event) => {
      event.preventDefault();
      history.replaceState(null, '', (event as CustomEvent<{ href: string }>).detail.href);
    });
    state.host.addEventListener('lunjian:editorial-navigate', navigate);
    await waitFor(() => expect(state.button.disabled).toBe(false), { timeout: 3000 });
    const link = state.boot.querySelector<HTMLAnchorElement>(
      `[data-cover-link][href="/#${chapterId}"]`,
    )!;
    await act(async () => {
      link.click();
      link.click();
      await Promise.resolve();
    });
    expect(navigate).toHaveBeenCalledOnce();
    expect(playback.play).not.toHaveBeenCalled();
    const cover = document.querySelector('[data-editorial-transition]')!;
    expect(cover.querySelector('[data-portal-selected]')).toHaveAttribute('href', `/#${chapterId}`);
    expect(cover.querySelector('[data-live-veil]')).not.toHaveStyle({
      backgroundColor: 'transparent',
    });
    // The opening unmounts on navigation, but its independent cover must survive.
    await act(async () => {
      controller.abort();
      await Promise.resolve();
    });
    expect(cover.isConnected).toBe(true);
    const entry = document.createElement('div');
    entry.className = 'chapter-entry';
    entry.setAttribute('data-entry-pending', '');
    entry.innerHTML = `<main><section id="${chapterId}" data-on><h2>章節標題</h2></section></main>`;
    const chapter = entry.querySelector('section')!;
    vi.spyOn(chapter, 'getBoundingClientRect').mockReturnValue({ width: 800 } as DOMRect);
    await act(async () => {
      document.body.append(entry);
      await Promise.resolve();
    });
    expect(playback.play).not.toHaveBeenCalled();
    await act(async () => {
      entry.removeAttribute('data-entry-pending');
      await Promise.resolve();
    });
    await waitFor(() => expect(playback.play).toHaveBeenCalledOnce());
    const main = entry.querySelector('main')!;
    expect(main.style.opacity).toBe('0');
    await act(async () => {
      playback.timeline!.time(0.7);
      await Promise.resolve();
    });
    expect(main.style.opacity).toBe('0');
    await act(async () => {
      playback.timeline!.time(1.45);
      await Promise.resolve();
    });
    expect(Number(main.style.opacity)).toBeGreaterThan(0);
    await act(async () => {
      playback.timeline!.progress(1);
      await Promise.resolve();
    });
    expect(cover.isConnected).toBe(false);
    expect(main.style.opacity).toBe('');
    expect(main.style.transition).toBe('');
    expect(document.activeElement).toBe(chapter.querySelector('h2'));
    expect(location.hash).toBe(`#${chapterId}`);
  },
);

it('owns the entry button and hands the stage its intro flag before clearing it', async () => {
  const state = await mount();
  // The stage script's fallback listens on the same button; it must not burn a second entry.
  const legacy = vi.fn();
  state.button.addEventListener('click', legacy);
  let introDuringDone: string | undefined;
  state.done.mockImplementation(() => {
    introDuringDone = document.body.dataset.intro;
  });
  await waitFor(() => expect(state.button.disabled).toBe(false), { timeout: 3000 });
  await act(async () => {
    state.button.click();
    await Promise.resolve();
  });
  expect(legacy).not.toHaveBeenCalled();
  expect(playback.play).toHaveBeenCalledOnce();
  await act(async () => {
    playback.timeline!.progress(1);
    await Promise.resolve();
  });
  expect(state.done).toHaveBeenCalledOnce();
  expect(introDuringDone).toBe('curtain');
  expect(document.body.hasAttribute('data-intro')).toBe(false);
  expect(document.querySelector<HTMLElement>('.site-header')!.style.opacity).not.toBe('0');
});
