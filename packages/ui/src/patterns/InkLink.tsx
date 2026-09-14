import type { AnchorHTMLAttributes, ReactNode } from 'react';

import styles from './InkLink.module.css';

/**
 * 目錄式的連結:一行字、一條細線、右端一個斜箭頭。
 *
 * 這個世界裡的連結不是按鈕 —— 是告示上「另見某處」的那一行。
 * 所以它佔滿一整行、底下一條線,而不是一顆有圓角的方塊。
 *
 * # 它為什麼必須是共用元件
 *
 * 朱紅直接印在宣紙上只有 3.68:1。在夜色上它是最亮的一點,在紙上它是最淡的一點 ——
 * 同一個顏色在兩種底上要不同的值。這條修正先前手刻在五個頁面的 CSS 裡,
 * 每一頁各記一次同樣的算式,而漏掉的那一頁不會有任何東西報錯,只是變得難讀。
 * 現在它住在 `PaperCard` 的 `--state-live` 重新定義裡,這個元件直接吃語意 slot 就對。
 *
 * 箭頭對輔助科技隱藏:它是「這會帶你去別的地方」的視覺提示,而那件事連結本身
 * 已經說了。
 */
export interface InkLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> {
  children: ReactNode;
  /** 連結底下那一行小字。說明它會帶你去哪裡。 */
  hint?: ReactNode | undefined;
  /** 朱紅的那一條(主要動作),還是安靜的那一條。一個畫面上只該有一條是朱紅。 */
  tone?: 'ink' | 'vermilion' | undefined;
}

export function InkLink({ children, hint, tone = 'ink', className, ...rest }: InkLinkProps) {
  return (
    <a className={[styles.link, styles[tone], className].filter(Boolean).join(' ')} {...rest}>
      <span className={styles.text}>
        <span className={styles.label}>{children}</span>
        {hint === undefined ? null : <span className={styles.hint}>{hint}</span>}
      </span>
      <span className={styles.arrow} aria-hidden="true">
        ↗
      </span>
    </a>
  );
}
