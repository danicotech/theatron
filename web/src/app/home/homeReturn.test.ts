import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const source = readFileSync('web/public/lunjian/home-return.js', 'utf8')
  .replace(/^import .*;\r?\n/, '')
  .replace('export function', 'function');
const mount = runInThisContext(
  `(function(createInkTransition){${source};return mountHomeReturn;})`,
) as (
  create: () => { render: (progress: number) => void; dispose: () => void },
) => (
  actions: { navigate: (href: string) => void; prefetch: (href: string) => void },
  signal: AbortSignal,
) => void;
const render = vi.fn(),
  dispose = vi.fn(),
  navigate = vi.fn(),
  prefetch = vi.fn();
let controller: AbortController;
let tick: FrameRequestCallback;
let now = 0;
let reduced = false;
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  history.replaceState(null, '', '/#rules');
  document.body.innerHTML = '<a class="brand" href="/home?preview=1">論劍</a>';
  now = 0;
  reduced = false;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    tick = fn;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  controller = new AbortController();
  mount(() => ({ render, dispose }))({ navigate, prefetch }, controller.signal);
});
afterEach(() => {
  controller.abort();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function click(options = {}) {
  document
    .querySelector('a')!
    .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...options }));
}
it('墨水完全覆蓋才導覽，等待首頁 ready 才揭開；重複點擊只導覽一次', () => {
  click();
  click();
  expect(navigate).not.toHaveBeenCalled();
  now = 500;
  tick(now);
  expect(render).toHaveBeenLastCalledWith(0.5);
  expect(navigate).toHaveBeenCalledExactlyOnceWith('/home?preview=1');
  expect(document.documentElement.dataset.homeTransition).toBe('hold');
  vi.advanceTimersByTime(5000);
  expect(document.getElementById('home-return-ink')).not.toBeNull();
  document.dispatchEvent(new Event('lunjian:home-ready'));
  now = 1150;
  tick(now);
  expect(document.getElementById('home-return-ink')).toBeNull();
  expect(dispose).toHaveBeenCalledOnce();
});
it('Ctrl 點擊維持瀏覽器行為，首頁同頁品牌連結不重建場景', () => {
  click({ ctrlKey: true });
  expect(prefetch).not.toHaveBeenCalled();
  history.replaceState(null, '', '/home');
  click();
  expect(navigate).not.toHaveBeenCalled();
  expect(document.getElementById('home-return-ink')).toBeNull();
});
it('reduced-motion 不播墨水動畫，仍等場景 ready 才移除遮罩', () => {
  reduced = true;
  click();
  tick(0);
  expect(navigate).toHaveBeenCalledOnce();
  expect(render).not.toHaveBeenCalled();
  expect(document.getElementById('home-return-ink')).not.toBeNull();
  document.dispatchEvent(new Event('lunjian:home-ready'));
  tick(0);
  expect(document.getElementById('home-return-ink')).toBeNull();
});
it('載入逾時通知停止背景建立，揭幕後不留下阻擋操作的遮罩', () => {
  const fallback = vi.fn();
  document.addEventListener('lunjian:home-fallback', fallback, { once: true });
  click();
  now = 500;
  tick(now);
  vi.advanceTimersByTime(20000);
  expect(fallback).toHaveBeenCalledOnce();
  now = 1150;
  tick(now);
  expect(document.getElementById('home-return-ink')).toBeNull();
});
it('離頁中止會清掉墨幕、排程與 renderer', () => {
  click();
  controller.abort();
  vi.runAllTimers();
  expect(navigate).not.toHaveBeenCalled();
  expect(dispose).toHaveBeenCalledOnce();
  expect(document.getElementById('home-return-ink')).toBeNull();
});
