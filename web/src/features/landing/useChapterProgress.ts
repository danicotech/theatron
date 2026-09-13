import { useEffect, useRef, type RefObject } from 'react';

import { CHAPTERS } from './chapters';

/**
 * 連續的章節進度(0…章數−1),給 3D 相機用。
 *
 * 與 useActiveChapter 是兩件不同的事,所以是兩個 hook:
 * 「現在是哪一章」是離散的,近景與章節軌道要的是那個答案,用觀察器最省;
 * 而相機要的是**中間值** —— 0.37 表示第 0 章走了三成七,鏡頭正滑在兩個
 * 鏡位之間。離散答案餵給曲線只會得到一格一格的跳鏡。
 *
 * 回傳 ref 而不是 state:這個值每一格都在變,用 state 等於每格重繪整棵樹。
 * 讀它的是 rAF 迴圈,不是 React。
 *
 * 錨點取每一章的中心線對齊視窗中心的捲動位置,首尾各釘到頭與尾,
 * 這樣第一屏一定是 0、捲到底一定是最後一章,不會差半格。
 */
export function useChapterProgress(root: RefObject<HTMLElement | null>): RefObject<number> {
  const progress = useRef(0);

  useEffect(() => {
    const host = root.current;
    if (host === null) return;

    let anchors: number[] = [];

    const measure = () => {
      const sections = Array.from(host.querySelectorAll<HTMLElement>('[data-chapter-section]'));
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      anchors = sections.map((el, i) => {
        if (i === 0) return 0;
        if (i === sections.length - 1) return max;
        const rect = el.getBoundingClientRect();
        const centre = rect.top + window.scrollY + rect.height / 2 - window.innerHeight / 2;
        return Math.min(Math.max(centre, 0), max);
      });
      // 錨點必須嚴格遞增,否則下面的內插會除以零。
      for (let i = 1; i < anchors.length; i += 1) {
        anchors[i] = Math.max(anchors[i] ?? 0, (anchors[i - 1] ?? 0) + 1);
      }
    };

    const apply = () => {
      if (anchors.length < 2) {
        progress.current = 0;
        return;
      }
      const y = window.scrollY;
      const last = anchors.length - 1;
      if (y <= (anchors[0] ?? 0)) {
        progress.current = 0;
        return;
      }
      for (let i = 0; i < last; i += 1) {
        const a = anchors[i] ?? 0;
        const b = anchors[i + 1] ?? a + 1;
        if (y <= b) {
          progress.current = i + (y - a) / (b - a);
          return;
        }
      }
      progress.current = last;
    };

    // 量測會讀版面,所以只在捲動停下來與尺寸改變時做,不是每格。
    let frame = 0;
    const schedule = () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        apply();
      });
    };
    const remeasure = () => {
      measure();
      apply();
    };

    measure();
    apply();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', remeasure);
    // 圖片載進來會把章節往下推,錨點跟著失準。ResizeObserver 不是每個環境都有
    // (jsdom 就沒有),沒有就只靠 resize 事件 —— 少了一種重量時機,不是壞掉。
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(remeasure) : undefined;
    ro?.observe(host);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', remeasure);
      ro?.disconnect();
    };
  }, [root]);

  return progress;
}

/** 章節數 − 1,也就是進度的上限。相機的 waypoint 數量必須與它相同。 */
export const PROGRESS_MAX = CHAPTERS.length - 1;
