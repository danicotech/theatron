'use client';

import { useEffect, useRef, useState } from 'react';

import styles from './Reticle.module.css';

/**
 * 準心。只在有精細指標的裝置上出現。
 *
 * 「只在 fine pointer」不是效能考量,是它在觸控上**根本沒有意義**:手指沒有
 * 懸停位置,一個跟著上一次點擊跑的十字只是一塊擋住內容的東西。所以判斷用
 * `(pointer: fine)`,不是螢幕寬度 —— 有觸控螢幕的筆電仍然有滑鼠。
 *
 * 它報三件事:座標(這個世界是被量過的)、一個微環(指標還活著)、
 * 以及壓在可啟動的東西上時的那一行字。第三件是它存在的理由 ——
 * 一個只是跟著滑鼠跑的圓圈是裝飾,而會告訴你「這個可以按」的準心是介面。
 *
 * 不取代系統游標:`cursor` 保持原樣。把系統游標藏起來是最常見的那種
 * 「有設計感但難用」—— 使用者會失去所有他已經學會的形狀提示(文字的 I 形、
 * 連結的手、拖曳的十字)。
 */

/** 壓在可啟動的東西上時報這一行。規格指定的字,不改寫。 */
const HOT_LABEL = '[CLICK TO REANIMATE // 啟動]';

export function Reticle() {
  const host = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const [fine, setFine] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(pointer: fine)');
    const sync = () => setFine(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const el = host.current;
    if (el === null || !fine) return;

    let frame = 0;
    let x = 0;
    let y = 0;
    let hot = false;

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      // 壓在什麼上面:用 composedPath 的第一個元素往上找,不是自己算命中測試。
      // 瀏覽器已經做過這件事了,再做一次只會跟它的答案不一致。
      const el2 = e.target;
      hot =
        el2 instanceof Element &&
        el2.closest('a, button, [role="button"], input, select, textarea, summary') !== null;
      schedule();
    };

    const write = () => {
      frame = 0;
      // 指標動過一次就算「活著」。不用 pointerenter —— 那個事件不冒泡,掛在
      // document 上有機會一次都不來,而那時候準心會整個看不見。
      el.dataset.live = '';
      el.style.setProperty('--rx', `${x}px`);
      el.style.setProperty('--ry', `${y}px`);
      if (hot) el.dataset.hot = '';
      else delete el.dataset.hot;
      if (readout.current !== null) {
        // 座標是整數:一個跳著小數點的讀數看起來像壞掉,不像在量東西。
        readout.current.textContent = hot
          ? HOT_LABEL
          : `${String(Math.round(x)).padStart(4, '0')} · ${String(Math.round(y)).padStart(4, '0')}`;
      }
    };

    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(write);
    };

    // 指標離開視窗就收起來:一個停在邊緣的準心讀起來是卡住了。
    const onOut = (e: PointerEvent) => {
      if (e.relatedTarget === null) delete el.dataset.live;
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerout', onOut);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerout', onOut);
    };
  }, [fine]);

  // 觸控裝置上根本不掛。看不見的 DOM 仍然是 DOM。
  if (!fine) return null;

  return (
    <div className={styles.reticle} ref={host} aria-hidden="true" data-testid="reticle">
      <span className={styles.ring} />
      <span className={styles.cross} />
      <span className={styles.readout} ref={readout} />
    </div>
  );
}
