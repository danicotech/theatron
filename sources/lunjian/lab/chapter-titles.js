/**
 * Chapter names use the existing brush.js + ink-title.js strokeSVG engine.
 * The caller loads glyphs first. This adapter owns no fetch, RAF or timers;
 * replacing the generated SVG cancels its CSS stroke animations immediately.
 */
const mounts = new WeakMap();

export function createChapterTitles({root = document, staticMode = false} = {}) {
  mounts.get(root)?.destroy();
  const snapshots = new Map();
  const documentRef = root.ownerDocument || root;
  const view = documentRef.defaultView || window;
  const motion = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  let current = null;
  let destroyed = false;
  let cleanups = [];

  function hosts(section = root) {
    return [...section.querySelectorAll('[data-chapter-title]')];
  }
  function remember(host) {
    if (!snapshots.has(host)) snapshots.set(host, {
      html: host.innerHTML,
      text: host.textContent || '',
      aspect: host.style.aspectRatio,
      hadStyle: host.hasAttribute('style'),
      state: host.getAttribute('data-title-state'),
    });
  }
  function label(host) {
    return (host.dataset.chapterTitle || snapshots.get(host)?.text || host.textContent || '').trim();
  }
  function plain(host) {
    remember(host);
    const text = label(host);
    host.textContent = text;
    host.style.aspectRatio = snapshots.get(host).aspect;
    if (!snapshots.get(host).hadStyle && !host.getAttribute('style')) host.removeAttribute('style');
    host.dataset.titleState = 'plain';
  }
  function stop() {
    cleanups.forEach(cleanup => cleanup());
    cleanups = [];
  }
  function clear() {
    if (destroyed) return;
    stop();
    if (current) hosts(current).forEach(plain);
    current = null;
  }
  function resolveSection(section) {
    if (typeof section === 'string') {
      const id = section.replace(/^#/, '');
      return [...root.querySelectorAll('.chapter')].find(node => node.id === id) || null;
    }
    return section && root.contains(section) ? section : null;
  }

  function playSVG(host, svg, section) {
    host.dataset.titleState = 'writing';
    svg.classList.add('writing');
    svg.dataset.played = '1';
    const nibs = svg.querySelectorAll('.ink-nib');
    const last = nibs[nibs.length - 1];
    if (last) {
      const finish = event => {
        if (event.animationName === 'ink-draw' && current === section && !destroyed) {
          host.dataset.titleState = 'complete';
        }
      };
      last.addEventListener('animationend', finish);
      cleanups.push(() => last.removeEventListener('animationend', finish));
    }
  }

  /** Re-entering the same active section never restarts an existing stroke SVG. */
  function enter(section) {
    if (destroyed) return false;
    const next = resolveSection(section);
    if (next !== current) clear();
    if (!next) return false;
    current = next;
    const targets = hosts(next);
    if (staticMode || motion?.matches) {
      targets.forEach(plain);
      return false;
    }
    let written = false;
    targets.forEach(host => {
      remember(host);
      const existing = host.querySelector('.ink-svg');
      if (existing) {
        written = true;
        return;
      }
      const text = label(host);
      plain(host);
      if (!text || typeof view.strokeSVG !== 'function') return;
      const isRegistration = host.classList.contains('registration-seal-label');
      let markup;
      try {
        markup = view.strokeSVG(text, {
          glyphStyles: {'旨': {width: 68, cursive: .25}},
          track: .10, dur: isRegistration ? 2000 : [...text].length > 2 ? 3600 : 2400,
          gap: isRegistration ? 12 : 24, charGap: isRegistration ? 80 : 160, lace: false,
        });
      } catch { return; } // Missing glyph/engine: retain the real readable name.
      if (!markup) return;
      host.innerHTML = markup;
      const svg = host.querySelector('.ink-svg');
      if (!svg) { plain(host); return; }
      const box = svg.getAttribute('viewBox')?.trim().split(/\s+/).map(Number);
      if (box?.length === 4 && box[2] > 0 && box[3] > 0) {
        host.style.aspectRatio = String(box[2] / box[3]);
      }
      // The runtime pauses these CSS animations during intro/cuts.
      playSVG(host, svg, next);
      written = true;
    });
    return written;
  }

  /** Changing reading mode shows plain text; the caller enters the active chapter. */
  function setStatic(value) {
    if (destroyed) return;
    staticMode = !!value;
    clear();
    hosts().forEach(plain);
  }
  const onMotion = () => {
    if (!motion?.matches || destroyed) return;
    clear();
    hosts().forEach(plain);
  };
  motion?.addEventListener?.('change', onMotion);
  hosts().forEach(plain);

  function destroy() {
    if (destroyed) return;
    clear();
    destroyed = true;
    motion?.removeEventListener?.('change', onMotion);
    snapshots.forEach((snapshot, host) => {
      host.innerHTML = snapshot.html;
      host.style.aspectRatio = snapshot.aspect;
      if (!snapshot.hadStyle && !host.getAttribute('style')) host.removeAttribute('style');
      if (snapshot.state === null) delete host.dataset.titleState;
      else host.setAttribute('data-title-state', snapshot.state);
    });
    snapshots.clear();
    if (mounts.get(root) === controller) mounts.delete(root);
  }
  const controller = {enter, setStatic, clear, destroy};
  mounts.set(root, controller);
  return controller;
}
