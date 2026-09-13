import styles from './WorldBackdrop.module.css';

/**
 * 功能頁底下那張暗掉的場景板。
 *
 * 首頁用的是同一批素材,功能頁只借一張、壓到幾乎看不見 ——
 * 讓人知道自己還在同一個世界裡,但賠率、比分、BP 這些數字必須壓過它。
 * 所以圖上再鋪一層 scrim,而不是把圖本身調得更淡:淡圖在亮處仍會透出來干擾表格。
 *
 * 用 <img> 不用 background-image:瀏覽器能先解碼、能標低優先度,
 * 而它是裝飾,alt 留空、整個容器對輔助科技隱藏。
 */
export interface WorldBackdropProps {
  /** /public/world 下的板子。預設是夜鴉中庭 —— 最暗的一張,最不會搶。 */
  plate?: string | undefined;
}

export function WorldBackdrop({
  plate = '/world/bg-night-crow-courtyard.webp',
}: WorldBackdropProps) {
  return (
    <div className={styles.backdrop} aria-hidden="true" data-testid="world-backdrop">
      <img className={styles.plate} src={plate} alt="" decoding="async" fetchPriority="low" />
      <div className={styles.scrim} />
    </div>
  );
}
