import { afterEach, expect, it, vi } from 'vitest';
import { createLightPaperBurn, lightBurnFront } from './lightPaperBurn';

afterEach(() => vi.restoreAllMocks());
it('keeps a fixed buffer, starts at the clicked point and clears beyond every screen corner', () => {
  for (const origin of [
    { x: 400, y: 300 },
    { x: 0, y: 0 },
    { x: 800, y: 600 },
  ]) {
    const front = lightBurnFront(800, 600, origin);
    const start = front(0);
    expect(start.every((p) => p.x === origin.x && p.y === origin.y)).toBe(true);
    const middle = front(0.5);
    expect(middle).toBe(start);
    const distances = middle.map((p) => Math.hypot(p.x - origin.x, p.y - origin.y));
    expect(Math.max(...distances) / Math.min(...distances)).toBeGreaterThan(1.5);
    const final = front(1);
    const farthestCorner = Math.hypot(
      Math.max(origin.x, 800 - origin.x),
      Math.max(origin.y, 600 - origin.y),
    );
    expect(final.every((p) => Math.hypot(p.x - origin.x, p.y - origin.y) > farthestCorner)).toBe(
      true,
    );
  }
});
it('rasterizes sprites once, bounds drawing work and releases all backing stores', () => {
  const ctx = {
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  const sheet = document.createElement('canvas');
  sheet.width = 800;
  sheet.height = 600;
  const effect = createLightPaperBurn(
    ctx as unknown as CanvasRenderingContext2D,
    sheet,
    { x: 400, y: 300 },
    { soot: 'black', char: 'brown', flame: 'orange', core: 'white', smoke: 'gray', ash: 'gray' },
  );
  const gradients = ctx.createRadialGradient.mock.calls.length;
  for (let i = 0; i < 200; i++) effect.render(i / 200, i / 60);
  expect(ctx.createRadialGradient).toHaveBeenCalledTimes(gradients);
  expect(ctx.drawImage.mock.calls.length).toBeLessThanOrEqual(200 * 81);
  ctx.drawImage.mockClear();
  effect.render(1, 4);
  expect(ctx.drawImage).not.toHaveBeenCalled();
  effect.dispose();
  expect(sheet.width).toBe(0);
  expect(sheet.height).toBe(0);
});
