import * as THREE from 'three';
import { gsap } from 'gsap';
import { createBurnField } from './paperBurn';

import { createFireSheet, type FireStyle } from './fireSheet';
export { FIRE_STYLES, type FireStyle } from './fireSheet';

/** Isolated preview renderer. No production opening settings are modified. */
export async function createFireStudy(
  canvas: HTMLCanvasElement,
  style: FireStyle,
  onProgress: (p: number) => void,
  signal: AbortSignal,
) {
  const texture = await new THREE.TextureLoader().loadAsync('/lunjian/art/intro-duel.png');
  if (signal.aborted) {
    texture.dispose();
    throw new DOMException('Cancelled', 'AbortError');
  }
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });
  } catch (error) {
    texture.dispose();
    throw error;
  }
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const css = getComputedStyle(canvas);
  const pigment = (name: string) => css.getPropertyValue(`--accent-fire-${name}`).trim();
  const colors = {
    soot: pigment('soot'),
    char: pigment('char'),
    flame: pigment('flame'),
    core: pigment('core'),
    smoke: pigment('smoke'),
    ash: pigment('ash'),
  };
  const sheet = createFireSheet(
    640,
    360,
    colors,
    style,
    createBurnField(640, 360, { x: 320, y: 241.2 }),
    texture,
  );
  scene.add(sheet.mesh);
  let disposed = false,
    hold = false,
    speed = 1;
  const state = { p: 0 };
  const render = () => {
    if (!disposed) renderer.render(scene, camera);
  };
  const resize = () => {
    const width = Math.min(640, Math.round(canvas.clientWidth));
    renderer.setSize(width, Math.round((width * 9) / 16), false);
    render();
  };
  const setOrigin = (x: number, y: number) =>
    sheet.setField(createBurnField(640, 360, { x: x * 640, y: y * 360 }));
  const update = () => {
    sheet.update(hold ? Math.min(state.p * 1.18, 0.38) : state.p * 1.18, state.p * 7);
    render();
    onProgress(state.p);
  };
  const pause = () => {
    tween?.pause();
  };
  const visibility = () => {
    if (document.hidden) pause();
  };
  document.addEventListener('visibilitychange', visibility);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const intersection = new IntersectionObserver((entries) => {
    if (!entries[0]?.isIntersecting) pause();
  });
  intersection.observe(canvas);
  setOrigin(0.5, 0.67);
  resize();
  const tween = gsap.to(state, { p: 1, duration: 7, ease: 'none', paused: true, onUpdate: update });
  return {
    play(x = 0.5, y = 0.67) {
      setOrigin(x, y);
      tween?.timeScale(speed).restart();
    },
    pause,
    resume() {
      tween?.resume();
    },
    seek(p: number) {
      tween?.progress(p).pause();
    },
    speed(value: number) {
      speed = value;
      tween?.timeScale(value);
    },
    hold(value: boolean) {
      hold = value;
      update();
    },
    reset() {
      tween?.progress(0).pause();
      sheet.update(-1, 0);
      render();
      onProgress(0);
    },
    dispose() {
      disposed = true;
      tween?.kill();
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      texture.dispose();
      sheet.dispose();
      renderer.dispose();
    },
  };
}
export type FireStudyController = Awaited<ReturnType<typeof createFireStudy>>;
