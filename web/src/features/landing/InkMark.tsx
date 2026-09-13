import type { ChapterMark } from './chapters';
import styles from './InkMark.module.css';
import { worldAsset } from './world';

export interface InkMarkProps {
  mark: ChapterMark;
}

/**
 * 章節表頭的主題題字 —— 真的毛筆手跡。
 *
 * 來源是 `design/cinematic-media-kit` 那七張題字 PNG,用 `theatron/scripts/trace-ink.py`
 * 描成 SVG。描而不是直接貼圖有兩個理由:題字要隨版面放大,點陣一放大飛白就糊掉;
 * 而向量可以只當**形狀**用,顏色留給樣式層決定。
 *
 * 所以這裡不是 `<img>` 而是一個用 `mask-image` 挖出字形的方塊:墨跡本身是黑的,
 * 貼在夜色上等於看不見,只有把它當遮罩、拿骨白去填,才是紙上那一筆的樣子。
 *
 * 它在畫面上讀得出來,所以也要唸得出來 —— `role="img"` + 帳冊裡的 `text`。
 * 這幅字寫的不是章名,是這一章辦的事(戰帖、賽制、賽程),不算重述。
 */
export function InkMark({ mark }: InkMarkProps) {
  const a = worldAsset(mark.asset);
  return (
    <span
      className={styles.mark}
      role="img"
      aria-label={mark.text}
      style={{
        // 高度由樣式定,寬度由字本身的長寬比推 —— 兩個字與四個字的題字
        // 掛在同一個表頭上,該一樣高而不是一樣寬。
        ['--ink-src' as string]: `url(${a.file})`,
        ['--ink-ratio' as string]: `${a.width} / ${a.height}`,
      }}
    />
  );
}
