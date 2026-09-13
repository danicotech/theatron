'use client';

import { useEffect, useRef, type RefObject } from 'react';

import { inkVars, transitionAt } from './ink';
import styles from './InkWipe.module.css';

/**
 * 章與章之間的墨暈轉場。
 *
 * 一個固定在視窗上的圖層,由捲動進度直接寫 CSS 變數 —— 沒有 React 重繪、
 * 沒有動畫排程。它可以來回刮,因為它畫的東西是 `transitionAt(progress)`,
 * 而那是一個純函式。
 *
 * 為什麼不蓋滿:滿版的黑幕在每一章之間閃一次,讀起來像換頁。墨只吃掉中間那一塊,
 * 兩邊留著,像一張紙被滴到 —— 訊息是「同一張紙上的下一段」,不是「下一頁」。
 */
export interface InkWipeProps {
  /** 連續章節進度(0…章數−1)。每格由呼叫端更新。 */
  progress: RefObject<number>;
  reduced: boolean;
}

export function InkWipe({ progress, reduced }: InkWipeProps) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (el === null || reduced) return;

    let frame = 0;
    let last = -1;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      // 分頁在背景時不畫。看不見的東西沒有畫的理由。
      if (document.visibilityState === 'hidden') return;
      const t = transitionAt(progress.current);
      // 只有真的變了才寫 style。寫 style 會讓瀏覽器重算樣式,
      // 在兩章中間停著不動時每格都寫一次是白花的。
      if (Math.abs(t - last) < 0.002) return;
      last = t;
      const vars = inkVars(t, { spread: 165, edge: 22 });
      for (const [key, value] of Object.entries(vars)) {
        el.style.setProperty(key, String(value));
      }
      if (t > 0.01) el.dataset.inkOn = '';
      else delete el.dataset.inkOn;
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [progress, reduced]);

  // 不想看到動的人完全不掛這一層 —— 它沒有承載任何資訊,關掉不會少讀到東西。
  if (reduced) return null;

  return <div className={styles.wipe} ref={host} aria-hidden="true" data-testid="ink-wipe" />;
}
