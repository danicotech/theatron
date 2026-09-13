import { useEffect, useRef, useState, type RefObject } from 'react';

import type { UiState } from './uiState';

/**
 * 「捲進來就演一次」的東西的狀態機。
 *
 * 捲軸展開、紅印逐一蓋上 —— 這兩件事沒有人按,它們由捲動觸發。但它們仍然是
 * 會動的元件,所以仍然要說得出自己在哪一個狀態(uiState.ts)。這支把那條路徑
 * 收成一份:
 *
 *   idle ──進入視窗──▶ activating ──演完──▶ active
 *
 * 沒有 `loading`:內容是伺服器端就畫好的 HTML,沒有東西要等。這一點很重要 ——
 * 假裝在載入、然後才把早就在的字放出來,是最沒有必要的一種等待。
 *
 * 演過就不再演:往回捲的時候捲軸不該把自己捲回去。所以觀察器看到一次就收掉。
 * 這也是「回到前一章保留進度」的具體樣子 —— 看過的東西維持看過的樣子。
 *
 * 不想看到動的人直接是 active:東西一開始就在它該在的位置上。
 */
export function useEnterState(target: RefObject<HTMLElement | null>, reduced: boolean): UiState {
  const [state, setState] = useState<UiState>(reduced ? 'active' : 'idle');
  const timer = useRef(0);

  useEffect(() => {
    if (reduced) {
      setState('active');
      return;
    }
    const el = target.current;
    if (el === null) return;

    // 沒有觀察器就直接演完。看不到內容比看不到動畫嚴重得多。
    if (!('IntersectionObserver' in window)) {
      setState('active');
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.disconnect();
          setState('activating');
          // 演完才算 active。時間與 CSS 那邊的 transition 對齊,
          // 兩邊的數字都指向同一個 token,不會各改各的。
          timer.current = window.setTimeout(() => setState('active'), 1200);
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      clearTimeout(timer.current);
    };
  }, [target, reduced]);

  return state;
}
