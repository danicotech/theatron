import styles from './InkTitle.module.css';

/**
 * 毛筆題字。真的手跡,描成 SVG 之後當形狀用。
 *
 * 為什麼不是 `<img>`:墨跡本身是黑的,貼在夜色上等於看不見。這裡把 SVG 當
 * **遮罩**挖出字形,顏色由樣式層給 —— 所以同一個檔在暗底上是骨白、在紙上是墨黑,
 * 換主題不必重出圖。
 *
 * 為什麼不收素材 id 而是收 URL:`packages/ui` 不知道素材清冊長什麼樣,
 * 也不該知道。解析 id 是 app 的事,這裡只收一個能放進 `url()` 的位址。
 *
 * 它在畫面上讀得出來,所以也要唸得出來 —— `role="img"` 加上 `text`。
 * 題字寫的字通常不是旁邊標題的重述(章名是敘事的,題字是事務的),不算多唸一次。
 */
export interface InkTitleProps {
  /** 題字 SVG 的位址。會放進 `mask-image: url(...)`。 */
  src: string;
  /** 那幅字寫的是什麼。給輔助科技唸。 */
  text: string;
  /** 字的長寬比(寬 / 高)。高度由樣式定,寬度由這個推。 */
  ratio: number;
  /**
   * 用在哪一種底上。`dark` 是暗底上的骨白(預設),`paper` 是紙上的墨。
   * 這個選擇不能自動 —— 元件不知道自己被放在什麼顏色上面。
   */
  on?: 'dark' | 'paper' | undefined;
  /** 級數。`lead` 是一段的主題字,`mark` 是表頭上的小印記。 */
  size?: 'lead' | 'mark' | undefined;
  className?: string | undefined;
}

export function InkTitle({
  src,
  text,
  ratio,
  on = 'dark',
  size = 'mark',
  className,
}: InkTitleProps) {
  return (
    <span
      className={[styles.ink, styles[on], styles[size], className].filter(Boolean).join(' ')}
      role="img"
      aria-label={text}
      style={{
        // 兩個字與四個字的題字掛在同一個表頭上,該一樣高而不是一樣寬。
        ['--ink-src' as string]: `url(${src})`,
        ['--ink-ratio' as string]: `${ratio}`,
      }}
    />
  );
}
