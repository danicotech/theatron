import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { gsap } from 'gsap';
import OpeningStudy from './study';
import { OPENINGS } from './motion';

let reduced = false;
let motionChanged: (() => void) | undefined;
beforeEach(() => {
  reduced = false;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  history.replaceState(null, '', '/opening-study#A');
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return reduced;
    },
    addEventListener: (_: string, fn: () => void) => {
      motionChanged = fn;
    },
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

it.each(OPENINGS)(
  '$id can seek to a clean destination and back without residual text',
  async ({ id, name }) => {
    history.replaceState(null, '', `/opening-study#${id}`);
    const view = render(<OpeningStudy />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: `播放 ${id} ${name}` })).toBeEnabled(),
    );
    const copy = view.container.querySelector<HTMLElement>('[data-home-copy]')!;
    const intro = view.container.querySelector<HTMLElement>('[data-intro-copy]')!;
    expect(Number(gsap.getProperty(copy, 'opacity'))).toBe(0);
    fireEvent.input(screen.getByRole('slider'), { target: { value: '100' } });
    expect(Number(gsap.getProperty(copy, 'opacity'))).toBe(1);
    expect(Number(gsap.getProperty(intro, 'opacity'))).toBe(0);
    fireEvent.input(screen.getByRole('slider'), { target: { value: '0' } });
    expect(Number(gsap.getProperty(copy, 'opacity'))).toBe(0);
    expect(Number(gsap.getProperty(intro, 'opacity'))).toBe(1);
    view.unmount();
    expect(gsap.getTweensOf(copy)).toHaveLength(0);
  },
);

it('switches midway, retains playback rate and keeps selection inside the study', async () => {
  const view = render(<OpeningStudy />);
  await waitFor(() => expect(screen.getByRole('button', { name: '重播 ↻' })).toBeEnabled());
  fireEvent.input(screen.getByRole('slider'), { target: { value: '45' } });
  const oldLayer = view.container.querySelector('[data-mist-top]')!;
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '0.5' } });
  fireEvent.click(screen.getByRole('button', { name: /B\s*留白開境/ }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '播放 B 留白開境' })).toBeEnabled(),
  );
  expect(gsap.getTweensOf(oldLayer)).toHaveLength(0);
  expect(screen.getByRole('combobox')).toHaveValue('0.5');
  fireEvent.click(screen.getByRole('button', { name: /暫選這款/ }));
  expect(screen.getByText(/暫選 B ·/)).toBeInTheDocument();
  expect(location.pathname).toBe('/opening-study');
  expect(location.hash).toBe('#B');
});

it.each(['A', 'I'])('rebuilds %s as a short fade when reduced motion changes', async (id) => {
  history.replaceState(null, '', `/opening-study#${id}`);
  const view = render(<OpeningStudy />);
  await waitFor(() => expect(screen.getByRole('button', { name: '重播 ↻' })).toBeEnabled());
  act(() => {
    reduced = true;
    motionChanged?.();
  });
  await waitFor(() => expect(screen.getByRole('button', { name: '重播 ↻' })).toBeEnabled());
  expect(screen.getByText(/目前依裝置偏好使用淡入淡出/)).toBeInTheDocument();
  fireEvent.input(screen.getByRole('slider'), { target: { value: '100' } });
  expect(view.container.querySelector<HTMLElement>('[data-cover]')!.style.opacity).toBe('0');
  if (id === 'I') {
    expect(
      Number(gsap.getProperty(view.container.querySelector('[data-portal-outline]'), 'opacity')),
    ).toBe(0);
    expect(
      Number(gsap.getProperty(view.container.querySelector('[data-portrait-person]'), 'yPercent')),
    ).toBe(0);
  }
});

it('keeps I artwork separate, registered and reversible through the frame transition', async () => {
  history.replaceState(null, '', '/opening-study#I');
  const view = render(<OpeningStudy />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '播放 I 赤影縱刊' })).toBeEnabled(),
  );
  const stage = view.container.querySelector('[data-variant="I"]')!;
  expect(stage.querySelectorAll('canvas')).toHaveLength(0);
  expect(new Set([...stage.querySelectorAll('img')].map((img) => img.getAttribute('src')))).toEqual(
    new Set([
      '/opening-art/v1/background.webp',
      '/opening-art/v2/hero-left.webp',
      '/opening-art/v1/foreground.webp',
      '/opening-art/v2/portrait-a.webp',
      '/opening-art/v2/portrait-white.webp',
      '/lunjian/art/bg/scene-gate.webp',
      '/lunjian/art/fg-bamboo.webp',
      '/lunjian/art/fg-plum-branch-v3.webp',
      '/lunjian/art/fg-snow-pine.webp',
      '/lunjian/art/fg-snow-plum.webp',
    ]),
  );
  expect(stage.querySelector('[data-wire-background]')).not.toBeNull();
  expect(stage.querySelector('[data-wire-person]')).not.toBeNull();
  expect(
    [...stage.querySelectorAll('[data-layer]')].map((node) => node.getAttribute('data-layer')),
  ).toEqual(['0', '10', '20', '30', '35', '36', '40', '50', '60']);
  const people = stage.querySelectorAll('[data-person-art]');
  expect(people).toHaveLength(3);
  expect(people[0]!.getAttribute('src')).toBe(people[1]!.getAttribute('src'));
  expect(people[0]!.getAttribute('src')).toBe(people[2]!.getAttribute('src'));
  fireEvent.input(screen.getByRole('slider'), { target: { value: '50' } });
  const copies = stage.querySelectorAll('[data-wire-person]');
  expect(gsap.getProperty(copies[0]!, 'xPercent')).toBe(gsap.getProperty(copies[1]!, 'xPercent'));
  expect(Number(gsap.getProperty(stage.querySelector('[data-portal]'), 'opacity'))).toBe(1);
  fireEvent.input(screen.getByRole('slider'), { target: { value: '100' } });
  expect(Number(gsap.getProperty(stage.querySelector('[data-editorial]'), 'opacity'))).toBe(0);
  expect(Number(gsap.getProperty(stage.querySelector('[data-portal-outline]'), 'opacity'))).toBe(0);
  fireEvent.input(screen.getByRole('slider'), { target: { value: '0' } });
  expect(Number(gsap.getProperty(stage.querySelector('[data-wire-main-edge]'), 'opacity'))).toBe(1);
  expect(Number(gsap.getProperty(stage.querySelector('[data-wire-breakout]'), 'opacity'))).toBe(1);
  for (const person of stage.querySelectorAll('[data-portrait-person]')) {
    expect(Number(gsap.getProperty(person, 'opacity'))).toBe(1);
    expect(Number(gsap.getProperty(person, 'yPercent'))).toBe(0);
  }
  view.unmount();
});
