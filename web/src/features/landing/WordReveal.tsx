import { Fragment, type CSSProperties, type ElementType } from 'react';

import { SPACE, splitUnits } from './splitUnits';
import styles from './WordReveal.module.css';

/** 一個字接一個字之間隔多久。低於 50ms 看起來像一起出現,高於 100ms 會等。 */
const STEP_MS = 70;

export interface WordRevealProps {
  text: string;
  /**
   * 要變成哪個元素。沒有預設值是刻意的:整串字靠 aria-label 留在無障礙樹裡,
   * 而 aria-label 只准掛在有角色的元素上 —— 一個光禿禿的 <span> 不算。
   * 所以呼叫端一定要說清楚這是 h1 還是 h2。
   */
  as: ElementType;
  /**
   * 逐筆現出由**捲動**驅動,不是由計時器。
   *
   * 序幕的標題必須跟著刮 —— 往回捲的時候字要一筆一筆收回去。所以那一支不能用
   * CSS 的 delay(delay 是時間,倒著刮不會倒著跑),改成每個字看一個
   * `--rv-scrub`(0…1)決定自己出來了沒。那個變數由 Prologue 每格直接寫在
   * 這個元素上,不經過 React —— 每格重繪一行標題是沒必要的。
   */
  scrub?: boolean;
  className?: string | undefined;
  id?: string | undefined;
}

/**
 * 逐字出場的標題。
 *
 * 切字的規矩在 splitUnits:中文逐字、拉丁字串整塊、標點黏在鄰字上。
 * 這裡只負責包遮罩 —— 每個字關在一個 overflow:hidden 的框裡,從框底下升上來,
 * 所以是「浮出水面」而不是「從別處飛進來」。
 *
 * 拆開的部分 aria-hidden,整串字走 aria-label:螢幕閱讀器唸一串被切碎的字是
 * 壞掉的,不是有質感。也不另外藏一份純文字 —— 那會讓標題在 DOM 裡出現兩次,
 * 複製貼上就變成「赴約赴約」。
 *
 * 沒有 JS 時字是看得見的 —— 起手式綁在 scripting: enabled 上,理由寫在 CSS 裡。
 */
export function WordReveal({ text, as, scrub = false, className, id }: WordRevealProps) {
  const Tag = as;
  const units = splitUnits(text);
  const count = units.filter((u) => u !== SPACE).length;
  let index = 0;

  return (
    <Tag
      className={[styles.line, scrub ? styles.scrubbed : '', className].filter(Boolean).join(' ')}
      data-rv={scrub ? undefined : 'fade'}
      data-rv-scrub={scrub ? '' : undefined}
      aria-label={text}
      id={id}
      style={scrub ? ({ '--unit-count': count } as CSSProperties) : undefined}
    >
      {units.map((unit, i) => {
        if (unit === SPACE) return <Fragment key={i}> </Fragment>;
        const at = index;
        index += 1;
        return (
          <span className={styles.mask} key={i} aria-hidden="true">
            <span
              className={styles.unit}
              style={
                scrub
                  ? ({ '--unit-index': at } as CSSProperties)
                  : ({ '--unit-delay': `${at * STEP_MS}ms` } as CSSProperties)
              }
            >
              {unit}
            </span>
          </span>
        );
      })}
    </Tag>
  );
}
