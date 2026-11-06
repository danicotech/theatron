import { mountNavigationArtwork } from './navigationArtwork';
import { mountColorMode } from './colorMode';
import { createNavigationMotion } from './navigationMotion';
/** Shared by the React pages and the generated Lunjian stage. */
export function mountNavigation(root: HTMLElement) {
  const trigger = root.querySelector<HTMLButtonElement>('[data-nav-toggle]');
  const drawer = root.querySelector<HTMLDialogElement>('[data-nav-drawer]');
  if (!trigger || !drawer) return () => {};
  const previousInkWave = root.dataset.inkWave;
  root.dataset.inkWave = 'off';
  const lifetime = new AbortController();
  const options = { signal: lifetime.signal };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const unmountColor = mountColorMode(root);
  const unmountArtwork = mountNavigationArtwork(root);
  const motion = createNavigationMotion(root, drawer);
  let previousOverflow = '';
  let isClosing = false;
  const finish = (restoreFocus: boolean) => {
    motion.reset();
    drawer.close();
    drawer.removeAttribute('data-closing');
    document.body.style.overflow = previousOverflow;
    trigger.setAttribute('aria-expanded', 'false');
    isClosing = false;
    if (restoreFocus && trigger.isConnected) trigger.focus({ preventScroll: true });
  };
  const close = (restoreFocus = true) => {
    if (!drawer.open || isClosing) return;
    isClosing = true;
    drawer.setAttribute('data-closing', '');
    trigger.setAttribute('aria-expanded', 'false');
    motion.close(() => finish(restoreFocus));
  };
  trigger.addEventListener(
    'click',
    () => {
      if (drawer.open) {
        close();
        return;
      }
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      drawer.showModal();
      motion.open();
      trigger.setAttribute('aria-expanded', 'true');
      drawer.querySelector<HTMLButtonElement>('[data-nav-close]')?.focus();
    },
    options,
  );
  drawer.addEventListener(
    'cancel',
    (event) => {
      event.preventDefault();
      close();
    },
    options,
  );
  drawer.addEventListener(
    'click',
    (event) => {
      const target = event.target as Element;
      if (target.closest('[data-nav-close]')) close();
      else if (target.closest('a,button')) close(false);
      else if (target === drawer) {
        const bounds = drawer.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          close();
      }
    },
    options,
  );
  // The stage owns document-level chapter keys; keep them inside an open drawer.
  drawer.addEventListener('keydown', (event) => event.stopPropagation(), options);
  reduced.addEventListener(
    'change',
    () => {
      if (isClosing) finish(true);
      else motion.reset();
    },
    options,
  );
  const breakpoint = matchMedia('(min-width: 801px)');
  const onResize = () => {
    if (!drawer.open) return;
    finish(!breakpoint.matches);
    if (breakpoint.matches)
      root
        .querySelector<HTMLAnchorElement>('.lj-nav__inner .lj-nav__brand')
        ?.focus({ preventScroll: true });
  };
  breakpoint.addEventListener('change', onResize, options);
  return () => {
    lifetime.abort();
    if (previousInkWave === undefined) delete root.dataset.inkWave;
    else root.dataset.inkWave = previousInkWave;
    unmountColor();
    unmountArtwork();
    if (drawer.open) finish(false);
    motion.destroy();
  };
}
