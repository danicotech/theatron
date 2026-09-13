import { useEffect, type RefObject } from 'react';

/**
 * 在序幕的畫面上拖曳 = 刮那一段戲。
 *
 * 關鍵決定:**拖曳不自己維護一個進度,它捲頁面。** 手指往上拖就是
 * `window.scrollBy`,然後 useScrubProgress 照常從捲動位置算出進度。
 * 這樣拖曳、滾輪、鍵盤、跳章、重新整理全部走同一條路 —— 只要有兩份進度,
 * 遲早會有一份是錯的。
 *
 * 三條不准違反的:
 *
 *  1. **只掛在沒有字的那幾塊**(畫布與海報)。掛在整段上會吃掉文字選取。
 *  2. **移動門檻。** 沒超過門檻的就是點擊,不是拖曳 —— 不然按鈕會變得按不動。
 *  3. **只認滑鼠與觸控筆。** 手機的捲動由瀏覽器自己做,攔下來只會比原生的差:
 *     沒有慣性、沒有邊界回彈、沒有系統手勢。`touch-action` 因此保持預設。
 */

/** 超過這麼多像素才算拖曳。低於這個數字,手指的抖動會把每一次點擊都變成拖曳。 */
const DRAG_THRESHOLD_PX = 6;

/** 拖一像素捲多少。大於 1 讓一次拖曳走得完一段 —— 三屏的行程用 1:1 拖不完。 */
const DRAG_GAIN = 2.2;

export function useDragScrub(target: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const el = target.current;
    if (el === null || !enabled) return;

    let pointer = -1;
    let lastY = 0;
    let startY = 0;
    let dragging = false;

    const onDown = (e: PointerEvent) => {
      // 觸控交給瀏覽器。原生捲動有慣性與邊界回彈,攔下來一定比較差。
      if (e.pointerType === 'touch' || e.button !== 0) return;
      pointer = e.pointerId;
      startY = e.clientY;
      lastY = e.clientY;
      dragging = false;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      if (!dragging && Math.abs(e.clientY - startY) < DRAG_THRESHOLD_PX) return;
      if (!dragging) {
        dragging = true;
        el.setPointerCapture(pointer);
        el.dataset.dragging = '';
      }
      window.scrollBy(0, (lastY - e.clientY) * DRAG_GAIN);
      lastY = e.clientY;
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      if (dragging && el.hasPointerCapture(pointer)) el.releasePointerCapture(pointer);
      delete el.dataset.dragging;
      pointer = -1;
      dragging = false;
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);

    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [target, enabled]);
}
