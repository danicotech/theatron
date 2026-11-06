import { afterEach, expect, it, vi } from 'vitest';
import { createNavigationMotion } from './navigationMotion';

vi.mock('gsap', () => ({
  gsap: {
    context: () => ({ add: (fn: () => void) => fn(), revert: vi.fn() }),
    to: vi.fn(),
    set: vi.fn(),
    killTweensOf: vi.fn(),
    timeline: () => ({ fromTo: vi.fn(), to: vi.fn(), kill: vi.fn() }),
  },
}));
let cleanup = () => {};
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup() {
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  document.body.innerHTML = '<header><dialog><a href="#rules">規則</a></dialog></header>';
  const root = document.querySelector('header')!;
  const link = document.querySelector('a')!;
  const motion = createNavigationMotion(root, document.querySelector('dialog')!);
  cleanup = () => motion.destroy();
  const pointer = (type: string, pointerType = 'mouse') => {
    const event = new Event(type, { bubbles: true });
    Object.defineProperties(event, { pointerType: { value: pointerType }, button: { value: 0 } });
    link.dispatchEvent(event);
  };
  return { link, motion, pointer };
}

it('clears hover when leaving, closing and reopening a drawer', () => {
  const { link, motion, pointer } = setup();
  pointer('pointerenter');
  expect(link.hasAttribute('data-nav-hover')).toBe(true);
  pointer('pointerleave');
  expect(link.hasAttribute('data-nav-hover')).toBe(false);
  pointer('pointerenter');
  motion.close(() => {});
  expect(link.hasAttribute('data-nav-hover')).toBe(false);
  motion.open();
  expect(link.hasAttribute('data-nav-hover')).toBe(false);
});

it('touch focus does not masquerade as hover, but keyboard focus is retained', () => {
  const { link, pointer } = setup();
  const original = link.matches.bind(link);
  let keyboard = false;
  vi.spyOn(link, 'matches').mockImplementation((selector) =>
    selector === ':focus-visible' ? keyboard : original(selector),
  );
  pointer('pointerenter', 'touch');
  link.dispatchEvent(new FocusEvent('focus'));
  expect(link.hasAttribute('data-nav-hover')).toBe(false);
  keyboard = true;
  link.dispatchEvent(new FocusEvent('focus'));
  expect(link.hasAttribute('data-nav-hover')).toBe(true);
  keyboard = false;
  link.dispatchEvent(new FocusEvent('blur'));
  expect(link.hasAttribute('data-nav-hover')).toBe(false);
});

it('clears stale mouse hover on touch, pointer cancellation and window blur', () => {
  const { link, pointer } = setup();
  for (const cancel of [
    () => pointer('pointerdown', 'touch'),
    () => window.dispatchEvent(new Event('pointercancel')),
    () => window.dispatchEvent(new Event('blur')),
  ]) {
    pointer('pointerenter');
    expect(link.hasAttribute('data-nav-hover')).toBe(true);
    cancel();
    expect(link.hasAttribute('data-nav-hover')).toBe(false);
  }
});
