'use client';

import { CHAPTERS, type ChapterId } from './chapters';
import styles from './ChapterRail.module.css';

export interface ChapterRailProps {
  active: ChapterId;
}

/**
 * 右緣的章節軌道:五條短線,現在這一章是最長也最亮的那條。
 *
 * 它同時是「我在哪」與「可以跳到哪」。用連結而不是按鈕 —— 目的地是頁面上的
 * 一個位置,那就是連結;而且這樣沒有 JS 也能用,鍵盤與右鍵開新分頁也照常。
 *
 * 手機上整條收起來:拇指區在下緣,右緣中央是最按不到的地方,而章節目錄
 * 在首屏的 chips 裡已經有一份完整的了。
 */
export function ChapterRail({ active }: ChapterRailProps) {
  return (
    <nav className={styles.rail} aria-label="章節捷徑">
      <ul className={styles.list}>
        {CHAPTERS.map((c) => (
          <li key={c.id}>
            <a
              className={styles.tick}
              href={`#${c.anchor}`}
              aria-current={c.id === active ? 'true' : undefined}
            >
              <i className={styles.mark} aria-hidden="true" />
              <span className={styles.label}>
                {c.id} {c.label}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
