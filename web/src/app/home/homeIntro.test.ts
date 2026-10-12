import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const source = readFileSync('web/public/lunjian/home-intro.js', 'utf8').replace(
  'export function',
  'function',
);
const create = runInThisContext(`(function(){${source};return createHomeIntro;})()`) as (
  host: Element,
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
  enter: () => void,
) => { prepareFallback: () => Promise<void> };
let controller: AbortController;
let enter = vi.fn<() => void>();
beforeEach(() => {
  sessionStorage.clear();
  vi.useFakeTimers();
  controller = new AbortController();
  enter = vi.fn();
  document.body.innerHTML =
    '<div class="baiye-home"><canvas></canvas><header class="site-header"></header><main><div class="home-actions"><a href="#">了解賽制</a></div></main><div id="boot" tabindex="-1" hidden><div class="boot-loading"><progress id="load-progress"></progress><span id="load-number"></span><span id="load-label"></span></div><img><button id="ignite"></button></div></div>';
});
afterEach(() => {
  controller.abort();
  vi.useRealTimers();
  document.body.replaceChildren();
});
it('2D 同樣等待點燃、阻擋背景焦點，重複點擊只進站一次', async () => {
  const intro = create(
    document.querySelector('.baiye-home')!,
    document.querySelector('canvas')!,
    controller.signal,
    enter,
  );
  await intro.prepareFallback();
  const boot = document.querySelector<HTMLElement>('#boot')!;
  const button = document.querySelector<HTMLButtonElement>('#ignite')!;
  expect(document.querySelector('main')!.inert).toBe(true);
  expect(enter).not.toHaveBeenCalled();
  button.click();
  button.click();
  expect(boot.dataset.state).toBe('burning');
  await vi.advanceTimersByTimeAsync(5200);
  expect(enter).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem('lunjian:opening-seen:v1')).toBe('1');
  expect(document.querySelector('main')!.inert).toBe(false);
  expect(document.activeElement).toBe(document.querySelector('.home-actions a'));
});
it('燃燒中離頁，清除計時與 inert，不再觸發進站', async () => {
  const intro = create(
    document.querySelector('.baiye-home')!,
    document.querySelector('canvas')!,
    controller.signal,
    enter,
  );
  await intro.prepareFallback();
  document.querySelector<HTMLButtonElement>('#ignite')!.click();
  controller.abort();
  await vi.advanceTimersByTimeAsync(6000);
  expect(enter).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('lunjian:opening-seen:v1')).toBeNull();
  expect(document.body.hasAttribute('data-intro')).toBe(false);
  expect(document.querySelector('main')!.inert).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
