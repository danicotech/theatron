import type { ReactNode } from 'react';

import styles from './SectionHead.module.css';

/**
 * 小節表頭:頂上一條細線、左邊中文標題、右邊全大寫英文。
 *
 * 與 `ChapterHead` 的分工是層級,不是外觀:`ChapterHead` 是一頁只有一個的 h1,
 * 帶引言與事實列;這一個是頁裡面的每一小節,只有一行。
 *
 * 那條頂線與它上面的 23px 不是隨手選的 —— 它們是這一套版面語法的節奏
 * (量測記錄在 notes/2026-09-14-劍塚-三幕重構-grill.md 的 Q14)。
 * 手刻在每一個頁面的 CSS 裡的話,調一次要改五個檔,而且遲早有一個會漏掉。
 *
 * 英文那一半對輔助科技隱藏:它是同一件事的第二種寫法,唸兩次只是噪音。
 */
export interface SectionHeadProps {
  /** 中文標題。 */
  children: ReactNode;
  /** 右側的全大寫英文。省略就只有標題與線。 */
  en?: string | undefined;
  /** 標題層級。小節預設是 h2。 */
  level?: 2 | 3 | undefined;
  /** 標題的 id,給頁內錨點與 aria-labelledby 用。 */
  id?: string | undefined;
  /** 題字。掛在標題左邊 —— 它說的是這一節在辦什麼事。 */
  mark?: ReactNode | undefined;
}

/** 標題層級 → 標籤名。查表而不是字串拼接:拼出來的字串型別上不是標籤名。 */
const HEADINGS = { 2: 'h2', 3: 'h3' } as const;

export function SectionHead({ children, en, level = 2, id, mark }: SectionHeadProps) {
  const Heading = HEADINGS[level];
  return (
    <header className={styles.head}>
      <Heading className={styles.title} id={id}>
        {mark === undefined ? null : <span className={styles.mark}>{mark}</span>}
        {children}
      </Heading>
      {en === undefined ? null : (
        <span className={styles.en} aria-hidden="true">
          {en}
        </span>
      )}
    </header>
  );
}
