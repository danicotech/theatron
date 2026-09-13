import styles from './Colophon.module.css';

/**
 * 功能頁的頁尾:一條線、一行小字。
 *
 * 首頁的頁尾是另一位工程師的;這個只給功能頁用,所以刻意小 —— 對戰表、
 * 注單這些頁面看完就走,頁尾只是告訴人「到底了」,不是再放一份導覽。
 *
 * 只留中文名:羅馬拼音已經在導覽列的字標底下,而導覽列一直在畫面上。
 * 同一個名字在同一畫面上出現兩次,第二次就只是裝飾。
 */
export function Colophon() {
  return (
    <footer className={styles.foot}>
      <span className={styles.rail} aria-hidden="true" />
      <p className={styles.line}>百業試鋒 · 讓武 BP</p>
    </footer>
  );
}
