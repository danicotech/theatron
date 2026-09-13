import styles from './Atmosphere.module.css';

/**
 * 兩層鋪在整個畫面上的「底片」:顆粒與暗角。
 *
 * 它們把頁面當一張圖處理 —— 導覽列、選單、內容全在同一層底片下,
 * 所以 z-index 在導覽列(50)之上。兩層都是靜態的,沒有動畫,
 * reduced-motion 下也留著:那是對「動」的偏好,不是對「質感」的。
 */
export function Atmosphere() {
  return (
    <>
      <div className={styles.vignette} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />
    </>
  );
}
