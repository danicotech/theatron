import { useEffect, useState, type RefObject } from 'react';

import type { ChapterId } from './chapters';

/**
 * 現在是哪一章。
 *
 * 用 IntersectionObserver 而不是 scroll 事件:章節切換是離散的事,
 * 每個 scroll frame 都去量位置只會讓主執行緒忙,答案卻沒有更準。
 * 取「露出比例最高」的那一段;兩側各縮 12%,免得上一章的尾巴還在視窗底部時就搶走了。
 * 比例相同時保留較早的一章 —— 往下捲時新章要真的站穩才接手。
 *
 * 同時寫到 <html data-chapter>,固定導覽列之類不在這棵樹裡的東西才讀得到。
 */
export function useActiveChapter(
  root: RefObject<HTMLElement | null>,
  initial: ChapterId = '00',
): ChapterId {
  const [active, setActive] = useState<ChapterId>(initial);

  useEffect(() => {
    const host = root.current;
    if (host === null || !('IntersectionObserver' in window)) return;

    const sections = Array.from(host.querySelectorAll<HTMLElement>('[data-chapter-section]'));
    const ratios = new Map<Element, number>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) ratios.set(e.target, e.isIntersecting ? e.intersectionRatio : 0);
        let best: HTMLElement | undefined;
        let bestRatio = 0;
        for (const s of sections) {
          const r = ratios.get(s) ?? 0;
          if (r > bestRatio) {
            best = s;
            bestRatio = r;
          }
        }
        const id = best?.dataset.chapterSection;
        if (id !== undefined) setActive(id as ChapterId);
      },
      { rootMargin: '-12% 0px -12% 0px', threshold: [0, 0.12, 0.32, 0.55] },
    );
    for (const s of sections) io.observe(s);
    return () => io.disconnect();
  }, [root]);

  useEffect(() => {
    document.documentElement.dataset.chapter = active;
    return () => {
      delete document.documentElement.dataset.chapter;
    };
  }, [active]);

  return active;
}
