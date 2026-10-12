import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LUNJIAN_MARKUP } from './lunjianMarkup';

const source = readFileSync('web/public/lunjian/lunjian.js', 'utf8');
const element = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const click = (selector: string) => element(selector).click();
const silhouette = (side: string) =>
  element<HTMLButtonElement>(`#duel .duelist[data-side="${side}"]`);
const card = (side: string) => element(`#duel .fighter[data-side="${side}"]`);
const sheet = () => element('#psheet');
function key(target: EventTarget, value: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', {
    key: value,
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}
function pointer(type: string, clientX: number, clientY: number, pointerType = 'mouse') {
  const event = new MouseEvent(type, { clientX, clientY, bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  window.dispatchEvent(event);
}
function mount(prepare?: () => void) {
  document.body.innerHTML = LUNJIAN_MARKUP;
  prepare?.();
  runInThisContext(source);
}
function arenaGeometry() {
  vi.spyOn(element('#duel .arena-composition'), 'getBoundingClientRect').mockReturnValue(
    new DOMRect(80, 60, 1280, 760),
  );
  for (const [side, left] of [
    ['left', 100],
    ['right', 920],
  ] as const) {
    Object.defineProperties(silhouette(side), {
      offsetLeft: { configurable: true, value: left },
      offsetTop: { configurable: true, value: 180 },
      offsetWidth: { configurable: true, value: 260 },
      offsetHeight: { configurable: true, value: 440 },
    });
  }
}
const focus = (side: string) => Number(silhouette(side).style.getPropertyValue('--focus'));
function expectNoProximity() {
  expect(focus('left')).toBeLessThan(0.02);
  expect(focus('right')).toBeLessThan(0.02);
}

function expectAccessibleTrigger(target: HTMLElement) {
  expect(target.tagName === 'BUTTON' || target.getAttribute('role') === 'button').toBe(true);
  expect(target.tabIndex).toBe(0);
  expect(target.getAttribute('aria-label')).toContain('備戰方案');
}
function expectSheetOpen() {
  expect(sheet().hidden).toBe(false);
  expect(sheet().closest('[hidden]')).toBeNull();
  expect(sheet().closest('#vs')).toBeNull();
  expect(element('#psheet .dz-sheet').getAttribute('role')).toBe('dialog');
  expect(element('#psheet .dz-sheet').getAttribute('aria-modal')).toBe('true');
  expect(document.activeElement).toBe(element('#psheet .dz-close'));
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  history.replaceState(null, '', '/?mode=manage&stage=2d&intro=0#duel');
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('pointer: fine'),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal('innerWidth', 1440);
  vi.stubGlobal('innerHeight', 900);
  vi.stubGlobal('scrollTo', vi.fn());
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('anime', Object.assign(vi.fn(), { remove: vi.fn(), stagger: vi.fn() }));
  vi.stubGlobal('mountInk', vi.fn());
  vi.stubGlobal('playInk', vi.fn());
  vi.stubGlobal('inkVS', () => document.createElement('span'));
  vi.stubGlobal('INK', { load: () => Promise.resolve() });
});

afterEach(() => {
  window.__LUNJIAN?.destroy();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('比武黑影、腳邊資料與備戰詳情互動', () => {
  it('章名改為比武但保留 duel 錨點，黑影使用可聚焦原生按鈕', () => {
    mount();
    expect(element('.site-nav a[href="#duel"]').textContent).toBe('比武');
    expect(element('#duel [data-chapter-title]').dataset.chapterTitle).toBe('比武');
    expect(element('#duel .arena-composition').getAttribute('role')).toBe('group');
    for (const side of ['left', 'right']) {
      const target = silhouette(side);
      expect(target.tagName).toBe('BUTTON');
      expect(target.type).toBe('button');
      expect(target.getAttribute('aria-hidden')).not.toBe('true');
      expectAccessibleTrigger(target);
      expectAccessibleTrigger(card(side));
    }
  });

  it('未公布時兩側只呈現待評定與待公開，詳情不借用示範武器', () => {
    mount();
    for (const [side, name] of [
      ['left', '左方選手'],
      ['right', '右方選手'],
    ] as const) {
      expect(card(side).textContent).toContain(name);
      expect(card(side).textContent).toContain('待評定');
      expect(card(side).textContent).toContain('待公開');
      const target = silhouette(side);
      target.focus();
      target.click();
      expectSheetOpen();
      expect(element('#dz-title').textContent).toContain(name);
      expect(element('#dz-body').textContent).toContain('武器與裝備待公開');
      expect(element('#dz-body').textContent).not.toMatch(/危寂長劍|積矩九劍|百鬼打穴手|聞人夜/);
      key(document.activeElement!, 'Escape');
      expect(sheet().hidden).toBe(true);
      expect(document.activeElement).toBe(target);
    }
  });

  it.each(['before', 'live', 'after'])('%s 示範雙方可由黑影或基本資料查看完整備戰方案', (phase) => {
    mount();
    click(`[data-duel-preview="${phase}"]`);
    for (const [side, name] of [
      ['left', '左方俠客'],
      ['right', '右方俠客'],
    ] as const) {
      expect(card(side).textContent).toContain(name);
      expect(card(side).textContent).toContain('段位');
      for (const target of [silhouette(side), card(side)]) {
        expectAccessibleTrigger(target);
        target.focus();
        target.click();
        expectSheetOpen();
        expect(element('#dz-title').textContent).toContain(name);
        const content = element('#dz-body').textContent;
        for (const label of ['示範配置', '武器', '裝備', '武學', '心法', '奇術']) {
          expect(content).toContain(label);
        }
        key(document.activeElement!, 'Escape');
        expect(sheet().hidden).toBe(true);
        expect(document.activeElement).toBe(target);
      }
    }
  });

  it.each(['Enter', ' '])('%s 啟動黑影與資料卡，關閉後焦點回到原觸發點', (activation) => {
    mount();
    click('[data-duel-preview="live"]');
    for (const target of [silhouette('left'), card('right')]) {
      target.focus();
      expect(key(target, activation).defaultPrevented).toBe(true);
      expectSheetOpen();
      key(document.activeElement!, 'Escape');
      expect(sheet().hidden).toBe(true);
      expect(document.activeElement).toBe(target);
    }
  });

  it('面板中 Tab 在首尾操作循環，翻頁鍵不穿透切章', async () => {
    mount();
    click('[data-duel-preview="after"]');
    click('[data-duel-outcome="draw"]');
    silhouette('left').click();
    expectSheetOpen();
    const controls = [
      ...sheet().querySelectorAll<HTMLElement>('button:not([disabled]),a[href]'),
    ].filter((target) => target.tabIndex >= 0 && !target.closest('[hidden]'));
    expect(controls.length).toBeGreaterThanOrEqual(2);
    const first = controls[0]!;
    const last = controls.at(-1)!;
    last.focus();
    key(last, 'Tab');
    expect(document.activeElement).toBe(first);
    key(first, 'Tab', true);
    expect(document.activeElement).toBe(last);
    for (const action of ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']) {
      key(last, action);
      expect(location.hash).toBe('#duel');
      expect(document.querySelector('.chapter[data-on]')?.id).toBe('duel');
    }
    await vi.advanceTimersByTimeAsync(4000);
    expect(document.body.hasAttribute('data-cut')).toBe(false);
    expect(location.hash).toBe('#duel');
    expect(sheet().hidden).toBe(false);
  });

  it('人物各自依 XY 距離連續放大，進入 hitbox 前已有反應，同 X 越靠近越大', async () => {
    mount(arenaGeometry);
    // Stable, unscaled centers are left (310,460), right (1130,460).
    pointer('pointermove', 720, 0);
    await vi.advanceTimersByTimeAsync(1200);
    expectNoProximity();
    // y=160 is outside the left button (top=240), but within its influence radius.
    pointer('pointermove', 310, 160);
    await vi.advanceTimersByTimeAsync(1200);
    const outside = focus('left');
    expect(outside).toBeGreaterThan(0.1);
    expect(outside).toBeLessThan(0.8);
    expect(focus('right')).toBeLessThan(0.02);
    pointer('pointermove', 310, 310);
    await vi.advanceTimersByTimeAsync(1200);
    const closer = focus('left');
    expect(closer).toBeGreaterThan(outside);
    pointer('pointermove', 310, 460);
    await vi.advanceTimersByTimeAsync(1200);
    expect(focus('left')).toBeGreaterThan(closer);
    expect(focus('left')).toBeGreaterThan(0.95);
    expect(focus('left')).toBeLessThanOrEqual(1);
    pointer('pointermove', 1130, 460);
    await vi.advanceTimersByTimeAsync(1600);
    expect(focus('right')).toBeGreaterThan(0.95);
    expect(focus('left')).toBeLessThan(0.02);
  });

  it('觸控、離開與卸載都歸零人物距離效果，卸載後 pointermove 不再寫樣式', async () => {
    mount(arenaGeometry);
    pointer('pointermove', 310, 460);
    await vi.advanceTimersByTimeAsync(1200);
    expect(focus('left')).toBeGreaterThan(0.95);
    pointer('pointermove', 310, 460, 'touch');
    await vi.advanceTimersByTimeAsync(1600);
    expectNoProximity();
    pointer('pointermove', 1130, 460);
    await vi.advanceTimersByTimeAsync(1200);
    expect(focus('right')).toBeGreaterThan(0.95);
    pointer('pointerleave', 0, 0);
    await vi.advanceTimersByTimeAsync(1600);
    expectNoProximity();
    pointer('pointermove', 310, 460);
    await vi.advanceTimersByTimeAsync(1200);
    expect(focus('left')).toBeGreaterThan(0.95);
    window.__LUNJIAN!.destroy();
    expectNoProximity();
    const finalStyles = ['left', 'right'].map((side) => silhouette(side).getAttribute('style'));
    pointer('pointermove', 1130, 460);
    await vi.advanceTimersByTimeAsync(1600);
    expect(['left', 'right'].map((side) => silhouette(side).getAttribute('style'))).toEqual(
      finalStyles,
    );
  });

  it.each(['reading', 'reduced-motion'])(
    '%s 保留人物聚焦與詳情，但鍵盤及滑鼠都不放大人物',
    async (mode) => {
      if (mode === 'reading')
        history.replaceState(null, '', '/?view=reading&stage=2d&intro=0#duel');
      else
        vi.stubGlobal('matchMedia', (query: string) => ({
          matches: query.includes('pointer: fine') || query.includes('reduced-motion'),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }));
      mount(arenaGeometry);
      expect(document.body.classList.contains('reading')).toBe(true);
      const chapter = element('#duel');
      const left = silhouette('left');
      const right = card('right');
      left.focus();
      expect(chapter.dataset.focusSide).toBe('left');
      await vi.advanceTimersByTimeAsync(800);
      expectNoProximity();
      pointer('pointermove', 1130, 460);
      await vi.advanceTimersByTimeAsync(800);
      expect(chapter.dataset.focusSide).toBe('left');
      expectNoProximity();
      right.focus();
      expect(chapter.dataset.focusSide).toBe('right');
      expectNoProximity();
      right.click();
      expectSheetOpen();
      click('#psheet .dz-close');
      expect(sheet().hidden).toBe(true);
      expect(document.activeElement).toBe(right);
      expectNoProximity();
    },
  );

  it('鍵盤聚焦只標示人物而不放大，關閉還原焦點與卸載都清除互動', async () => {
    mount(arenaGeometry);
    const left = silhouette('left');
    const right = card('right');
    left.focus();
    expect(element('#duel').dataset.focusSide).toBe('left');
    await vi.advanceTimersByTimeAsync(800);
    expect(focus('left')).toBe(0);
    expect(focus('right')).toBe(0);
    right.focus();
    expect(element('#duel').dataset.focusSide).toBe('right');
    await vi.advanceTimersByTimeAsync(800);
    expect(focus('left')).toBe(0);
    expect(focus('right')).toBe(0);
    left.click();
    expectSheetOpen();
    click('#psheet .dz-close');
    expect(document.activeElement).toBe(left);
    await vi.advanceTimersByTimeAsync(800);
    expect(focus('left')).toBe(0);
    expect(focus('right')).toBe(0);
    left.click();
    expectSheetOpen();
    window.__LUNJIAN!.destroy();
    expect(sheet().hidden).toBe(true);
    left.click();
    right.click();
    key(left, 'Enter');
    expect(sheet().hidden).toBe(true);
    expect(window.__LUNJIAN).toBeUndefined();
  });
});

it('公開模式不啟動人物試看，也不輸出模擬下注或假配裝', () => {
  history.replaceState(null, '', '/?preview=1&phase=live&stage=2d&intro=0#duel');
  mount();
  const before = element('#duel-name-l').textContent;
  click('[data-duel-preview="after"]');
  expect(element('#duel-name-l').textContent).toBe(before);
  click('#duel .fighter[data-side="left"]');
  expect(element('#dz-body').textContent).toContain('武器與裝備待公開');
  expect(element('#dz-body').querySelector('img')).toBeNull();
  expect(element('#dz-body').textContent).not.toContain('模擬下注');
});
