/** Small semantic illustrations; text and hit areas remain the original controls. */
export function mountNavigationArtwork(root: HTMLElement) {
  const added: Element[] = [];
  const pictures = [
    [
      '.lj-nav__member',
      'door',
      '<path d="M3 23V7l9-4 9 4v16"/><path class="nav-door-left" d="M4 8h8v15H4Z"/><path class="nav-door-right" d="M12 8h8v15h-8Z"/><path class="nav-door-light" d="M12 10v11"/>',
    ],
    [
      '.lj-nav__toggle',
      'catalogue',
      '<path class="nav-catalogue-spine" d="M4 4v20"/><path class="nav-catalogue-top" d="M8 8h12"/><path class="nav-catalogue-middle" d="M8 14h9"/><path class="nav-catalogue-bottom" d="M8 20h12"/>',
    ],
  ] as const;
  for (const [selector, kind, paths] of pictures) {
    root.querySelectorAll(selector).forEach((control) => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', `nav-action-art nav-action-art--${kind}`);
      svg.setAttribute('viewBox', '0 0 24 28');
      svg.setAttribute('width', '20');
      svg.setAttribute('height', '24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '1.3');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      svg.innerHTML = paths;
      control.prepend(svg);
      added.push(svg);
    });
  }
  // Visible label for the drawer trigger, as in the approved navigation (「三 更多」).
  root.querySelectorAll('.lj-nav__inner .lj-nav__toggle').forEach((toggle) => {
    const label = document.createElement('span');
    label.className = 'nav-more-label';
    label.setAttribute('aria-hidden', 'true');
    label.textContent = '更多';
    toggle.append(label);
    added.push(label);
  });
  // Timber frame, lit lantern and raven are server-rendered; this only covers markup that lacks them.
  const inner = root.querySelector<HTMLElement>('.lj-nav__inner');
  if (inner && !inner.querySelector('.battle-nav-frame')) {
    for (const lit of [true, false]) {
      const frame = document.createElement('span');
      frame.className = 'battle-nav-frame' + (lit ? ' battle-nav-frame--lit' : '');
      frame.setAttribute('aria-hidden', 'true');
      frame.append(
        document.createElement('i'),
        document.createElement('i'),
        document.createElement('i'),
      );
      inner.prepend(frame);
      added.push(frame);
    }
  }
  const brand = inner?.querySelector('.lj-nav__brand');
  if (brand && !brand.querySelector('.battle-nav-raven')) {
    const raven = document.createElement('span');
    raven.className = 'battle-nav-raven';
    raven.setAttribute('aria-hidden', 'true');
    brand.append(raven);
    added.push(raven);
  }
  const releaseLantern = inner ? mountLantern(inner) : () => {};
  const chapters = inner?.querySelector<HTMLElement>('.lj-nav__chapters');
  const releaseChapterRow = chapters ? mountChapterRow(chapters) : () => {};
  preloadNavigationArt();
  return () => {
    releaseLantern();
    releaseChapterRow();
    added.forEach((node) => node.remove());
  };
}

/**
 * Between 601 and 1159px the row clips (timber-navigation.css): it keeps as many whole chapters as
 * fit, in order, and folds the rest into 更多, whose drawer lists every chapter. On phones the row
 * scrolls sideways instead; browsers leave a half-visible link where it is when it takes focus, and
 * a plain mouse wheel only scrolls the page, so there the row brings a focused link fully into view
 * and turns vertical wheel steps into sideways ones while it has somewhere to go.
 */
function mountChapterRow(row: HTMLElement) {
  const links = [...row.querySelectorAll<HTMLElement>(':scope > a')];
  const overflows = () => row.scrollWidth > row.clientWidth;
  const fold = () => {
    links.forEach((link) => link.removeAttribute('data-nav-folded'));
    if (getComputedStyle(row).overflowX !== 'hidden') return;
    // scrollWidth is rounded, so a fraction of a pixel of overflow would pass; compare the edges.
    for (let last = links.length - 1; last > 0; last--) {
      const link = links[last];
      if (!link || link.getBoundingClientRect().right <= row.getBoundingClientRect().right) break;
      link.setAttribute('data-nav-folded', '');
    }
  };
  const onFocus = (event: FocusEvent) => {
    if (overflows() && event.target instanceof HTMLElement)
      event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const onWheel = (event: WheelEvent) => {
    if (!overflows() || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    const max = row.scrollWidth - row.clientWidth;
    const next = Math.min(max, Math.max(0, row.scrollLeft + event.deltaY));
    if (next === row.scrollLeft) return;
    event.preventDefault();
    row.scrollLeft = next;
  };
  // The row's width comes from the bar's grid, not its links, so folding never resizes it.
  const resize = new ResizeObserver(fold);
  resize.observe(row);
  let mounted = true;
  void document.fonts?.ready.then(() => mounted && fold());
  row.addEventListener('focusin', onFocus);
  row.addEventListener('wheel', onWheel, { passive: false });
  return () => {
    mounted = false;
    resize.disconnect();
    links.forEach((link) => link.removeAttribute('data-nav-folded'));
    row.removeEventListener('focusin', onFocus);
    row.removeEventListener('wheel', onWheel);
  };
}

/**
 * The lantern lights while the pointer is on the bar, including the part of the lantern that
 * hangs past it. A short grace period keeps it lit across the gap between bar and lantern;
 * a tap keeps it lit long enough to be seen.
 */
function mountLantern(inner: HTMLElement) {
  let timer = 0;
  const light = () => {
    window.clearTimeout(timer);
    inner.dataset.lantern = 'lit';
  };
  const dim = (event: PointerEvent) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(
      () => {
        delete inner.dataset.lantern;
      },
      event.pointerType === 'touch' ? 1500 : 100,
    );
  };
  inner.addEventListener('pointerenter', light);
  inner.addEventListener('pointerleave', dim);
  if (inner.matches(':hover')) light();
  return () => {
    window.clearTimeout(timer);
    inner.removeEventListener('pointerenter', light);
    inner.removeEventListener('pointerleave', dim);
    delete inner.dataset.lantern;
  };
}

/** Images that only appear on hover, press, selection or a colour-mode switch. */
const NAV_SWAP_ART = [
  'key-day-hover-v6',
  'key-night-hover-v4',
  'key-selected-v4',
  'key-pressed-v4',
  'key-day-v4',
  'key-night-v4',
  'raven',
  'raven-hover',
  'raven-night',
  'raven-alert-night',
  'frame-lantern-day-left',
  'frame-lantern-day-middle',
  'frame-lantern-day-right-bleed',
  'frame-lantern-day-lit-v4-right-bleed',
  'frame-lantern-night-left',
  'frame-lantern-night-middle',
  'frame-lantern-night-right-bleed',
  'frame-lantern-night-lit-v4-right-bleed',
];
let navArtRequested = false;

function preloadNavigationArt() {
  if (navArtRequested) return;
  navArtRequested = true;
  const fetchAll = () => {
    for (const name of NAV_SWAP_ART) {
      const image = new Image();
      image.decoding = 'async';
      image.src = `/battle-preview/assets/${name}.webp`;
    }
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(fetchAll, { timeout: 1500 });
  else setTimeout(fetchAll, 300);
}
