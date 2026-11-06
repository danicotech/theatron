/** G: opaque inverse ink, with a second text rendering clipped to the same wave.
 * Original children and event handlers stay in place; decoration is inert and disposable. */
import { InkWaterSurface } from '../../../public/ink-water-surface.js';
export const INK_CONTROLS = 'button, summary, a[href]';
const EXCLUDED =
  '[data-help], button[aria-label^="關閉"], [data-ink-close], [data-ink-wave="off"], #ignite, .duelist, .vs-fig, .fighter, .lj-nav__brand, .lj-nav__close, .lj-nav__toggle';
const DURATION = 1.55;
const PLAYBACK_RATE = 2.25;
const BUBBLE_RADII = [6, 7.5, 9] as const;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => value * value * (3 - 2 * value);
let sequence = 0;
type Wave = {
  element: HTMLElement;
  fill: number;
  phase: number;
  target: number;
  pointer: boolean;
  keyboard: boolean;
  layer: HTMLElement;
  label: HTMLElement;
  position: string;
  aspect: number;
  height: number;
  front: SVGPathElement;
  back: SVGPathElement;
  clip: SVGPathElement;
  bubbles: SVGEllipseElement[];
  water?: InkWaterSurface;
  pointerId?: number;
  pressBox?: DOMRect;
  pressing: boolean;
  pressedClick: boolean;
  burst: SVGEllipseElement[];
  drawnFill: number;
  clickAge: number;
  clickX: number;
  clickY: number;
};

export function wavePath(fill: number, phase: number, back = false) {
  if (fill <= 0) return '';
  const points = Array.from({ length: 65 }, (_, i) => {
    const x = i / 64;
    const local = clamp((fill * DURATION - (1 - x) * 0.2 + (back ? 0.045 : 0)) / 1.12);
    const envelope = Math.sin(Math.PI * local);
    const ripple =
      (Math.sin(x * 9.2 - phase * 7.3 + (back ? 1.3 : 0)) * 3.6 +
        Math.sin(x * 17 + phase * 3) * 1.1) *
      envelope;
    const y = 107 - 114 * ease(local) + ripple + Math.sin(local * Math.PI * 3) * 2.2 * envelope;
    return `${i ? 'L' : 'M'}${i * 5},${y.toFixed(2)}`;
  });
  return `${points.join(' ')} L320,110 L0,110Z`;
}

function ellipse(
  node: SVGEllipseElement,
  x: number,
  y: number,
  rx: number,
  ry: number,
  opacity: number,
) {
  for (const [key, value] of Object.entries({ cx: x, cy: y, rx, ry, opacity }))
    node.setAttribute(key, String(value));
}

export function mountInkWave() {
  const lifetime = new AbortController();
  const options = { signal: lifetime.signal, capture: true };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const waves = new Map<HTMLElement, Wave>();
  const active = new Set<Wave>();
  let frame = 0;
  let last = 0;
  let keyboardInput = false;
  const blocked = (el: HTMLElement) =>
    el.matches(':disabled, [aria-disabled="true"], [aria-busy="true"]') ||
    !!el.closest('[hidden], [inert], dialog:not([open])');
  const find = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return null;
    const el = target.closest<HTMLElement>(INK_CONTROLS);
    if (!el || el.matches(EXCLUDED) || el.closest('[data-ink-wave="off"]')) return null;
    // Inline prose and artwork are not action surfaces. Keep their existing treatment.
    if (
      el.querySelector('img, canvas:not(.water-light), video') &&
      !el.hasAttribute('data-ink-variant')
    )
      return null;
    if (el.querySelector('input, select, textarea, button, a[href]')) return null;
    if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') return null;
    return el;
  };
  const clear = (wave: Wave) => {
    wave.water?.destroy();
    active.delete(wave);
    waves.delete(wave.element);
    wave.layer.remove();
    if (wave.element.hasAttribute('data-ink-position')) {
      wave.element.style.position = wave.position;
      wave.element.removeAttribute('data-ink-position');
    }
    wave.element.removeAttribute('data-ink-surface');
    wave.element.removeAttribute('data-ink-filled');
    for (const prop of ['--ink-original-bg', '--ink-original-color'])
      wave.element.style.removeProperty(prop);
  };
  const reset = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    for (const wave of waves.values()) clear(wave);
  };
  const draw = (wave: Wave) => {
    wave.element.toggleAttribute('data-ink-filled', wave.target === 1 && wave.fill === 1);
    // Once filled, only the reusable bubble nodes move; the wave and label stop repainting.
    if (wave.drawnFill !== wave.fill) {
      const front = wavePath(wave.fill, wave.fill * DURATION);
      wave.front.setAttribute('d', front);
      wave.clip.setAttribute('d', front);
      wave.back.setAttribute('d', wavePath(wave.fill, wave.fill * DURATION, true));
      const points = Array.from(
        front.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g),
        (m) => `${Number(m[1]) / 3.2}% ${Number(m[2])}%`,
      );
      wave.label.style.clipPath = points.length
        ? `polygon(${points.join(',')})`
        : 'inset(100% 0 0)';
      wave.drawnFill = wave.fill;
    }
    const ratio = 3.2 / wave.aspect;
    const fade = reduced.matches ? 0 : clamp((wave.fill * DURATION) / 0.3);
    wave.bubbles.forEach((node, i) => {
      const p = (wave.phase * (0.29 + i * 0.014) + i * 0.163) % 1;
      const r = (BUBBLE_RADII[i % BUBBLE_RADII.length]! * 100) / wave.height;
      ellipse(
        node,
        24 + i * 54 + Math.sin(wave.phase * 1.8 + i) * 4,
        108 - p * 119,
        r * ratio,
        r,
        fade * Math.min(1, p * 9, (1 - p) * 7),
      );
    });
    const impact = clamp(wave.clickAge / 0.85);
    const visible = wave.clickAge < 1 && !reduced.matches;
    wave.burst.forEach((node, i) => {
      const r = (BUBBLE_RADII[i % BUBBLE_RADII.length]! * 100) / wave.height;
      ellipse(
        node,
        wave.clickX + (i - 4) * 8 * ease(impact),
        wave.clickY - impact * (38 + (i % 3) * 14),
        r * ratio,
        r,
        visible ? Math.sin(Math.PI * impact) * 0.95 : 0,
      );
    });
  };
  const tick = (now: number) => {
    frame = 0;
    const waterDt = Math.min((now - (last || now - 16)) / 1000, 0.035);
    const dt = waterDt * PLAYBACK_RATE;
    last = now;
    for (const wave of active) {
      if (!wave.element.isConnected || blocked(wave.element)) {
        clear(wave);
        continue;
      }
      wave.fill = clamp(wave.fill + (wave.target ? dt : -dt) / DURATION);
      wave.phase += dt;
      wave.clickAge = Math.min(2, wave.clickAge + dt);
      if (wave.water?.active) wave.water.step(waterDt);
      draw(wave);
      if (!wave.target && wave.fill === 0 && wave.clickAge >= 1 && !wave.water?.active) clear(wave);
    }
    if (active.size) frame = requestAnimationFrame(tick);
    else last = 0;
  };
  const settle = (wave: Wave) => {
    const target =
      !blocked(wave.element) && (wave.pointer || wave.keyboard || wave.pressing) ? 1 : 0;
    if (wave.target === target && active.has(wave)) return;
    wave.target = target;
    if (reduced.matches) {
      wave.fill = target;
      if (!target) clear(wave);
      else draw(wave);
      return;
    }
    active.add(wave);
    if (!frame) frame = requestAnimationFrame(tick);
  };
  const get = (el: HTMLElement) => {
    let wave = waves.get(el);
    if (!wave) {
      const css = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      const position = el.style.position;
      const label = document.createElement('span');
      label.className = 'ink-g-label';
      for (const node of el.childNodes) label.append(node.cloneNode(true));
      label.querySelectorAll('*').forEach((node) => {
        node.removeAttribute('id');
        node.removeAttribute('name');
        node.removeAttribute('autofocus');
        node.removeAttribute('aria-controls');
        node.removeAttribute('aria-labelledby');
        node.removeAttribute('aria-describedby');
      });
      for (const prop of [
        'display',
        'padding-top',
        'padding-right',
        'padding-bottom',
        'padding-left',
        'gap',
        'align-items',
        'justify-content',
        'flex-direction',
        'flex-wrap',
        'grid-template-columns',
        'grid-template-rows',
        'text-align',
        'font',
        'letter-spacing',
        'text-transform',
        'white-space',
      ]) {
        label.style.setProperty(prop, css.getPropertyValue(prop));
      }
      const layer = document.createElement('span');
      layer.className = 'ink-g-layer';
      layer.setAttribute('aria-hidden', 'true');
      layer.inert = true;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const clipId = `ink-g-wave-${++sequence}`;
      svg.setAttribute('viewBox', '0 0 320 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.classList.add('ink-g-fluid');
      svg.innerHTML = `<defs><clipPath id="${clipId}"><path/></clipPath></defs><path class="ink-g-back ink-g-fill"/><path class="ink-g-front ink-g-fill"/>`;
      const particles = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      particles.setAttribute('viewBox', '0 0 320 100');
      particles.setAttribute('preserveAspectRatio', 'none');
      particles.classList.add('ink-g-fluid', 'ink-g-particles');
      particles.innerHTML = `<g class="ink-g-bubbles" clip-path="url(#${clipId})">${'<ellipse/>'.repeat(6)}</g><g class="ink-g-burst" clip-path="url(#${clipId})">${'<ellipse/>'.repeat(9)}</g>`;
      layer.append(svg, particles, label);
      el.style.setProperty('--ink-original-bg', css.backgroundColor);
      el.style.setProperty('--ink-original-color', css.color);
      el.setAttribute('data-ink-surface', 'g');
      if (css.position === 'static' || !css.position) {
        el.style.position = 'relative';
        el.setAttribute('data-ink-position', '');
      }
      el.append(layer);
      layer.style.color = 'var(--ink-g-on-fill)';
      wave = {
        element: el,
        fill: 0,
        phase: 0,
        target: 0,
        pointer: false,
        keyboard: false,
        layer,
        label,
        position,
        aspect: (el.clientWidth || box.width || 4) / (el.clientHeight || box.height || 1),
        height: el.clientHeight || box.height || 1,
        front: svg.querySelector<SVGPathElement>('.ink-g-front')!,
        back: svg.querySelector<SVGPathElement>('.ink-g-back')!,
        clip: svg.querySelector<SVGPathElement>('clipPath path')!,
        bubbles: Array.from(
          particles.querySelectorAll<SVGEllipseElement>('.ink-g-bubbles ellipse'),
        ),
        pressing: false,
        pressedClick: false,
        burst: Array.from(particles.querySelectorAll<SVGEllipseElement>('.ink-g-burst ellipse')),
        drawnFill: -1,
        clickAge: 2,
        clickX: 160,
        clickY: 50,
      };
      draw(wave);
      waves.set(el, wave);
    }
    return wave;
  };
  const water = (wave: Wave) => {
    if (reduced.matches) return;
    if (!wave.water) {
      try {
        wave.water = new InkWaterSurface(wave.layer, { variant: 'a', refract: wave.element });
        // Full-button water is independent of the fill mask. Both original and
        // inverted text are refracted together through the shared height field.
        wave.layer.insertBefore(wave.water.canvas, wave.layer.querySelector('.ink-g-particles'));
      } catch {
        // Keep the original action and ink fill usable without Canvas support.
        return;
      }
    }
    return wave.water;
  };
  const press = (wave: Wave, x: number, y: number) => {
    wave.pressing = true;
    wave.pressedClick = true;
    wave.clickX = x * 320;
    wave.clickY = y * 100;
    wave.clickAge = 0;
    wave.fill = Math.max(wave.fill, 0.6);
    water(wave)?.press(x, y);
    settle(wave);
    draw(wave);
  };
  const release = (wave: Wave, keepHover = false) => {
    wave.pressing = false;
    delete wave.pointerId;
    if (!keepHover) wave.water?.release();
    settle(wave);
  };
  document.addEventListener(
    'pointerover',
    (event) => {
      const el = find(event.target);
      if (
        !el ||
        event.pointerType === 'touch' ||
        blocked(el) ||
        (event.relatedTarget instanceof Node && el.contains(event.relatedTarget))
      )
        return;
      const wave = get(el);
      wave.pointer = true;
      wave.pressBox = el.getBoundingClientRect();
      const box = wave.pressBox;
      water(wave)?.press(
        Number.isFinite(event.clientX) ? clamp((event.clientX - box.left) / (box.width || 1)) : 0.5,
        Number.isFinite(event.clientY) ? clamp((event.clientY - box.top) / (box.height || 1)) : 0.5,
      );
      settle(wave);
    },
    options,
  );
  document.addEventListener(
    'pointerout',
    (event) => {
      const el = find(event.target);
      if (!el || (event.relatedTarget instanceof Node && el.contains(event.relatedTarget))) return;
      const wave = waves.get(el);
      if (wave) {
        wave.pointer = false;
        wave.water?.release();
        settle(wave);
      }
    },
    options,
  );
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Tab') keyboardInput = true;
      if (event.repeat || !['Enter', ' '].includes(event.key)) return;
      const el = find(event.target);
      if (!el || blocked(el) || (event.key === ' ' && el.tagName === 'A')) return;
      const wave = get(el);
      wave.keyboard = true;
      press(wave, 0.5, 0.5);
    },
    options,
  );
  document.addEventListener(
    'keyup',
    (event) => {
      if (!['Enter', ' '].includes(event.key)) return;
      const el = find(event.target);
      const wave = el && waves.get(el);
      if (wave?.pressing) release(wave);
    },
    options,
  );
  document.addEventListener(
    'focusin',
    (event) => {
      const el = find(event.target);
      if (!el || !keyboardInput || blocked(el)) return;
      const wave = get(el);
      wave.keyboard = true;
      settle(wave);
    },
    options,
  );
  document.addEventListener(
    'focusout',
    (event) => {
      const el = find(event.target);
      const wave = el && waves.get(el);
      if (wave) {
        wave.keyboard = false;
        wave.pressedClick = false;
        release(wave);
        settle(wave);
      }
    },
    options,
  );
  document.addEventListener(
    'pointerdown',
    (event) => {
      keyboardInput = false;
      if (event.button !== undefined && event.button !== 0) return;
      if (event.pointerType === 'touch') reset();
      const el = find(event.target);
      if (!el || blocked(el)) return;
      const wave = get(el);
      wave.pointer = true;
      wave.pointerId = event.pointerId;
      wave.pressBox = el.getBoundingClientRect();
      const box = wave.pressBox;
      press(
        wave,
        Number.isFinite(event.clientX) ? clamp((event.clientX - box.left) / (box.width || 1)) : 0.5,
        Number.isFinite(event.clientY) ? clamp((event.clientY - box.top) / (box.height || 1)) : 0.5,
      );
    },
    options,
  );
  document.addEventListener(
    'pointermove',
    (event) => {
      for (const wave of waves.values()) {
        const hovering =
          event.pointerType !== 'touch' && wave.pointer && find(event.target) === wave.element;
        if ((!hovering && (!wave.pressing || wave.pointerId !== event.pointerId)) || !wave.pressBox)
          continue;
        const box = wave.pressBox;
        const x = Number.isFinite(event.clientX)
          ? clamp((event.clientX - box.left) / (box.width || 1))
          : 0.5;
        const y = Number.isFinite(event.clientY)
          ? clamp((event.clientY - box.top) / (box.height || 1))
          : 0.5;
        if (hovering) wave.water?.press(x, y);
        else wave.water?.move(x, y);
      }
    },
    options,
  );
  window.addEventListener(
    'pointerup',
    (event) => {
      for (const wave of waves.values()) {
        if (!wave.pressing || wave.pointerId !== event.pointerId) continue;
        if (event.pointerType === 'touch') wave.pointer = false;
        release(wave, event.pointerType !== 'touch' && wave.pointer);
      }
    },
    options,
  );
  document.addEventListener(
    'dragstart',
    (event) => {
      if (!(event.target instanceof Element)) return;
      // Native dragging can cancel pointer input before dragstart. Do not depend
      // on a live wave or pressing flag, including on the very first gesture.
      if (
        event.target.closest(
          '[draggable="true"], [contenteditable]:not([contenteditable="false"]), input, textarea',
        )
      )
        return;
      if (event.target.closest('a[href], button, summary, img')) event.preventDefault();
    },
    options,
  );
  document.addEventListener(
    'click',
    (event) => {
      const el = find(event.target);
      if (!el || blocked(el) || reduced.matches) return;
      const wave = get(el);
      const box = el.getBoundingClientRect();
      wave.clickX = event.detail ? clamp((event.clientX - box.left) / (box.width || 1)) * 320 : 160;
      wave.clickY = event.detail ? clamp((event.clientY - box.top) / (box.height || 1)) * 100 : 50;
      wave.clickAge = 0;
      wave.fill = Math.max(wave.fill, 0.6);
      if (!wave.pressedClick) water(wave)?.pulse(wave.clickX / 320, wave.clickY / 100);
      wave.pressedClick = false;
      settle(wave);
      draw(wave);
    },
    options,
  );
  // Closing a dialog, changing chapter/theme or switching applications must never retain ink.
  document.addEventListener('close', reset, { ...options, capture: true });
  window.addEventListener('blur', reset, options);
  window.addEventListener('pagehide', reset, options);
  window.addEventListener('hashchange', reset, options);
  window.addEventListener('resize', reset, options);
  window.addEventListener('pointercancel', reset, options);
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) reset();
    },
    options,
  );
  const theme = new MutationObserver(reset);
  theme.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-color-mode', 'data-theme'],
  });
  // Only inspect existing live effects, not every control in a changing page.
  const states = new MutationObserver((records) => {
    for (const wave of waves.values()) {
      const changed = records.some(
        (record) =>
          record.target === wave.element &&
          ['aria-current', 'aria-pressed', 'aria-selected'].includes(record.attributeName || '') &&
          record.oldValue !== wave.element.getAttribute(record.attributeName!),
      );
      const contentChanged = records.some(
        (record) =>
          (record.type === 'characterData' ||
            (record.type === 'childList' && !Array.from(record.addedNodes).includes(wave.layer))) &&
          wave.element.contains(record.target) &&
          !wave.layer.contains(record.target),
      );
      if (
        !wave.element.isConnected ||
        !wave.layer.isConnected ||
        blocked(wave.element) ||
        changed ||
        contentChanged
      )
        clear(wave);
    }
  });
  states.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: [
      'disabled',
      'aria-disabled',
      'aria-busy',
      'hidden',
      'open',
      'inert',
      'aria-current',
      'aria-pressed',
      'aria-selected',
    ],
  });
  reduced.addEventListener('change', reset);
  return () => {
    lifetime.abort();
    theme.disconnect();
    states.disconnect();
    reduced.removeEventListener('change', reset);
    reset();
  };
}
