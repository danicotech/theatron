import type { AnchorHTMLAttributes, ReactNode } from 'react';

import styles from './InkLink.module.css';

/**
 * 目錄式的連結:一行字、一條細線、右端一個斜箭頭。
 *
 * 這個世界裡的連結不是按鈕 —— 是告示上「另見某處」的那一行。
 * 所以它佔滿一整行、底下一條線,而不是一顆有圓角的方塊。
 *
 * 主要連結由 accent-action-primary 提供明暗主題配對，不借用危險色。
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
