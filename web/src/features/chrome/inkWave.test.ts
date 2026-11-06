import { afterEach, expect, it, vi } from 'vitest';
import { mountInkWave, wavePath } from './inkWave';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { InkWaterSurface } from '../../../public/ink-water-surface.js';

let cleanup = () => {};
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function setup(reduce = false) {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,water');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    putImageData: vi.fn(),
    drawImage: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray([240, 230, 220, 255]) }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  } as unknown as CanvasRenderingContext2D);
  vi.stubGlobal('matchMedia', () => ({
    matches: reduce,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  document.body.innerHTML =
    '<button style="color: rgb(150, 40, 40)">送出<span>資料</span></button>';
  cleanup = mountInkWave();
  return document.querySelector('button')!;
}
it('refracts the entire original control before ink fills it and restores its filter on cleanup', () => {
  const el = setup();
  el.style.filter = 'brightness(0.95)';
  const content = [...el.childNodes];
  pointer(el);
  vi.advanceTimersByTime(80);
  expect(el.hasAttribute('data-ink-filled')).toBe(false);
  expect(el.querySelector<HTMLCanvasElement>('.water-light')!.style.clipPath).toBe('');
  expect(el.style.filter).toContain('brightness(0.95)');
  expect(el.style.filter).toContain('url(#ink-water-refraction-');
  expect(document.querySelector('feDisplacementMap')!.getAttribute('in')).toBe('SourceGraphic');
  expect([...el.childNodes].slice(0, content.length)).toEqual(content);
  window.dispatchEvent(new Event('blur'));
  expect(el.style.filter).toBe('brightness(0.95)');
  expect(document.querySelector('.water-refraction-defs')).toBeNull();
});
function pointer(el: Element, type = 'pointerover', pointerType = 'mouse') {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  el.dispatchEvent(event);
}
it('keeps bubbles moving while hovered, preserves click behavior and stops after exit', () => {
  const el = setup();
  const content = Array.from(el.childNodes);
  const click = vi.fn();
  el.addEventListener('click', click);
  pointer(el);
  vi.advanceTimersByTime(400);
  expect(el.querySelectorAll('.ink-g-bubbles ellipse')).toHaveLength(6);
  const fluid = el.querySelector('.ink-g-front');
  const label = el.querySelector('.ink-g-label');
  vi.advanceTimersByTime(320);
  expect(el.hasAttribute('data-ink-filled')).toBe(true);
  expect(el.querySelector('.ink-g-front')).toBe(fluid);
  expect(el.querySelector('.ink-g-label')).toBe(label);
  expect(Array.from(el.childNodes).slice(0, content.length)).toEqual(content);
  expect(el.querySelector('.ink-g-layer')!.getAttribute('aria-hidden')).toBe('true');
  expect(el.style.width).toBe('');
  el.click();
  expect(click).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(3200);
  expect(el.hasAttribute('data-ink-filled')).toBe(true);
  const bubble = el.querySelector('.ink-g-bubbles ellipse')!;
  const before = bubble.getAttribute('cy');
  vi.advanceTimersByTime(5000);
  expect(bubble.getAttribute('cy')).not.toBe(before);
  expect(vi.getTimerCount()).toBe(1);
  pointer(el, 'pointerout');
  vi.advanceTimersByTime(12000);
  expect(el.hasAttribute('data-ink-surface')).toBe(false);
  expect(el.hasAttribute('data-ink-filled')).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
it('handles dynamically mounted controls and skips disabled/loading/artwork controls', () => {
  setup();
  const el = document.createElement('button');
  document.body.append(el);
  el.disabled = true;
  pointer(el);
  expect(el.hasAttribute('data-ink-surface')).toBe(false);
  el.disabled = false;
  el.setAttribute('aria-busy', 'true');
  pointer(el);
  expect(el.hasAttribute('data-ink-surface')).toBe(false);
  el.removeAttribute('aria-busy');
  el.innerHTML = '<img alt="選手" />';
  pointer(el);
  expect(el.hasAttribute('data-ink-surface')).toBe(false);
  el.innerHTML = '新增';
  pointer(el);
  expect(el.dataset.inkSurface).toBe('g');
});
it('touch feedback clears without requiring pointerleave or blur', () => {
  const el = setup();
  pointer(el, 'pointerdown', 'touch');
  expect(el.dataset.inkSurface).toBe('g');
  vi.advanceTimersByTime(1000);
  expect(el.querySelector('.water-light')).not.toBeNull();
  pointer(el, 'pointerup', 'touch');
  vi.advanceTimersByTime(12000);
  expect(el.hasAttribute('data-ink-surface')).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
it('reduced motion uses an immediate still wash with no bubbles or animation loop', () => {
  const el = setup(true);
  pointer(el);
  expect(el.hasAttribute('data-ink-filled')).toBe(true);
  expect(el.querySelector('.ink-g-bubbles ellipse')!.getAttribute('opacity')).toBe('0');
  expect(vi.getTimerCount()).toBe(0);
  window.dispatchEvent(new Event('blur'));
  expect(el.hasAttribute('data-ink-surface')).toBe(false);
});
it('clears theme and selected-state snapshots so their semantic colors can update', async () => {
  const el = setup(true);
  pointer(el);
  document.documentElement.dataset.colorMode = 'dark';
  await Promise.resolve();
  expect(el.hasAttribute('data-ink-surface')).toBe(false);
  pointer(el);
  el.setAttribute('aria-pressed', 'true');
  await Promise.resolve();
  expect(el.hasAttribute('data-ink-surface')).toBe(false);
});
it('closes both wave shapes outside the button and fully covers it at completion', () => {
  expect(wavePath(0, 0)).toBe('');
  expect(wavePath(0.5, 0)).not.toBe(wavePath(0.5, 0, true));
  expect(wavePath(1, 0)).toContain('L320,110 L0,110Z');
});

it('uses a shallow right-leading tide and fully clears both ends', () => {
  const points = [...wavePath(0.37, 0.37 * 1.55).matchAll(/[ML]([\d.]+),(-?[\d.]+)/g)];
  const left = Number(points[0]![2]);
  const right = Number(points[64]![2]);
  expect(left - right).toBeGreaterThan(5);
  expect(left - right).toBeLessThan(40);
  for (const p of [...wavePath(1, 1.55).matchAll(/[ML]([\d.]+),(-?[\d.]+)/g)].slice(0, 65))
    expect(Number(p[2])).toBeLessThan(0);
});

it('click adds a finite ripple and burst without restarting the filled tide', () => {
  const el = setup();
  const animate = vi.fn(() => ({ cancel: vi.fn() }));
  el.animate = animate as unknown as typeof el.animate;
  pointer(el);
  vi.advanceTimersByTime(2000);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  vi.advanceTimersByTime(200);
  expect(animate).not.toHaveBeenCalled();
  expect(el.hasAttribute('data-ink-filled')).toBe(true);
  expect(el.querySelector('.water-light')).not.toBeNull();
  expect(el.querySelector('.ink-g-rings')).toBeNull();
  expect(el.querySelectorAll('.ink-g-burst ellipse')).toHaveLength(9);
  vi.advanceTimersByTime(1100);
  expect(el.querySelector('.water-light')).not.toBeNull();
  window.dispatchEvent(new Event('blur'));
  expect(el.querySelector('.ink-g-layer')).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});

it('discards the decorative text after a React update and preserves original handlers', async () => {
  setup(true);
  const click = vi.fn();
  const view = render(
    createElement('button', { onClick: click }, createElement('span', {}, '儲存')),
  );
  const el = view.getByRole('button', { name: '儲存' });
  pointer(el);
  expect(el.querySelector('.ink-g-layer')).not.toBeNull();
  view.rerender(createElement('button', { onClick: click }, createElement('span', {}, '已儲存')));
  await Promise.resolve();
  expect(el.querySelector('.ink-g-layer')).toBeNull();
  el.click();
  expect(click).toHaveBeenCalledOnce();
  expect(el.textContent).toBe('已儲存');
  view.unmount();
});

it('capture phase receives keyboard navigation even when a dialog stops bubbling', () => {
  const el = setup(true);
  el.addEventListener('keydown', (event) => event.stopPropagation());
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  expect(el.dataset.inkSurface).toBe('g');
  el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  expect(el.hasAttribute('data-ink-surface')).toBe(false);
});

it('uses A once on pointerdown, follows drag and releases without blocking the native click', () => {
  const el = setup();
  const press = vi.spyOn(InkWaterSurface.prototype, 'press');
  const pulse = vi.spyOn(InkWaterSurface.prototype, 'pulse');
  const move = vi.spyOn(InkWaterSurface.prototype, 'move');
  const release = vi.spyOn(InkWaterSurface.prototype, 'release');
  const click = vi.fn();
  el.addEventListener('click', click);
  pointer(el, 'pointerdown');
  expect(press).toHaveBeenCalledOnce();
  expect(pulse).toHaveBeenCalledOnce();
  // A decorative canvas must not exclude its owning button from subsequent events.
  pointer(el, 'pointermove');
  expect(move.mock.calls.length).toBeGreaterThan(1);
  pointer(el, 'pointerup');
  expect(release).not.toHaveBeenCalled();
  pointer(el, 'pointerout');
  expect(release).toHaveBeenCalledOnce();
  el.click();
  expect(click).toHaveBeenCalledOnce();
  expect(pulse).toHaveBeenCalledOnce();
  window.dispatchEvent(new Event('pointercancel'));
  expect(el.querySelector('canvas')).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});

it('starts water on hover, follows without a mouse button, and releases on exit', () => {
  const el = setup();
  const press = vi.spyOn(InkWaterSurface.prototype, 'press');
  const release = vi.spyOn(InkWaterSurface.prototype, 'release');
  pointer(el);
  expect(press).toHaveBeenCalledOnce();
  expect(el.querySelector('canvas')).not.toBeNull();
  pointer(el, 'pointermove');
  expect(press).toHaveBeenCalledTimes(2);
  pointer(el, 'pointerout');
  expect(release).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(12000);
  expect(el.querySelector('.ink-g-layer')).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});

it('leaves curtain ignition and navigation icon controls to their dedicated effects', () => {
  setup();
  for (const markup of [
    '<button id="ignite">點燃</button>',
    '<button class="lj-nav__close"><span></span><span></span></button>',
    '<button class="lj-nav__toggle">選單</button>',
  ]) {
    const host = document.createElement('div');
    host.innerHTML = markup;
    document.body.append(host);
    const button = host.querySelector('button')!;
    pointer(button);
    pointer(button, 'pointerdown');
    expect(button.querySelector('.ink-g-layer')).toBeNull();
  }
});

it('keyboard press keeps native semantics and reduced motion never allocates a water canvas', () => {
  const el = setup(true);
  const down = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
  el.dispatchEvent(down);
  expect(down.defaultPrevented).toBe(false);
  expect(el.querySelector('canvas')).toBeNull();
  el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
  el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  expect(el.hasAttribute('data-ink-surface')).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it('keeps visible bubbles moving above the water while held beyond the click burst', () => {
  const el = setup();
  pointer(el, 'pointerdown');
  vi.advanceTimersByTime(1500);
  const layer = el.querySelector('.ink-g-layer')!;
  expect([...layer.children].map((node) => node.classList[0])).toEqual([
    'ink-g-fluid',
    'water-light',
    'ink-g-fluid',
    'ink-g-label',
  ]);
  expect(layer.children[2]!.classList.contains('ink-g-particles')).toBe(true);
  const bubbles = [...el.querySelectorAll('.ink-g-bubbles ellipse')];
  expect(bubbles.some((node) => Number(node.getAttribute('opacity')) > 0.5)).toBe(true);
  const positions = bubbles.map((node) => node.getAttribute('cy'));
  vi.advanceTimersByTime(400);
  expect(bubbles.map((node) => node.getAttribute('cy'))).not.toEqual(positions);
  expect(el.querySelector('canvas')).not.toBeNull();
  pointer(el, 'pointerup');
});

it('keeps held links in the water gesture without replacing their navigation click', () => {
  setup();
  const el = document.createElement('a');
  el.href = '#water-test';
  el.style.display = 'block';
  el.textContent = '賽程';
  document.body.append(el);
  pointer(el, 'pointerdown');
  const drag = new Event('dragstart', { bubbles: true, cancelable: true });
  el.dispatchEvent(drag);
  expect(drag.defaultPrevented).toBe(true);
  pointer(el, 'pointerup');
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  el.dispatchEvent(click);
  expect(click.defaultPrevented).toBe(false);
});

it('keeps hover and click bubbles at 12–18 CSS pixels across control heights', () => {
  const el = setup();
  for (const height of [32, 56, 96]) {
    window.dispatchEvent(new Event('blur'));
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: 240 });
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: height });
    pointer(el);
    vi.advanceTimersByTime(100);
    for (const selector of ['.ink-g-bubbles ellipse', '.ink-g-burst ellipse']) {
      const circles = [...el.querySelectorAll(selector)];
      const diameters = circles.map(
        (node) => ((Number(node.getAttribute('ry')) * height) / 100) * 2,
      );
      expect(Math.min(...diameters)).toBeCloseTo(12);
      expect(Math.max(...diameters)).toBeCloseTo(18);
      circles.forEach((node, i) => {
        expect(((Number(node.getAttribute('rx')) * 240) / 320) * 2).toBeCloseTo(diameters[i]!);
      });
    }
  }
});

it('blocks first native link and image drags even after pointer cancellation clears the wave', () => {
  setup();
  const link = document.createElement('a');
  link.href = '#rules';
  link.innerHTML = '<span>規則說明</span><img alt="章節插圖">';
  document.body.append(link);
  for (const target of [link, link.querySelector('span')!, link.querySelector('img')!]) {
    const drag = new Event('dragstart', { bubbles: true, cancelable: true });
    target.dispatchEvent(drag);
    expect(drag.defaultPrevented).toBe(true);
  }
  pointer(link, 'pointerdown');
  window.dispatchEvent(new Event('pointercancel'));
  const drag = new Event('dragstart', { bubbles: true, cancelable: true });
  link.dispatchEvent(drag);
  expect(drag.defaultPrevented).toBe(true);
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  link.dispatchEvent(click);
  expect(click.defaultPrevented).toBe(false);

  link.draggable = true;
  const intentionalDrag = new Event('dragstart', { bubbles: true, cancelable: true });
  link.dispatchEvent(intentionalDrag);
  expect(intentionalDrag.defaultPrevented).toBe(false);
});
