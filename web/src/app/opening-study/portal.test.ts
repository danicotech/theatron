import { expect, it } from 'vitest';
import { gsap } from 'gsap';
import { addPortal, portalMatrices } from './portal';

it.each([0, -4, 45])('keeps scenery upright and undistorted inside a %s° crop', (angle) => {
  const { window: m, image: n } = portalMatrices(
    { cx: 317, cy: 185, width: 190, height: 230, angle },
    904,
    375,
  );
  // Composition must be a translation: no stretch, shear or rotation of the landscape.
  expect(m[0]! * n[0]! + m[2]! * n[1]!).toBeCloseTo(1);
  expect(m[1]! * n[0]! + m[3]! * n[1]!).toBeCloseTo(0);
  expect(m[0]! * n[2]! + m[2]! * n[3]!).toBeCloseTo(0);
  expect(m[1]! * n[2]! + m[3]! * n[3]!).toBeCloseTo(1);
  expect(m[0]! * n[4]! + m[2]! * n[5]! + m[4]!).toBeCloseTo(317 - 452);
  expect(m[1]! * n[4]! + m[3]! * n[5]! + m[5]!).toBeCloseTo(185 - 187.5);
});

it.each([
  [1280, 720],
  [375, 844],
])('reveals the existing home without a replica at %sx%s', (width, height) => {
  const root = document.createElement('div');
  root.innerHTML = '<div data-live-veil><div data-portal-anchor></div></div>';
  Object.defineProperties(root, { clientWidth: { value: width }, clientHeight: { value: height } });
  const veil = root.querySelector<HTMLElement>('[data-live-veil]')!;
  const timeline = gsap.timeline({ paused: true });
  addPortal(timeline, root, 0);
  timeline.time(0.7);
  expect(veil.style.clipPath).toContain('polygon(evenodd');
  expect(veil.style.visibility).not.toBe('hidden');
  timeline.time(1.6);
  expect(veil.style.clipPath).toContain(`${width}px ${height}px`);
  timeline.progress(1);
  expect(veil.style.visibility).toBe('hidden');
  expect(root.querySelector('img')).toBeNull();
  timeline.kill();
});

it('matches the destination exactly when the window fills the stage', () => {
  const { window, image } = portalMatrices(
    { cx: 452, cy: 187.5, width: 904, height: 375, angle: 0 },
    904,
    375,
  );
  [window, image].forEach((matrix) =>
    matrix.forEach((value, i) => expect(value).toBeCloseTo([1, 0, 0, 1, 0, 0][i]!)),
  );
});

it('expands the selected portrait instead of the default large frame', () => {
  const root = document.createElement('div');
  root.innerHTML =
    '<div data-live-veil><div data-portal-anchor></div><a data-portal-selected></a></div>';
  Object.defineProperties(root, { clientWidth: { value: 1200 }, clientHeight: { value: 800 } });
  const selected = root.querySelector<HTMLElement>('[data-portal-selected]')!;
  selected.getBoundingClientRect = () =>
    ({ left: 900, top: 500, width: 130, height: 150 }) as DOMRect;
  const timeline = gsap.timeline({ paused: true });
  addPortal(timeline, root, 0, 0.5);
  timeline.time(0.32);
  const clip = root.querySelector<HTMLElement>('[data-live-veil]')!.style.clipPath;
  expect(clip).toContain('900px 500px');
  expect(clip).toContain('1030px 650px');
  timeline.kill();
});
