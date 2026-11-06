import { gsap } from 'gsap';
import { openingTimeline } from '../../app/opening-study/motion';

/** The cover survives the route commit; the real destination is revealed underneath.
 * No iframe, screenshot, duplicate page, or intermediate homepage is needed. */
export function startEditorialChapterPortal(
  source: HTMLElement,
  anchor: HTMLAnchorElement,
  destination: URL,
  navigate: () => boolean,
  release: () => void,
) {
  const doc = source.ownerDocument;
  const overlay = doc.createElement('div');
  overlay.dataset.editorialTransition = destination.hash;
  overlay.setAttribute('role', 'progressbar');
  overlay.setAttribute('aria-label', `正在開啟${anchor.textContent?.trim() || '章節'}`);
  overlay.tabIndex = -1;
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2147483000;isolation:isolate;overflow:hidden;overscroll-behavior:none;';
  anchor.setAttribute('data-portal-selected', '');
  const clone = source.cloneNode(true) as HTMLElement;
  anchor.removeAttribute('data-portal-selected');
  clone.removeAttribute('data-editorial-opening');
  clone.inert = true;
  clone.setAttribute('aria-hidden', 'true');
  clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
  // Preserve the selected hover pose until it recedes into the expanding window.
  const originals = source.querySelectorAll<HTMLElement>(
    '[data-portrait-person], [data-portrait-person] img',
  );
  clone
    .querySelectorAll<HTMLElement>('[data-portrait-person], [data-portrait-person] img')
    .forEach((node, i) => {
      const style = getComputedStyle(originals[i]!);
      node.style.opacity = style.opacity;
      node.style.transform = style.transform;
      node.style.scale = style.scale;
      node.style.transition = 'none';
    });
  overlay.append(clone);
  doc.body.append(overlay);
  overlay.focus({ preventScroll: true });
  let disposed = false,
    preparing = false;
  let timeline: gsap.core.Timeline | undefined;
  let restoreDestination = () => {};
  const lifetime = new AbortController();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, delay: number) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, delay);
    timers.add(timer);
    return timer;
  };
  const finish = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    lifetime.abort();
    timers.forEach(clearTimeout);
    timeline?.kill();
    restoreDestination();
    overlay.remove();
    release();
  };
  const check = () => {
    if (
      disposed ||
      preparing ||
      location.pathname !== destination.pathname ||
      location.hash !== destination.hash
    )
      return;
    const entry = doc.querySelector('.chapter-entry:not([data-entry-pending])');
    const chapter = doc.getElementById(destination.hash.slice(1));
    if (!entry || !chapter?.hasAttribute('data-on') || !chapter.getBoundingClientRect().width)
      return;
    preparing = true;
    observer.disconnect();
    const images = [...chapter.querySelectorAll<HTMLImageElement>('img')];
    void Promise.race([
      Promise.allSettled(images.map((image) => image.decode?.())),
      new Promise<void>((resolve) => later(resolve, 3000)),
    ]).then(() => {
      if (disposed) return;
      // A small aperture must reveal scenery, not a random crop of footer buttons.
      // Bring the full-size interface in only once the window nearly fills the screen.
      const shells = [...entry.querySelectorAll<HTMLElement>('main,.site-header')];
      const styles = shells.map((node) => ({
        opacity: node.style.opacity,
        transition: node.style.transition,
      }));
      shells.forEach((node) => {
        void getComputedStyle(node).opacity;
        node.getAnimations?.().forEach((animation) => {
          if ('transitionProperty' in animation) animation.finish();
        });
        node.style.transition = 'none';
        node.style.opacity = '0';
      });
      restoreDestination = () =>
        shells.forEach((node, i) => {
          node.style.opacity = styles[i]!.opacity;
          node.style.transition = styles[i]!.transition;
        });
      overlay.dataset.portalState = 'expanding';
      timeline = openingTimeline(
        clone,
        'I',
        matchMedia('(prefers-reduced-motion: reduce)').matches,
        () => {},
        () => {
          finish();
          const heading = chapter.querySelector<HTMLElement>('h1,h2,[id$="-title"]');
          if (heading) {
            heading.tabIndex = -1;
            heading.focus({ preventScroll: true });
          }
        },
      );
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) restoreDestination();
      else timeline.to(shells, { opacity: 1, duration: 0.35, ease: 'power2.out' }, 1.3);
      timeline.play(0);
    });
  };
  const observer = new MutationObserver(check);
  observer.observe(doc.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-entry-pending', 'data-on'],
  });
  window.addEventListener('pagehide', finish, { signal: lifetime.signal });
  window.addEventListener('popstate', finish, { signal: lifetime.signal });
  doc.addEventListener(
    'visibilitychange',
    () => {
      if (doc.hidden) timeline?.pause();
      else timeline?.resume();
    },
    { signal: lifetime.signal },
  );
  // A failed route must never leave a permanent input-blocking cover.
  later(finish, 12000);
  if (!navigate()) {
    finish();
    return false;
  }
  check();
  return true;
}
