const STORAGE_KEY = 'lunjian:stage-mode:v1';

export function openingMode(): '2d' | '3d' {
  const requested = new URLSearchParams(location.search).get('stage');
  if (requested === '2d' || requested === '3d') return requested;
  try {
    return localStorage.getItem(STORAGE_KEY) === '3d' ? '3d' : '2d';
  } catch {
    return '2d';
  }
}

/** Available during loading as well as ready, above the full-screen ignition target. */
export function mountOpeningMode(boot: HTMLElement, signal: AbortSignal) {
  if (boot.querySelector('.opening-mode')) return;
  const chooser = document.createElement('nav');
  chooser.className = 'opening-mode';
  chooser.setAttribute('aria-label', '選擇開場與場景');
  for (const [mode, label] of [
    ['2d', '2D 輕量開場'],
    ['3d', '3D 華麗開場'],
  ] as const) {
    const link = document.createElement('a');
    const target = new URL(location.href);
    target.searchParams.set('stage', mode);
    target.searchParams.set('intro', '1');
    link.href = target.href;
    link.dataset.inkWave = 'off';
    link.dataset.openingMode = mode;
    link.setAttribute('aria-current', String(openingMode() === mode));
    const title = document.createElement('strong');
    title.textContent = label;
    link.append(title);
    link.addEventListener(
      'click',
      (event) => {
        event.stopPropagation();
        if (mode === openingMode()) event.preventDefault();
        try {
          localStorage.setItem(STORAGE_KEY, mode);
        } catch {
          /* URL also retains the choice. */
        }
        // Document navigation tears down a loading 3D world before switching to 2D.
      },
      { signal },
    );
    chooser.append(link);
  }
  boot.append(chooser);
  boot.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Tab') return;
      // Replace the legacy one-button focus trap while the chooser is available.
      event.preventDefault();
      event.stopImmediatePropagation();
      if (boot.dataset.state === 'burning') {
        boot.focus();
        return;
      }
      const controls = [...chooser.querySelectorAll<HTMLElement>('a')];
      const editorial = boot.querySelector<HTMLElement>('[data-editorial-opening]');
      if (editorial && !editorial.inert) {
        controls.push(...editorial.querySelectorAll<HTMLElement>('[data-cover-link]'));
      }
      const ignite = boot.querySelector<HTMLButtonElement>('#ignite');
      if (ignite && !ignite.disabled && !ignite.hidden) controls.push(ignite);
      const index = controls.indexOf(document.activeElement as HTMLElement);
      const next =
        index < 0
          ? event.shiftKey
            ? controls.length - 1
            : 0
          : (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
      controls[next]?.focus();
    },
    { signal, capture: true },
  );
  signal.addEventListener('abort', () => chooser.remove(), { once: true });
}
