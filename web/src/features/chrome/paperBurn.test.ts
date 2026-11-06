import { expect, it } from 'vitest';
import { createBurnField } from './paperBurn';

it('ignites at the actual pointer, including edge and mobile positions', () => {
  for (const [width, height, x, y] of [
    [1280, 720, 219, 461],
    [390, 844, 1, 840],
  ]) {
    const field = createBurnField(width!, height!, { x: x!, y: y! });
    expect(field.points[field.start]!.x).toBeCloseTo(x!);
    expect(field.points[field.start]!.y).toBeCloseTo(y!);
    expect(field.arrival[field.start]).toBe(0);
    expect(field.contours(0.001).flat().length).toBeGreaterThan(2);
    expect(field.arrival.every(Number.isFinite)).toBe(true);
    // All visible paper is consumed before the smoke-tail phase.
    field.points.forEach((point, i) => {
      if (point.x >= 0 && point.x <= width! && point.y >= 0 && point.y <= height!)
        expect(field.arrival[i]).toBeLessThanOrEqual(1);
    });
  }
});

it('uses unequal fibre arrival times rather than equal-radius ring expansion', () => {
  const field = createBurnField(1200, 800, { x: 600, y: 400 });
  const nearby = (x: number, y: number) => {
    let closest = 0,
      distance = Infinity;
    field.points.forEach((point, i) => {
      const d = Math.hypot(point.x - x, point.y - y);
      if (d < distance) {
        distance = d;
        closest = i;
      }
    });
    return field.arrival[closest]!;
  };
  const arrivals = [nearby(400, 400), nearby(800, 400), nearby(600, 200), nearby(600, 600)];
  expect(Math.max(...arrivals) / Math.min(...arrivals)).toBeGreaterThan(1.5);
  expect(nearby(600, 200)).toBeLessThan(nearby(600, 600));
});
