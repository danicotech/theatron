'use client';

import { useRef } from 'react';

import { CONTENT, isPlaceholder, TBA } from '../content';
import { usePrefersReducedMotion } from '../usePrefersReducedMotion';
import { useEnterState } from '../useEnterState';
import styles from './RuleScroll.module.css';

/**
 * 第三章〈破頂〉:桌上一卷舊捲軸展開,裡面是組別、規則、評審。
 *
 * **捲軸是真的 HTML。** 它不是畫在 canvas 上的一張捲軸圖 —— 組別是 `<ul>`、
 * 規則是 `<ol>`、評審是 `<ul>`,標題是真的 `<h3>`。關掉 JS、關掉 WebGL、
 * 用螢幕閱讀器,這一章仍然是完整的一份賽制說明。展開只是展開。
 *
 * 展開的作法是**上下兩塊軸捲從中間讓開**,不是 `height: 0 → auto`:
 * 高度動畫要嘛量不到終點、要嘛每格重排版面;而捲軸本來就是兩根軸在走,
 * 讓軸走比讓紙長高更接近那個動作,也只動 transform。
 *
 * 沒有內容的時候寫「待公布」,不編。
 */
export function RuleScroll() {
  const host = useRef<HTMLDivElement>(null);
  // 偏好自己讀,不從 page.tsx 傳下來 —— 那是伺服器元件,它讀不到瀏覽器的偏好。
  const state = useEnterState(host, usePrefersReducedMotion());

  const sections: ReadonlyArray<{ head: string; items: readonly string[]; ordered: boolean }> = [
    { head: '組別', items: CONTENT.divisions, ordered: false },
    { head: '規則', items: CONTENT.rules, ordered: true },
    { head: '評審', items: CONTENT.judges, ordered: false },
  ];

  return (
    <div className={styles.table} ref={host} data-state={state} data-testid="rule-scroll">
      {/* 兩根軸。它們是捲軸的一部分,沒有一個字,所以對輔助科技隱藏。 */}
      <span className={`${styles.rod} ${styles.rodTop}`} aria-hidden="true" />
      <span className={`${styles.rod} ${styles.rodBottom}`} aria-hidden="true" />

      <div className={styles.paper}>
        {sections.map(({ head, items, ordered }) => {
          const List = ordered ? 'ol' : 'ul';
          const empty = items.every(isPlaceholder);
          return (
            <section className={styles.block} key={head}>
              <h3 className={styles.head}>{head}</h3>
              {empty ? (
                <p className={styles.tba}>{TBA}</p>
              ) : (
                <List className={ordered ? styles.ordered : styles.plain}>
                  {items.map((item, i) => (
                    <li className={styles.item} key={`${head}-${i}`}>
                      {item}
                    </li>
                  ))}
                </List>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
