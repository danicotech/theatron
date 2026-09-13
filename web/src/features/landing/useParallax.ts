import { useEffect, type RefObject } from 'react';

/** 整頁捲到底,背景最多往上走這麼多。配合 SceneLayer 的 scale 留白,不會露出邊。 */
const MAX_SHIFT_VH = 4;

/**
 * 背景的慢視差:把捲動進度寫成 --scene-shift,transform 由 CSS 吃。
 *
 * scroll 事件只負責排一個 rAF,真正的寫入在 frame 裡做,一個 frame 最多一次。
 * 只寫一個 custom property、只動 transform —— 不碰版面,合成器自己搬。
 */
export function useParallax(target: RefObject<HTMLElement | null>, reduced: boolean): void {
  useEffect(() => {
    const el = target.current;
    if (el === null || reduced) return;

    let frame = 0;
    const apply = () => {
      frame = 0;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const t = Math.min(1, Math.max(0, window.scrollY / max));
      el.style.setProperty('--scene-shift', `${(-t * MAX_SHIFT_VH).toFixed(2)}vh`);
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(apply);
    };

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      el.style.removeProperty('--scene-shift');
    };
  }, [target, reduced]);
}
