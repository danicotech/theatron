import { useEffect, type RefObject } from 'react';

/** 同一個父元素底下的出場元素,一個接一個,每個隔這麼久。 */
const SIBLING_STAGGER_MS = 85;

/** 掛上這麼久之後還沒有任何東西出場,就不等觀察器了,全部放出來。 */
const DEADMAN_MS = 1200;

/**
 * 把 [data-rv] 元素在進入視窗時標成 data-rv-in;樣式由 Reveal.module.css 接手。
 *
 * 用 attribute 而不是 class:CSS Modules 會把 class 名雜湊掉,從 DOM 端加不回來。
 * 出場只做一次,看過就取消觀察 —— 往回捲的時候內容不該再消失一次。
 *
 * 減少動態、或沒有 IntersectionObserver 的環境,一律立刻全部標上:
 * 內容從來不是靠這個 hook 才看得到(沒有 JS 時 CSS 根本不藏),這裡只是把動畫關掉。
 *
 * 有兩道保險,理由是同一條:**任何情況下都不能有讀者看到一片空白。**
 *
 *   1. 掛上後的第一格,自己量一次矩形,把已經在視窗裡的東西直接放出來。
 *      帶 hash 冷開(`/#chapter-03`,或者捲到一半按 F5 由瀏覽器還原位置)時,
 *      瀏覽器的定位跟觀察器的第一次派送會撞在一起,那一章的元素可能一次回呼
 *      都收不到 —— 於是它們永遠停在 opacity: 0。量矩形只在掛載時做一次,
 *      不在 render 裡、也不是每次捲動都算。
 *   2. 一秒二之內一個都沒出場,就當觀察器壞了,全部放出來並收掉它。
 *
 * 兩道保險都走同一個 reveal(),所以「同層元素依序出場」在正常路徑上原封不動。
 */
export function useReveals(root: RefObject<HTMLElement | null>, reduced: boolean): void {
  useEffect(() => {
    const host = root.current;
    if (host === null) return;

    const items = Array.from(host.querySelectorAll<HTMLElement>('[data-rv]'));
    const show = (el: Element) => el.setAttribute('data-rv-in', '');

    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach(show);
      return;
    }

    const delays = new Map<Element, number>();
    const seen = new Map<Element | null, number>();
    for (const el of items) {
      const n = seen.get(el.parentElement) ?? 0;
      delays.set(el, n * SIBLING_STAGGER_MS);
      seen.set(el.parentElement, n + 1);
    }

    const done = new Set<Element>();
    const timers = new Set<number>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) reveal(e.target);
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.04 },
    );

    /** 出場一次就好,三個來源(觀察器、第一格的掃描、保險)共用這一支。 */
    function reveal(el: Element) {
      if (done.has(el)) return;
      done.add(el);
      io.unobserve(el);
      const delay = delays.get(el) ?? 0;
      if (delay === 0) {
        show(el);
        return;
      }
      const t = window.setTimeout(() => {
        timers.delete(t);
        show(el);
      }, delay);
      timers.add(t);
    }

    for (const el of items) io.observe(el);

    // 保險一:第一格自己量一次,已經在視窗裡的不必等觀察器開口。
    const frame = requestAnimationFrame(() => {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const vw = window.innerWidth || document.documentElement.clientWidth;
      for (const el of items) {
        if (done.has(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw) reveal(el);
      }
    });

    // 保險二:真的一個都沒出來,就不等了。看不到字比看不到動畫嚴重得多。
    const deadman = window.setTimeout(() => {
      if (done.size > 0) return;
      io.disconnect();
      items.forEach(show);
    }, DEADMAN_MS);

    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(deadman);
      timers.forEach((t) => clearTimeout(t));
    };
  }, [root, reduced]);
}
