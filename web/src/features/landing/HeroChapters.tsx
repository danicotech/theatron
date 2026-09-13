import { CHAPTERS } from './chapters';
import styles from './HeroChapters.module.css';

/**
 * 首屏底部的章節目錄:編號 + 章名 + 一句話。
 *
 * 編號在這裡是有資訊的 —— 這五章是一個真的序列,序章、讓武、段位、賽程、
 * 赴約的順序就是讀的順序。(裝飾性的 01/02/03 是 slop-review 點名的東西;
 * 這裡不是。)
 *
 * 不做「現在在這一章」的高亮:那件事右緣的軌道已經在做,而首屏的目錄多半只
 * 在頁面最上方被看一眼。一個畫面只能有一個高音。
 */
export function HeroChapters() {
  return (
    <nav className={styles.chapters} aria-label="章節目錄">
      <ul className={styles.list}>
        {CHAPTERS.map((c) => (
          <li key={c.id}>
            <a className={styles.chip} href={`#${c.anchor}`}>
              <span className={styles.num} aria-hidden="true">
                {c.id}
              </span>
              <span className={styles.text}>
                <b className={styles.label}>{c.label}</b>
                <span className={styles.line}>{c.line}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
