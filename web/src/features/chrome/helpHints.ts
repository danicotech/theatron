/** Delegation also supports dynamically rendered lab panels without mutating React trees. */
export function mountHelpHints(doc: Document = document) {
  const win = doc.defaultView!;
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const tip = doc.createElement('div');
  tip.className = 'help-tooltip';
  tip.id = `help-${crypto.randomUUID()}`;
  tip.setAttribute('role', 'tooltip');
  if (typeof tip.showPopover === 'function') tip.setAttribute('popover', 'manual');
  tip.hidden = true;
  let active: HTMLElement | null = null;
  let previousDescription: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => clearTimeout(timer);
  function close() {
    clear();
    if (active) {
      if (previousDescription) active.setAttribute('aria-describedby', previousDescription);
      else active.removeAttribute('aria-describedby');
    }
    if (!tip.hidden) tip.hidePopover?.();
    tip.hidden = true;
    active = null;
  }
  function show(button: HTMLElement) {
    clear();
    if (active === button) return;
    close();
    active = button;
    previousDescription = button.getAttribute('aria-describedby');
    button.setAttribute(
      'aria-describedby',
      [previousDescription, tip.id].filter(Boolean).join(' '),
    );
    tip.textContent = button.dataset.help ?? '';
    (button.closest('dialog[open]') ?? doc.body).append(tip);
    tip.hidden = false;
    tip.showPopover?.();
    const rect = button.getBoundingClientRect();
    const size = tip.getBoundingClientRect();
    // Measured on screen; under a large-screen zoom (app/large-screen.css) the tip is placed in its own units.
    const scale = tip.currentCSSZoom || 1;
    const left = Math.max(12, Math.min(rect.left, win.innerWidth - size.width - 12));
    const top = Math.max(
      12,
      rect.bottom + size.height + 12 < win.innerHeight
        ? rect.bottom + 6
        : rect.top - size.height - 6,
    );
    tip.style.left = `${left / scale}px`;
    tip.style.top = `${top / scale}px`;
  }
  const trigger = (event: Event) =>
    event.target instanceof Element ? event.target.closest<HTMLElement>('button[data-help]') : null;
  doc.addEventListener(
    'pointerover',
    (event) => {
      if (event.pointerType === 'touch') return;
      if (tip.contains(event.target as Node)) clear();
      const button = trigger(event);
      if (button) show(button);
    },
    options,
  );
  doc.addEventListener(
    'pointerout',
    (event) => {
      if (event.pointerType === 'touch') return;
      if (trigger(event) || tip.contains(event.target as Node)) timer = setTimeout(close, 140);
    },
    options,
  );
  doc.addEventListener(
    'focusin',
    (event) => {
      const button = trigger(event);
      if (button) show(button);
    },
    options,
  );
  doc.addEventListener(
    'focusout',
    (event) => {
      if (trigger(event)) timer = setTimeout(close, 140);
    },
    options,
  );
  doc.addEventListener(
    'click',
    (event) => {
      const button = trigger(event);
      if (button) {
        event.preventDefault();
        show(button);
      } else if (!tip.contains(event.target as Node)) close();
    },
    options,
  );
  doc.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && active) {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    },
    { ...options, capture: true },
  );
  win.addEventListener('resize', close, options);
  win.addEventListener('hashchange', close, options);
  // Avoid clipping or leaving a tooltip over unrelated content after scrolling.
  doc.addEventListener(
    'scroll',
    (event) => {
      if (event.target !== tip) close();
    },
    { ...options, capture: true },
  );
  return () => {
    controller.abort();
    close();
    tip.remove();
  };
}
