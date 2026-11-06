import { gsap } from 'gsap';
import { cacheOpeningFabric, createLightPaperBurn } from './lightPaperBurn';
import { mountOpeningMode, openingMode } from './openingMode';
import { openingPerformance } from './openingPerformance';

/** Match the curtain renderer to the chosen scene; 2D never imports the WebGL effect. */
export function mountHomeOpening(
  host: HTMLElement | null,
  signal: AbortSignal,
  done: () => void,
  prepared = false,
) {
  const boot = host?.querySelector<HTMLElement>('#boot');
  const button = boot?.querySelector<HTMLButtonElement>('#ignite');
  if (!host || !boot || !button) {
    done();
    return;
  }
  const query = new URLSearchParams(location.search);
  // Prepared chapter openings are the fallback path, including failed WebGL setup.
  const cinematic = openingMode() === '3d' && !prepared;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let seen = false;
  try {
    seen = sessionStorage.getItem('lunjian:opening-seen:v1') === '1';
  } catch {
    /* Private browsing. */
  }
  if (
    (!prepared && (query.get('intro') === '0' || (seen && query.get('intro') !== '1'))) ||
    reduced.matches
  ) {
    done();
    return;
  }
  if (cinematic) {
    // Start the original cloth scene immediately; do not consume its intro with a
    // flat paper burn first. Only a failed WebGL setup uses the Canvas fallback.
    boot.hidden = false;
    boot.dataset.state = 'loading';
    button.disabled = true;
    button.dataset.inkWave = 'off';
    document.body.dataset.intro = 'curtain';
    const background = [...host.querySelectorAll<HTMLElement>('.site-header, main')];
    background.forEach((element) => {
      element.inert = true;
    });
    mountChapterOpening(host, signal, () => {
      host.dispatchEvent(new Event('lunjian:home-opening-fallback-complete'));
    });
    signal.addEventListener(
      'abort',
      () => {
        boot.hidden = true;
        background.forEach((element) => {
          element.inert = false;
        });
        document.body.removeAttribute('data-intro');
      },
      { once: true },
    );
    done();
    return;
  }
  if (openingMode() === '2d' || (!prepared && host.querySelector('.home-hero'))) {
    boot.hidden = false;
    boot.dataset.editorial = '';
    boot.dataset.state = 'loading';
    button.disabled = true;
    document.body.dataset.intro = 'curtain';
    void import('./editorialHomeOpening')
      .then(({ mountEditorialHomeOpening }) => {
        if (!signal.aborted) mountEditorialHomeOpening(host, boot, signal, done);
      })
      .catch(() => {
        if (signal.aborted) return;
        boot.hidden = true;
        delete boot.dataset.editorial;
        document.body.removeAttribute('data-intro');
        host.dataset.sceneFallback = '';
        done();
      });
    signal.addEventListener(
      'abort',
      () => {
        boot.hidden = true;
        delete boot.dataset.editorial;
        document.body.removeAttribute('data-intro');
      },
      { once: true },
    );
    return;
  }
  mountOpeningMode(boot, signal);
  const background = [...host.querySelectorAll<HTMLElement>('.site-header, main')];
  const previousInert = background.map((el) => !!el.inert);
  const canvas = document.createElement('canvas');
  canvas.className = 'opening-fire';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  let timeline: gsap.core.Timeline | undefined;
  let finished = false;
  let burning = false;
  let effect: ReturnType<typeof createLightPaperBurn> | undefined;
  let sheet: HTMLCanvasElement | undefined;
  let density = 1;
  const shadow = boot.querySelector<HTMLImageElement>('#boot-shadows');
  const prepare = () => {
    if (finished || signal.aborted || !ctx) return;
    const width = boot.clientWidth || innerWidth,
      height = boot.clientHeight || innerHeight;
    density = Math.min(1, 800 / width, 600 / height);
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    if (sheet) sheet.width = sheet.height = 0;
    sheet = cacheOpeningFabric(boot, canvas.width, canvas.height);
    ctx.drawImage(sheet, 0, 0);
    boot.dataset.raster = '';
  };
  const preparedSheet = Promise.resolve(shadow?.decode?.())
    .catch(() => {})
    .then(prepare);
  window.addEventListener(
    'resize',
    () => {
      if (!burning) prepare();
    },
    { signal },
  );
  const probe = openingPerformance(signal);
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) timeline?.pause();
      else timeline?.resume();
    },
    { signal },
  );
  const restore = (keepIntro = false) => {
    background.forEach((el, i) => {
      el.inert = previousInert[i]!;
    });
    if (!keepIntro) document.body.removeAttribute('data-intro');
    delete boot.dataset.raster;
    effect?.dispose();
    if (sheet) sheet.width = sheet.height = 0;
    canvas.remove();
    boot.hidden = true;
    delete boot.dataset.fire2d;
    delete host.dataset.openingBurn;
  };
  const enter = () => {
    if (finished || signal.aborted) return;
    finished = true;
    probe?.finish();
    timeline?.kill();
    try {
      sessionStorage.setItem('lunjian:opening-seen:v1', '1');
    } catch {
      /* Entry still works. */
    }
    // The chapter runtime owns its entry choreography and needs this flag until done().
    restore(prepared);
    // A 2D entry never needs the legacy WebGL opening, even without storage.
    host.dataset.sceneFallback = '';
    host.querySelector<HTMLElement>('.home-actions a')?.focus({ preventScroll: true });
    done();
  };
  signal.addEventListener(
    'abort',
    () => {
      finished = true;
      timeline?.kill();
      restore();
    },
    { once: true },
  );
  reduced.addEventListener(
    'change',
    () => {
      if (reduced.matches) enter();
    },
    { signal },
  );
  boot.dataset.fire2d = '';
  boot.dataset.fallback = '';
  boot.dataset.state = 'ready';
  boot.hidden = false;
  button.disabled = false;
  button.dataset.inkWave = 'off';
  background.forEach((el) => {
    el.inert = true;
  });
  document.body.dataset.intro = 'curtain';
  boot.querySelector('.boot-loading')?.setAttribute('aria-hidden', 'true');
  boot.append(canvas);
  button.focus({ preventScroll: true });
  button.addEventListener(
    'click',
    (event) => {
      // Replace the old fallback click handler, rather than running two burns/timers.
      if (prepared) event.stopImmediatePropagation();
      if (burning || finished) return;
      burning = true;
      probe?.start();
      button.disabled = true;
      boot.dataset.state = 'burning';
      host.dataset.openingBurn = '';
      boot.focus({ preventScroll: true });
      if (!ctx || reduced.matches) {
        enter();
        return;
      }
      const rect = boot.getBoundingClientRect();
      const cx = event.detail ? event.clientX - rect.left : rect.width * 0.5;
      const cy = event.detail ? event.clientY - rect.top : rect.height * 0.62;
      const colors = getComputedStyle(boot);
      const pigment = (name: string) => colors.getPropertyValue(`--accent-fire-${name}`).trim();
      const pigments = {
        soot: pigment('soot'),
        char: pigment('char'),
        flame: pigment('flame'),
        core: pigment('core'),
        smoke: pigment('smoke'),
        ash: pigment('ash'),
      };
      void preparedSheet
        .then(() => {
          if (finished || signal.aborted || !sheet) return;
          effect = createLightPaperBurn(ctx, sheet, { x: cx * density, y: cy * density }, pigments);
          const state = { progress: 0 };
          const started = performance.now();
          const render = () => {
            const time = (performance.now() - started) / 1000;
            const before = probe ? performance.now() : 0;
            effect?.render(state.progress, time);
            if (probe) probe.paint(performance.now() - before);
          };
          timeline = gsap.timeline({ onComplete: enter });
          timeline.to(state, { progress: 1, duration: 3.4, ease: 'power1.in', onUpdate: render });
          if (document.hidden) timeline.pause();
        })
        .catch(() => enter());
    },
    { signal, capture: prepared },
  );
}

/** Retain the chapter loader; take over only once its 2D assets are ready. */
export function mountChapterOpening(
  host: HTMLElement | null,
  signal: AbortSignal,
  done: () => void,
) {
  const boot = host?.querySelector<HTMLElement>('#boot');
  if (!host || !boot || signal.aborted) return;
  mountOpeningMode(boot, signal);
  let mounted = false;
  const ready = () => {
    if (
      mounted ||
      signal.aborted ||
      boot.hidden ||
      boot.dataset.state !== 'ready' ||
      !boot.hasAttribute('data-fallback')
    )
      return;
    mounted = true;
    observer.disconnect();
    mountHomeOpening(host, signal, done, true);
  };
  const observer = new MutationObserver(ready);
  observer.observe(boot, {
    attributes: true,
    attributeFilter: ['data-state', 'data-fallback', 'hidden'],
  });
  signal.addEventListener('abort', () => observer.disconnect(), { once: true });
  ready();
}
