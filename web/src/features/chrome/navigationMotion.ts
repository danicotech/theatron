import { gsap } from 'gsap';

/** Owns only navigation motion; dialog semantics and routing stay in the controller. */
export function createNavigationMotion(root: HTMLElement, drawer: HTMLDialogElement) {
  const lifetime = new AbortController();
  const options = { signal: lifetime.signal };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const controls = Array.from(root.querySelectorAll<HTMLElement>('a[href], button, summary'));
  const rows = Array.from(
    drawer.querySelectorAll<HTMLElement>('.lj-nav__drawer-links a, .lj-nav__drawer-foot'),
  );
  const pressed = new Set<HTMLElement>();
  const closeIcon = drawer.querySelector<HTMLElement>('.lj-nav__close');
  const clearControls: Array<() => void> = [];
  const context = gsap.context(() => {}, root);
  let sequence: gsap.core.Timeline | undefined;
  root.dataset.navMotion = 'gsap';

  const tween = (element: HTMLElement, values: gsap.TweenVars) => {
    if (reduced.matches) return;
    // Replaced property tweens are killed on reset; pointer moves do not accumulate in a context.
    gsap.to(element, { duration: 0.24, ease: 'power3.out', overwrite: 'auto', ...values });
  };
  const releaseElement = (element: HTMLElement) => {
    if (!pressed.delete(element)) return;
    tween(element, { '--nav-press': 0, duration: 0.4, ease: 'back.out(1.5)' });
  };
  const release = () => {
    for (const element of pressed)
      tween(element, { '--nav-press': 0, duration: 0.4, ease: 'back.out(1.5)' });
    pressed.clear();
  };
  for (const element of controls) {
    let bounds: DOMRect | undefined;
    let pointerInside = false;
    const disabled = () => element.matches(':disabled, [aria-disabled="true"]');
    const settle = () => {
      const active = !disabled() && (pointerInside || element.matches(':focus-visible'));
      element.toggleAttribute('data-nav-hover', active);
      tween(element, {
        '--nav-hover': active ? 1 : 0,
        '--nav-pointer-x': '0px',
        '--nav-pointer-y': '0px',
      });
    };
    clearControls.push(() => {
      pointerInside = false;
      bounds = undefined;
      element.removeAttribute('data-nav-hover');
    });
    element.addEventListener(
      'pointerenter',
      (event) => {
        if (event.pointerType === 'touch' || disabled()) return;
        pointerInside = true;
        element.setAttribute('data-nav-hover', '');
        bounds = element.getBoundingClientRect();
        tween(element, { '--nav-hover': 1, duration: 0.3 });
      },
      options,
    );
    element.addEventListener(
      'pointermove',
      (event) => {
        if (!bounds || event.pointerType === 'touch' || disabled()) return;
        const x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1));
        const y = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1));
        tween(element, {
          '--nav-pointer-x': `${x * 2}px`,
          '--nav-pointer-y': `${y * 1.5}px`,
          duration: 0.18,
        });
      },
      options,
    );
    element.addEventListener(
      'pointerleave',
      () => {
        bounds = undefined;
        pointerInside = false;
        settle();
        releaseElement(element);
      },
      options,
    );
    element.addEventListener(
      'focus',
      () => {
        settle();
      },
      options,
    );
    element.addEventListener(
      'blur',
      () => {
        settle();
        releaseElement(element);
      },
      options,
    );
    const press = () => {
      if (disabled()) return;
      pressed.add(element);
      tween(element, { '--nav-press': 1, duration: 0.09, ease: 'power2.out' });
    };
    element.addEventListener(
      'pointerdown',
      (event) => {
        if (event.pointerType === 'touch') clearInteractions();
        if (event.button === 0) press();
      },
      options,
    );
    element.addEventListener(
      'keydown',
      (event) => {
        if (!event.repeat && ['Enter', ' '].includes(event.key)) press();
      },
      options,
    );
    element.addEventListener('keyup', release, options);
    element.addEventListener(
      'click',
      () => {
        if (disabled()) return;
        tween(element, {
          '--nav-flash': 1,
          duration: 0.08,
          onComplete: () => tween(element, { '--nav-flash': 0, duration: 0.48 }),
        });
      },
      options,
    );
  }
  window.addEventListener('pointerup', release, options);
  const clearInteractions = () => {
    for (const clear of clearControls) clear();
    gsap.killTweensOf(controls);
    gsap.set(controls, {
      clearProps: '--nav-hover,--nav-press,--nav-pointer-x,--nav-pointer-y,--nav-flash',
    });
    pressed.clear();
  };
  window.addEventListener('pointercancel', clearInteractions, options);
  window.addEventListener('blur', clearInteractions, options);
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) clearInteractions();
    },
    options,
  );

  const reset = () => {
    sequence?.kill();
    sequence = undefined;
    gsap.killTweensOf([drawer, ...rows, ...controls]);
    gsap.set(drawer, { clearProps: 'transform,clipPath,--nav-shade' });
    gsap.set(rows, { clearProps: '--nav-reveal-x,--nav-reveal-opacity' });
    if (closeIcon) gsap.set(closeIcon, { clearProps: '--nav-close-reveal' });
    clearInteractions();
  };
  return {
    reset,
    open() {
      reset();
      if (reduced.matches) return;
      context.add(() => {
        sequence = gsap.timeline();
        if (closeIcon)
          sequence.fromTo(
            closeIcon,
            { '--nav-close-reveal': 0 },
            { '--nav-close-reveal': 1, duration: 0.36, ease: 'power3.out' },
            0.16,
          );
        sequence.fromTo(
          drawer,
          { clipPath: 'inset(0 0 calc(100% - 76px) 0)', '--nav-shade': 0 },
          { clipPath: 'inset(0 0 0% 0)', '--nav-shade': 1, duration: 0.48, ease: 'power3.out' },
          0,
        );
        sequence.fromTo(
          rows,
          { '--nav-reveal-x': '-8px', '--nav-reveal-opacity': 0 },
          {
            '--nav-reveal-x': '0px',
            '--nav-reveal-opacity': 1,
            duration: 0.38,
            stagger: 0.02,
            ease: 'power3.out',
          },
          0.12,
        );
      });
    },
    close(done: () => void) {
      clearInteractions();
      sequence?.kill();
      if (reduced.matches) {
        done();
        return;
      }
      context.add(() => {
        sequence = gsap.timeline({ onComplete: done });
        if (closeIcon)
          sequence.to(closeIcon, { '--nav-close-reveal': 0, duration: 0.18, ease: 'power2.in' }, 0);
        sequence.to(drawer, {
          clipPath: 'inset(0 0 calc(100% - 76px) 0)',
          '--nav-shade': 0,
          duration: 0.26,
          ease: 'power3.in',
        });
      });
    },
    destroy() {
      lifetime.abort();
      reset();
      context.revert();
      delete root.dataset.navMotion;
    },
  };
}
