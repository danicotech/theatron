const KEY = 'lunjian-color-mode';
let artworkId = 0;
/** The disc morphs while travelling below the horizon between day and night. */
function themeArtwork() {
  const mask = `nav-eclipse-${++artworkId}`;
  return `<svg class="theme-orbit" viewBox="0 0 48 48" width="38" height="38" fill="none" aria-hidden="true" focusable="false">
    <defs><mask id="${mask}" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48"><rect width="48" height="48" fill="white"/><circle class="theme-eclipse" cx="46" cy="16" r="10" fill="black"/></mask></defs>
    <circle class="theme-orbit-ring" cx="24" cy="24" r="22" stroke="currentColor" stroke-width=".8" stroke-dasharray="92 46"/>
    <g class="theme-celestial"><circle class="theme-disc" cx="24" cy="24" r="9" fill="currentColor" mask="url(#${mask})"/>
    <g class="theme-rays" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M24 8v4m0 24v4M8 24h4m24 0h4M12.7 12.7l2.8 2.8m17 17 2.8 2.8M12.7 35.3l2.8-2.8m17-17 2.8-2.8"/></g>
    <g class="theme-stars" fill="currentColor"><path class="theme-star" d="m35 11 1.2 2.8L39 15l-2.8 1.2L35 19l-1.2-2.8L31 15l2.8-1.2Z"/><circle class="theme-star" cx="39" cy="25" r="1.2"/><circle class="theme-star" cx="31" cy="7" r="1"/></g>
    </g>
  </svg>`;
}
export function mountColorMode(root: HTMLElement) {
  const host = root.querySelector('.lj-nav__actions');
  if (!host) return () => {};
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'lj-nav__theme';
  button.dataset.colorToggle = '';
  button.innerHTML = themeArtwork();
  host.prepend(button);
  const mobileButton = button.cloneNode(true) as HTMLButtonElement;
  mobileButton.innerHTML = themeArtwork();
  const drawerFoot = root.querySelector('.lj-nav__drawer-foot');
  drawerFoot?.append(mobileButton);
  const buttons = drawerFoot ? [button, mobileButton] : [button];
  const interaction = new AbortController();
  const animateOrbit = (button: HTMLButtonElement) => {
    const sky = button.querySelector<SVGGElement>('.theme-celestial');
    if (!sky?.animate) return;
    sky.getAnimations().forEach((animation) => animation.cancel());
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Click only: the current body sets on the right; the next rises on the left.
    // The invisible midpoint hides the return below the horizon.
    sky.animate(
      [
        { transform: 'rotate(0deg) scale(1)', opacity: 1, offset: 0 },
        { transform: 'rotate(35deg) scale(.85)', opacity: 0.8, offset: 0.24 },
        { transform: 'rotate(72deg) scale(.6)', opacity: 0, offset: 0.44 },
        { transform: 'rotate(-72deg) scale(.6)', opacity: 0, offset: 0.5 },
        { transform: 'rotate(-35deg) scale(.85)', opacity: 0.8, offset: 0.74 },
        { transform: 'rotate(0deg) scale(1)', opacity: 1, offset: 1 },
      ],
      { duration: 960, easing: 'ease-in-out' },
    );
  };
  const sync = () => {
    const dark = document.documentElement.dataset.colorMode === 'dark';
    for (const button of buttons) {
      button.setAttribute('aria-label', dark ? '切換淺色模式' : '切換深色模式');
      button.setAttribute('aria-pressed', String(dark));
      button.title = dark ? '切換淺色模式' : '切換深色模式';
    }
  };
  const click = (event: MouseEvent) => {
    const mode = document.documentElement.dataset.colorMode === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.colorMode = mode;
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* Private browsing still switches this page. */
    }
    sync();
    animateOrbit(event.currentTarget as HTMLButtonElement);
  };
  const storage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    document.documentElement.dataset.colorMode = event.newValue === 'dark' ? 'dark' : 'light';
    sync();
  };
  buttons.forEach((button) => {
    button.addEventListener('click', click, { signal: interaction.signal });
  });
  window.addEventListener('storage', storage);
  sync();
  return () => {
    interaction.abort();
    window.removeEventListener('storage', storage);
    buttons.forEach((button) => {
      button
        .querySelector('.theme-celestial')
        ?.getAnimations?.()
        .forEach((animation) => animation.cancel());
      button.remove();
    });
  };
}
