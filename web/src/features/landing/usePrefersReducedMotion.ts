import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function getSnapshot(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;
}

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/**
 * CSS 的 media query 管得到樣式,管不到 JS 決定的事:
 * 要不要等觀察器才出場、近景要不要留一拍再退場、視差要不要算。這些由這裡回答。
 * 伺服器端一律當作沒有偏好 —— 內容本來就全部就位,錯的方向也只是多動一下。
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
