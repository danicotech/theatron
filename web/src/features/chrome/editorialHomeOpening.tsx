import { useLayoutEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { gsap } from 'gsap';
import { WireCover, WirePortalOutline } from '../../app/opening-study/wireframe';
import { openingTimeline } from '../../app/opening-study/motion';
import { createBootSymbol } from '../../../public/lunjian/boot-symbol.js';
import { mountOpeningMode } from './openingMode';
import { startEditorialChapterPortal } from './editorialChapterPortal';
import styles from './editorial-home-opening.module.css';

type Options = { host: HTMLElement; boot: HTMLElement; signal: AbortSignal; done: () => void };

function EditorialOpening({ host, boot, signal, done }: Options) {
  const stage = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = stage.current!;
    const button = boot.querySelector<HTMLButtonElement>('#ignite')!;
    const content = [...host.querySelectorAll<HTMLElement>('.site-header, main')];
    const previousInert = content.map((element) => !!element.inert);
    const homeCopy = host.querySelector<HTMLElement>('.home-copy');
    const copyOpacity = homeCopy?.style.opacity ?? '';
    const originalLabel = button.innerHTML;
    const originalAria = button.getAttribute('aria-label');
    const originalHidden = button.hidden;
    const lifetime = new AbortController();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const loader = boot.querySelector<HTMLElement>('.boot-loading');
    const meter = boot.querySelector<HTMLProgressElement>('#load-progress');
    const number = boot.querySelector('#load-number');
    const label = boot.querySelector('#load-label');
    const started = performance.now();
    let readyTimer = 0;
    let loadingTween: gsap.core.Tween | undefined;
    const progress = (value: number) => {
      if (meter) meter.value = value;
      if (number) number.textContent = String(value);
      if (label) label.textContent = value === 100 ? '江湖已開' : '展開江湖';
    };
    let finished = false,
      playing = false;
    let destination: URL | undefined;
    let timeline: gsap.core.Timeline | undefined;
    let context: gsap.Context | undefined;
    button.innerHTML = '';
    button.hidden = true;
    root.inert = true;
    button.dataset.inkWave = 'off';
    button.disabled = true;
    boot.dataset.state = 'loading';
    loader?.removeAttribute('aria-hidden');
    progress(0);
    const stopSymbol = createBootSymbol(boot, lifetime.signal);
    content.forEach((element) => {
      element.inert = true;
    });
    mountOpeningMode(boot, lifetime.signal);
    const restore = (keepIntro = false) => {
      clearTimeout(readyTimer);
      loadingTween?.kill();
      stopSymbol();
      loader?.style.removeProperty('opacity');
      loader?.style.removeProperty('visibility');
      context?.revert();
      context = undefined;
      if (homeCopy) {
        if (copyOpacity) homeCopy.style.opacity = copyOpacity;
        else homeCopy.style.removeProperty('opacity');
      }
      content.forEach((element, i) => {
        element.inert = previousInert[i]!;
      });
      boot.hidden = true;
      delete boot.dataset.editorial;
      delete host.dataset.openingBurn;
      if (!keepIntro) document.body.removeAttribute('data-intro');
      button.innerHTML = originalLabel;
      button.hidden = originalHidden;
      if (originalAria === null) button.removeAttribute('aria-label');
      else button.setAttribute('aria-label', originalAria);
    };
    const enter = () => {
      if (finished || signal.aborted) return;
      finished = true;
      lifetime.abort();
      try {
        sessionStorage.setItem('lunjian:opening-seen:v1', '1');
      } catch {
        /* Optional storage. */
      }
      host.dataset.sceneFallback = '';
      // The stage's entry choreography reads the intro flag inside done(), so it is cleared after.
      restore(true);
      if (!destination)
        host.querySelector<HTMLElement>('.home-actions a')?.focus({ preventScroll: true });
      done();
      document.body.removeAttribute('data-intro');
      if (destination) {
        // All destinations leave only after the same cover timeline completes.
        const navigation = new CustomEvent('lunjian:editorial-navigate', {
          cancelable: true,
          detail: { href: destination.href },
        });
        if (host.dispatchEvent(navigation)) location.assign(destination.href);
      }
    };
    const build = () => {
      if (playing || finished) return;
      context?.revert();
      context = gsap.context(() => {
        timeline = openingTimeline(root, 'I', reduced.matches, () => {}, enter);
        const copy = host.querySelector('.home-copy');
        if (copy)
          timeline.fromTo(
            copy,
            { opacity: 0 },
            { opacity: 1, duration: 0.6, ease: 'power2.out' },
            1.35,
          );
        const header = host.querySelector('.site-header');
        if (header) timeline.fromTo(header, { opacity: 0 }, { opacity: 1, duration: 0.45 }, 1.5);
      }, root);
    };
    const resize = new ResizeObserver(build);
    resize.observe(root);
    build();
    // Optional combat poses do not delay first entry. Reveal only decoded artwork.
    root.querySelectorAll<HTMLImageElement>('[data-portrait-armed]').forEach((image) => {
      void image
        .decode?.()
        .then(() => {
          if (!lifetime.signal.aborted && image.naturalWidth > 0) {
            image.parentElement!.dataset.armedReady = '';
          }
        })
        .catch(() => {
          /* Keep the resting portrait if this optional asset fails. */
        });
    });
    // Only the visible opening and destination assets count toward readiness.
    const images = [
      ...host.querySelectorAll<HTMLImageElement>(
        '[data-editorial-opening] img:not([data-portrait-armed]), .home-hero img',
      ),
    ];
    let decoded = 0;
    void Promise.allSettled(
      images.map(async (image) => {
        try {
          await image.decode?.();
        } finally {
          decoded++;
          if (!finished && !signal.aborted) progress(Math.round((decoded / images.length) * 100));
        }
      }),
    ).then(() => {
      if (finished || signal.aborted || lifetime.signal.aborted) return;
      // A short stable hold prevents a cached loader flashing for a single frame.
      readyTimer = window.setTimeout(
        () => {
          if (finished || signal.aborted) return;
          build();
          progress(100);
          boot.dataset.state = 'ready';
          const ready = () => {
            if (finished || signal.aborted) return;
            stopSymbol();
            loader?.setAttribute('aria-hidden', 'true');
            button.disabled = false;
            root.inert = false;
            boot.focus({ preventScroll: true });
          };
          if (loader)
            loadingTween = gsap.to(loader, { autoAlpha: 0, duration: 0.45, onComplete: ready });
          else ready();
        },
        Math.max(0, 1100 - (performance.now() - started)),
      );
    });
    button.addEventListener(
      'click',
      (event) => {
        // This opening owns the button: the stage's legacy fallback would otherwise burn first,
        // disable the button and leave the header at the timeline's starting opacity.
        event.stopImmediatePropagation();
        if (playing || finished || button.disabled) return;
        playing = true;
        root.inert = true;
        button.disabled = true;
        boot.dataset.state = 'burning';
        host.dataset.openingBurn = '';
        boot.focus({ preventScroll: true });
        timeline?.play(0);
      },
      { signal: lifetime.signal, capture: true },
    );
    boot.addEventListener(
      'click',
      (event) => {
        const link = (event.target as Element).closest<HTMLAnchorElement>(
          '[data-cover-link], .opening-mode a',
        );
        if (
          !link ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const target = new URL(link.href, location.href);
        if (target.origin !== location.origin) return;
        const mode = link.dataset.openingMode;
        if (mode && link.getAttribute('aria-current') === 'true') return;
        // Capture before the homepage's navigation handlers and mode chooser.
        event.preventDefault();
        event.stopPropagation();
        if (playing || finished || button.disabled) return;
        const current = new URLSearchParams(location.search);
        for (const key of ['sportsEvent', 'slug', 'preview']) {
          const value = current.get(key);
          if (value) target.searchParams.set(key, value);
        }
        if (mode) {
          try {
            localStorage.setItem('lunjian:stage-mode:v1', mode);
          } catch {
            /* URL retains the mode. */
          }
        } else {
          target.searchParams.set('intro', '0');
          target.searchParams.set('stage', '2d');
        }
        // Home already exists under this cover; chapter-entry covers still navigate.
        destination =
          link.hasAttribute('data-cover-home') && host.querySelector('.home-hero')
            ? undefined
            : target;
        if (destination?.pathname === '/' && destination.hash && host.querySelector('.home-hero')) {
          const targetChapter = destination;
          playing = true;
          button.disabled = true;
          root.inert = true;
          boot.dataset.state = 'burning';
          const transferred = startEditorialChapterPortal(
            root,
            link,
            targetChapter,
            () => {
              try {
                sessionStorage.setItem('lunjian:opening-seen:v1', '1');
              } catch {
                /* URL retains intro=0. */
              }
              return !host.dispatchEvent(
                new CustomEvent('lunjian:editorial-navigate', {
                  cancelable: true,
                  detail: { href: targetChapter.href },
                }),
              );
            },
            () => {
              if (!signal.aborted && !finished) {
                playing = false;
                button.disabled = false;
                root.inert = false;
                boot.dataset.state = 'ready';
              }
            },
          );
          if (transferred) return;
        }
        root
          .querySelectorAll('[data-portal-selected]')
          .forEach((node) => node.removeAttribute('data-portal-selected'));
        if (link.closest('[data-wire-detail]')) link.setAttribute('data-portal-selected', '');
        build();
        button.click();
      },
      { signal: lifetime.signal, capture: true },
    );
    document.addEventListener(
      'visibilitychange',
      () => {
        if (!playing || finished) return;
        if (document.hidden) timeline?.pause();
        else timeline?.resume();
      },
      { signal: lifetime.signal },
    );
    reduced.addEventListener(
      'change',
      () => {
        if (reduced.matches) enter();
      },
      { signal: lifetime.signal },
    );
    const cancel = () => {
      finished = true;
      lifetime.abort();
      resize.disconnect();
      restore();
    };
    signal.addEventListener('abort', cancel, { once: true });
    return () => {
      signal.removeEventListener('abort', cancel);
      cancel();
    };
  }, [host, boot, signal, done]);
  return (
    <div className={styles.stage} ref={stage} data-editorial-opening>
      <div className={styles.veil} data-live-veil>
        <div className={styles.composition}>
          <WireCover published />
        </div>
      </div>
      <WirePortalOutline />
      <span data-home-copy hidden />
    </div>
  );
}

export function mountEditorialHomeOpening(
  host: HTMLElement,
  boot: HTMLElement,
  signal: AbortSignal,
  done: () => void,
) {
  if (signal.aborted) return;
  const container = document.createElement('div');
  container.className = styles.mount!;
  boot.append(container);
  const root = createRoot(container);
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    // Parent effect cleanup may be in React's commit phase.
    queueMicrotask(() => {
      root.unmount();
      container.remove();
    });
  };
  signal.addEventListener('abort', remove, { once: true });
  root.render(
    <EditorialOpening
      host={host}
      boot={boot}
      signal={signal}
      done={() => {
        remove();
        done();
      }}
    />,
  );
}
