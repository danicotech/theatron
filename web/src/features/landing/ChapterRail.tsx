'use client';

import { useRef, type KeyboardEvent } from 'react';

import { CHAPTERS, type ChapterId } from './chapters';
import styles from './ChapterRail.module.css';

export interface ChapterRailProps {
  active: ChapterId;
}

/**
 * 右緣的章節軌道:七條短線,現在這一章是最長也最亮的那條。
 *
 * 它同時是「我在哪」與「可以跳到哪」。用連結而不是按鈕 —— 目的地是頁面上的
 * 一個位置,那就是連結;而且這樣沒有 JS 也能用,鍵盤與右鍵開新分頁也照常。
 *
 * # 方向鍵
 *
 * 方向鍵**只在焦點已經在軌道裡**的時候移動焦點。這是刻意的:整頁攔截方向鍵
 * 會把瀏覽器內建的捲動拿走,而那是使用者早就學會的東西 —— 一個網站沒有資格
 * 把它換掉。進到軌道之後,上下左右在七章之間走、Home/End 到頭尾、
 * Enter 或 Space 跳過去(連結本來就吃這兩個鍵)。
 *
 * 焦點移動不必節流:它一次只動一格,按住不放是使用者真的想一直走。需要冷卻的是
 * 「一個手勢跳好幾章」那種情形,而這個站**沒有把捲動接管成跳章**
 * (design/jianzhong/EXPERIENCE.md:「其餘保持原生捲動,無強制跳章」),
 * 所以那個問題在這裡不存在。
 *
 * 手機上整條收起來:拇指區在下緣,右緣中央是最按不到的地方,而章節目錄
 * 在首屏的清單裡已經有一份完整的了。
 */
export function ChapterRail({ active }: ChapterRailProps) {
  const list = useRef<HTMLUListElement>(null);

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const links = Array.from(list.current?.querySelectorAll<HTMLAnchorElement>('a') ?? []);
    if (links.length === 0) return;
    const here = links.findIndex((a) => a === document.activeElement);
    if (here < 0) return;

    let next: number;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = links.length - 1;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = here + 1;
    else next = here - 1;

    // 不繞回去:第一章按上、第七章按下就是留在原地。繞回去的軌道會讓人以為
    // 自己跳到了別的地方,而這條軌道同時是「我在哪」的指示。
    next = Math.min(Math.max(next, 0), links.length - 1);
    if (next === here) return;
    e.preventDefault();
    links[next]?.focus();
  };

  return (
    <nav className={styles.rail} aria-label="章節捷徑">
      <ul className={styles.list} ref={list} onKeyDown={onKeyDown}>
        {CHAPTERS.map((c) => (
          <li key={c.id}>
            <a
              className={styles.tick}
              href={`#${c.anchor}`}
              aria-current={c.id === active ? 'true' : undefined}
            >
              <i className={styles.mark} aria-hidden="true" />
              <span className={styles.label}>
                {c.id} {c.name}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
