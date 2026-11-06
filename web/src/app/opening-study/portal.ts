import { gsap } from 'gsap';

type WindowGeometry = { cx: number; cy: number; width: number; height: number; angle: number };
export function portalMatrices(view: WindowGeometry, width: number, height: number) {
  const r = (view.angle * Math.PI) / 180;
  const a = (Math.cos(r) * view.width) / width,
    b = (Math.sin(r) * view.width) / width;
  const c = (-Math.sin(r) * view.height) / height,
    d = (Math.cos(r) * view.height) / height;
  const x = view.cx - (a * width) / 2 - (c * height) / 2;
  const y = view.cy - (b * width) / 2 - (d * height) / 2;
  const determinant = a * d - b * c;
  const dx = view.cx - width / 2,
    dy = view.cy - height / 2;
  return {
    window: [a, b, c, d, x, y],
    image: [
      d / determinant,
      -b / determinant,
      -c / determinant,
      a / determinant,
      (d * (dx - x) - c * (dy - y)) / determinant,
      (-b * (dx - x) + a * (dy - y)) / determinant,
    ],
  };
}

/** An existing cover crop becomes the landscape window. Inverse transform keeps
 * the scenery upright and undistorted, including while a diamond unfolds.
 * Geometry is measured once; frames perform only arithmetic and transforms. */
export function addPortal(tl: gsap.core.Timeline, root: HTMLElement, angle: number, start = 0.3) {
  const anchor =
    root.querySelector<HTMLElement>('[data-portal-selected]') ??
    root.querySelector<HTMLElement>('[data-portal-anchor]');
  const portal = root.querySelector<HTMLElement>('[data-portal]');
  const image = root.querySelector<HTMLElement>('[data-portal-image]');
  // Production reveals the actual destination through the cover. No second scene
  // is swapped in at completion, so responsive cropping cannot jump.
  const veil = root.querySelector<HTMLElement>('[data-live-veil]');
  const outline = root.querySelector<HTMLElement>('[data-portal-outline]');
  const edges = outline?.querySelectorAll<HTMLElement>('[data-outline-edge]');
  if (!anchor || (!veil && (!portal || !image))) return;
  const bounds = root.getBoundingClientRect(),
    rect = anchor.getBoundingClientRect();
  const width = root.clientWidth || 800,
    height = root.clientHeight || 450;
  const state = {
    cx: rect.width ? rect.left + rect.width / 2 - bounds.left : width / 2,
    cy: rect.height ? rect.top + rect.height / 2 - bounds.top : height / 2,
    width: rect.width || anchor.offsetWidth || 180,
    height: rect.height || anchor.offsetHeight || 150,
    angle,
    reveal: 0,
  };
  const draw = () => {
    if (veil) {
      const left = state.cx - (state.width * state.reveal) / 2;
      const right = state.cx + (state.width * state.reveal) / 2;
      const top = state.cy - (state.height * state.reveal) / 2;
      const bottom = state.cy + (state.height * state.reveal) / 2;
      veil.style.clipPath = `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px, ${left}px ${top}px)`;
    } else {
      const matrices = portalMatrices(state, width, height);
      portal!.style.transform = `matrix(${matrices.window.join(',')})`;
      image!.style.transform = `matrix(${matrices.image.join(',')})`;
    }
    // I's eight independent rules move with the window without scaling thickness.
    edges?.forEach((edge, index) => {
      const offset = index < 4 ? (width <= 380 ? 1.5 : 2) : 0;
      const left = state.cx - state.width / 2 + offset;
      const top = state.cy - state.height / 2 + offset;
      const side = edge.dataset.outlineEdge;
      const horizontal = side === 'top' || side === 'bottom';
      const x = left + (side === 'right' ? state.width - 1 : 0);
      const y = top + (side === 'bottom' ? state.height - 1 : 0);
      edge.style.transform = `translate(${x}px,${y}px) scale(${horizontal ? state.width : 1},${horizontal ? 1 : state.height})`;
    });
  };
  draw();
  if (portal) gsap.set(portal, { opacity: 0 });
  if (outline) {
    gsap.set(outline, { opacity: 0 });
    tl.to(outline, { opacity: 1, duration: 0.08 }, 0.24)
      .to(root.querySelector('[data-wire-main-edge]'), { opacity: 0, duration: 0.08 }, 0.24)
      .to(outline, { opacity: 0, duration: 0.2 }, veil ? 1.45 : 1.2);
  }
  if (veil) tl.to(state, { reveal: 1, duration: 0.2, ease: 'power2.out', onUpdate: draw }, 0.12);
  else tl.to(portal, { opacity: 1, duration: 0.2, ease: 'none' }, 0.12);
  tl.to(
    state,
    {
      cx: width / 2,
      cy: height / 2,
      width,
      height,
      angle: 0,
      duration: (veil ? 1.6 : 1.2) - start,
      ease: 'power3.inOut',
      onUpdate: draw,
    },
    start,
  );
  if (veil) tl.set(veil, { visibility: 'hidden' }, 1.65);
  else
    tl.to(root.querySelector('[data-editorial]'), { opacity: 0, duration: 0.01 }, 1.22).to(
      portal,
      { opacity: 0, duration: 0.15, ease: 'none' },
      1.35,
    );
}
