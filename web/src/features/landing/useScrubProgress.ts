import { useEffect, useRef, useState, type RefObject } from 'react';

import { clamp01 } from './prologue/stages';

/**
 * 一段「被捲動刮過去」的進度。
 *
 * 序幕是一段戲,但它不能是一段影片:規格要求正反刮都成立。做法是把章節做得比
 * 一屏高,裡面釘一個 100svh 的舞台,於是
 *
 *     進度 = 這一段已經捲過去的距離 / (段高 − 一屏)
 *
 * 就是一個**位置的函式**。往回捲不是倒帶,是同一個式子吃到比較小的數字。
 * 沒有播放頭、沒有 currentTime、沒有「這一段有沒有播過」。
 *
 * 回傳的 `progress` 是 ref 而不是 state:它每一格都在變,用 state 等於每格重繪
 * 整棵樹。要重繪的只有「現在是第幾段」這種離散的答案,那個才用 state。
 *
 * `inView` 由觀察器給。看不見的時候呼叫端要停掉 rAF —— 畫一個沒人看的東西
 * 只是在耗電。
 */

export interface Scrub {
  /** 0…1。每格讀,不觸發重繪。 */
  progress: RefObject<number>;
  /** 舞台有沒有在畫面上。 */
  inView: boolean;
  /** 版面量好了沒。沒量好之前呼叫端不該宣稱「已就緒」,也不該顯示空白。 */
  measured: boolean;
}

export function useScrubProgress(section: RefObject<HTMLElement | null>): Scrub {
  const progress = useRef(0);
  const [inView, setInView] = useState(false);
  const [measured, setMeasured] = useState(false);

  useEffect(() => {
    const el = section.current;
    if (el === null) return;

    let frame = 0;

    const apply = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const viewport = window.innerHeight || document.documentElement.clientHeight || 0;
      const travel = rect.height - viewport;
      // 版面還沒撐開(圖沒到、或根本沒有版面,例如 jsdom)時 travel 會是 0 或負數。
      // 除下去會得到 Infinity,而 Infinity 進 shader 是一整片黑 —— 直接當作還沒開始。
      progress.current = travel > 0 ? clamp01(-rect.top / travel) : 0;
    };

    const schedule = () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(apply);
    };

    apply();
    setMeasured(true);

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // 圖片載進來會把章節往下推,段高跟著變。ResizeObserver 不是每個環境都有
    // (jsdom 就沒有),沒有就只靠 resize —— 少一種重量時機,不是壞掉。
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : undefined;
    ro?.observe(el);

    let io: IntersectionObserver | undefined;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) setInView(e.isIntersecting);
        },
        { rootMargin: '10% 0px' },
      );
      io.observe(el);
    } else {
      // 沒有觀察器就當它一直在畫面上。多畫幾格比整段不動好。
      setInView(true);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      ro?.disconnect();
      io?.disconnect();
    };
  }, [section]);

  return { progress, inView, measured };
}
