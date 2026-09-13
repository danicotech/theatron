import { CHAPTERS } from './chapters';
import styles from './HeroChapters.module.css';

/**
 * 序幕底部的章節目錄:編號 + 章名 + 這一章要記住的那件事。
 *
 * 編號在這裡是有資訊的 —— 這七章是一個真的序列,殘旗、歸寂、破頂、朱印、
 * 花信、啟門、落款的順序就是讀的順序。(裝飾性的 01/02/03 是 slop-review
 * 點名的東西;這裡不是。)
 *
 * 第三欄不是場景也不是動作,是 `remember` —— 訪客從這一章要帶走的那一件事。
 * 目錄的用途是「我要找的東西在哪一章」,所以列的該是答案在哪裡,
 * 不是那一章長什麼樣子。
 *
 * 不做「現在在這一章」的高亮:那件事右緣的軌道已經在做,而序幕的目錄多半只
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
                <b className={styles.label}>{c.name}</b>
                <span className={styles.line}>{c.remember}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
