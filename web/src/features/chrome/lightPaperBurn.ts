import type { BurnPigments, BurnPoint } from './paperBurn';

const RAYS = 80;
/** A fixed-size, connected, uneven front. No grid search or contour allocation per frame. */
export function lightBurnFront(width: number, height: number, origin: BurnPoint) {
  const cx = Math.max(0, Math.min(width, origin.x));
  const cy = Math.max(0, Math.min(height, origin.y));
  const distance = Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy));
  const rays = Array.from({ length: RAYS }, (_, i) => {
    const angle = (i / RAYS) * Math.PI * 2;
    return {
      x: Math.cos(angle),
      y: Math.sin(angle),
      // Uneven fibre fronts, with faster upward spread; never a circular aperture.
      speed:
        1.12 +
        0.2 * Math.sin(angle * 3 + 0.8) +
        0.1 * Math.sin(angle * 7 + 2) +
        0.055 * Math.sin(angle * 13) -
        0.16 * Math.sin(angle),
    };
  });
  const points = rays.map(() => ({ x: cx, y: cy }));
  return (progress: number) => {
    const expansion = Math.max(0, Math.min(1, progress)) * distance * 2.05;
    for (let i = 0; i < RAYS; i++) {
      const ray = rays[i]!,
        point = points[i]!;
      point.x = cx + ray.x * expansion * ray.speed;
      point.y = cy + ray.y * expansion * ray.speed;
    }
    return points;
  };
}

/** Rasterize the static fabric once, using the existing palette and silhouette asset. */
export function cacheOpeningFabric(boot: HTMLElement, width: number, height: number) {
  const sheet = document.createElement('canvas');
  sheet.width = width;
  sheet.height = height;
  const ctx = sheet.getContext('2d');
  if (!ctx) return sheet;
  const colors = getComputedStyle(boot);
  const ink = colors.getPropertyValue('--ink').trim();
  const paper = colors.getPropertyValue('--paper').trim();
  const faint = colors.getPropertyValue('--paper-faint').trim();
  // The CSS fabric is an opaque radial gradient, so no full-size duel decode is needed.
  ctx.save();
  ctx.scale(width, height);
  const shade = ctx.createRadialGradient(0.7, 0.4, 0, 0.7, 0.4, 0.82);
  shade.addColorStop(0, faint);
  shade.addColorStop(1, ink);
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 1, 1);
  ctx.restore();
  const density = width / (boot.clientWidth || innerWidth);
  ctx.fillStyle = paper;
  ctx.globalAlpha = 0.035;
  for (let x = 0; x < width; x += Math.max(2, 4 * density))
    ctx.fillRect(x, 0, Math.max(0.5, density), height);
  ctx.globalAlpha = 1;
  const image = boot.querySelector<HTMLImageElement>('#boot-shadows');
  if (image?.complete && image.naturalWidth) {
    const shadow = document.createElement('canvas');
    const sw = Math.min(height * 1.08, width * 1.12),
      sh = (sw * 683) / 1024;
    shadow.width = Math.ceil(sw);
    shadow.height = Math.ceil(sh);
    const sc = shadow.getContext('2d');
    if (sc) {
      sc.drawImage(image, 0, 0, sw, sh);
      sc.globalCompositeOperation = 'source-in';
      sc.fillStyle = ink;
      sc.fillRect(0, 0, sw, sh);
      ctx.globalAlpha = 0.92;
      ctx.drawImage(shadow, (width - sw) / 2, height / 2 - sh * 0.55, sw, sh);
      ctx.globalAlpha = 1;
    }
    shadow.width = shadow.height = 0;
  }
  return sheet;
}

/** One bounded canvas, one cutout path, and cached fire/smoke sprites. No DOM updates. */
export function createLightPaperBurn(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLCanvasElement,
  origin: BurnPoint,
  colors: BurnPigments,
) {
  const width = sheet.width,
    height = sheet.height;
  const front = lightBurnFront(width, height, origin);
  const sprite = (smoke: boolean) => {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 64;
    const c = canvas.getContext('2d');
    if (c) {
      const gradient = c.createRadialGradient(24, smoke ? 32 : 49, 1, 24, 32, 30);
      gradient.addColorStop(0, smoke ? colors.smoke : colors.core);
      gradient.addColorStop(0.25, smoke ? colors.smoke : colors.flame);
      gradient.addColorStop(1, 'transparent');
      c.fillStyle = gradient;
      c.fillRect(0, 0, 48, 64);
    }
    return canvas;
  };
  const flame = sprite(false),
    smoke = sprite(true);
  const path = (points: BurnPoint[]) => {
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    });
    ctx.closePath();
  };
  return {
    render(progress: number, time: number) {
      ctx.clearRect(0, 0, width, height);
      if (progress >= 1) return;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(sheet, 0, 0);
      if (progress <= 0) return;
      const points = front(Math.min(1, progress * 1.18));
      ctx.globalCompositeOperation = 'destination-out';
      path(points);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      const fade = Math.min(1, (1 - progress) * 6);
      // At most 40 sites, each drawing pre-rasterized sprites, never live gradients.
      for (let i = 0; i < points.length; i += 2) {
        const p = points[i]!;
        if (p.x < -20 || p.x > width + 20 || p.y < -40 || p.y > height + 50) continue;
        const pulse = 0.5 + 0.5 * Math.sin(time * 11 + i * 2.4);
        const size = 10 + pulse * 9;
        ctx.globalAlpha = fade * 0.55;
        ctx.drawImage(smoke, p.x - size, p.y - size * 2, size * 2, size * 2.5);
        ctx.globalAlpha = fade * (0.55 + pulse * 0.3);
        ctx.drawImage(flame, p.x - size * 0.45, p.y - size * 1.7, size, size * 2);
        if (i % 6 === 0) {
          const drift = (time * 0.7 + i * 0.13) % 1;
          ctx.globalAlpha = fade * (1 - drift) * 0.7;
          ctx.fillStyle = colors.ash;
          ctx.fillRect(p.x + Math.sin(i) * drift * 15, p.y - drift * 45, 1.5, 2);
        }
      }
      ctx.globalAlpha = 1;
    },
    dispose() {
      sheet.width = sheet.height = flame.width = flame.height = smoke.width = smoke.height = 0;
    },
  };
}
