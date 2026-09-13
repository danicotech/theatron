import styles from './InkMark.module.css';
import { worldAsset } from './world';

export interface InkMarkProps {
  /** ink-* 的素材 id。 */
  asset: string;
  /** 靠左或靠右掛。 */
  side?: 'start' | 'end';
}

/**
 * 章節標題後面那張很淡的墨字。
 *
 * 它是題字,不是插圖:戰帖與告示紙上本來就會有一幅比正文大得多的字壓在底下。
 * 所以它淡到幾乎看不見 —— 看得清楚就變成兩個標題在打架。
 *
 * 對輔助科技完全隱藏:上面寫的字是裝飾性的重述,唸出來只會多一次。
 */
export function InkMark({ asset, side = 'start' }: InkMarkProps) {
  const a = worldAsset(asset);
  return (
    <img
      className={`${styles.ink} ${side === 'end' ? styles.end : styles.start}`}
      src={a.file}
      alt=""
      aria-hidden="true"
      width={a.width}
      height={a.height}
      loading="lazy"
      decoding="async"
    />
  );
}
