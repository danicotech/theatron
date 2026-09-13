import type { ReactNode } from 'react';

import styles from './ChapterHead.module.css';

/**
 * 章節式頁首:印記 + 細線 + 大字標題,底下可接引言與事實列。
 *
 * 版面語法來自 kage 的 sec-head:一個小小的章節印記、一條把剩餘寬度撐滿的
 * 髮絲線,然後才是襯線大標。頁面之間的差異全在文字,結構一律相同 ——
 * 跨頁一致本身就是價值,玩家換一頁不該重新學版面。
 *
 * `number` 是印記,不一定是數字。導覽順序上真的有先後的頁面(賽事、對戰表、
 * 規則、注單)用壹貳參肆;裁判台、進站這種不在序列裡的頁面用一個字的印記,
 * 免得替沒有順序的東西編號 —— 那是 slop-review.md 點名的裝飾性編號。
 * 印記只給眼睛看,不進無障礙樹;朗讀「壹」在標題前面只會干擾。
 */
export interface ChapterHeadFact {
  label: ReactNode;
  value: ReactNode;
  /** 數值是數字時開等寬 + tabular-nums。人數、BP、代號都算。 */
  mono?: boolean | undefined;
}

export interface ChapterHeadProps {
  /** 章節印記:'壹' / '01' / '裁'。 */
  number: string;
  /** 印記旁的技術小字,如「百業試鋒 · 對戰表」。 */
  eyebrow?: string | undefined;
  title: ReactNode;
  /** 一段引言,寬度封在 56ch。 */
  lede?: ReactNode | undefined;
  /** 事實列:細線圍成的一條帶,不是卡片。 */
  facts?: ChapterHeadFact[] | undefined;
  /** 髮絲線右端的東西:返回連結、相關頁面。 */
  aside?: ReactNode | undefined;
}

export function ChapterHead({ number, eyebrow, title, lede, facts, aside }: ChapterHeadProps) {
  return (
    <header className={styles.head}>
      <div className={styles.mark}>
        <span className={styles.k}>
          <b className={styles.number} aria-hidden="true">
            {number}
          </b>
          {eyebrow === undefined ? null : <span className={styles.eyebrow}>{eyebrow}</span>}
        </span>
        <span className={styles.rule} aria-hidden="true" />
        {aside === undefined ? null : <div className={styles.aside}>{aside}</div>}
      </div>
      <h1 className={styles.title}>{title}</h1>
      {lede === undefined ? null : <p className={styles.lede}>{lede}</p>}
      {facts === undefined || facts.length === 0 ? null : (
        <dl className={styles.facts}>
          {facts.map((f, i) => (
            <div key={i} className={styles.fact}>
              <dt className={styles.factLabel}>{f.label}</dt>
              <dd className={[styles.factValue, f.mono === true ? styles.mono : ''].join(' ')}>
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}
