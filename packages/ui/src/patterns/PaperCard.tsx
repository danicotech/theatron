import type { ReactNode } from 'react';

import styles from './PaperCard.module.css';

/**
 * 紙質告示面板。暗底上被貼上去的一張紙。
 *
 * 為什麼是紙而不是卡片:這個世界裡的資訊本來就長在紙上 —— 戰帖、告示、
 * 榜單、獎狀。一張紙有它自己的規矩,而那些規矩正好是好的資訊設計:
 * 頁首有編號、正文置中、條目用細線分欄、底下留一條給落款。
 * 「卡片」是介面的隱喻,「告示」是這件事本來的樣子。
 *
 * **紙是反相的表面。** 整站是暗底亮字,只有這裡是亮底暗字,所以紙上的一切
 * 只能用 `--text-on-paper` / `--border-crease`,不能用 `--text-primary`
 * (那是給暗底用的,印在紙上會看不見)。這一條是這個元件存在的主要理由:
 * 把反相封在一個地方,別讓每個用到紙的頁面各自處理一次。
 *
 * 不用 glassmorphism、不用陰影堆層次。紙的層次來自它的**邊**:
 * 微微歪斜、內側一條雙線框、四邊不規則。
 *
 * 這一層不知道賽事規則,只收 props。
 */
export interface PaperCardRow {
  label: ReactNode;
  value: ReactNode;
  /** 值是數字時開等寬 + tabular-nums。日期、金額、人數、BP 都算。 */
  mono?: boolean | undefined;
}

export interface PaperCardProps {
  /** 頁首左側的小字,如「江湖令」。 */
  kicker?: ReactNode | undefined;
  /** 頁首右側的編號,如「PUBLIC NOTICE / 001」。等寬、全大寫。 */
  index?: string | undefined;
  /** 置中大標。 */
  title?: ReactNode | undefined;
  /** 大標底下的一行副標。 */
  subtitle?: ReactNode | undefined;
  /** 標題的層級。紙可能是頁面的第二層,也可能是一段裡的第三層。 */
  headingLevel?: 2 | 3 | 4 | undefined;
  /** 條目列:標籤靠左、值靠右,每列一條折痕。 */
  rows?: readonly PaperCardRow[] | undefined;
  /** 條目底下的小字說明。 */
  note?: ReactNode | undefined;
  /** 最底下那一列:連結、按鈕、落款。 */
  action?: ReactNode | undefined;
  /** 蓋在紙上的印。位置固定在右下,因為印是最後蓋的。 */
  stamp?: ReactNode | undefined;
  /**
   * 歪斜。紙是被人貼上去的,不會正。
   * 同一個畫面上的幾張紙要歪向不同邊,全部同一個角度反而更假。
   */
  tilt?: 'left' | 'right' | 'none' | undefined;
  children?: ReactNode | undefined;
}

/** 標題層級 → 標籤名。查表而不是字串拼接:拼出來的字串型別上不是標籤名。 */
const HEADINGS = { 2: 'h2', 3: 'h3', 4: 'h4' } as const;

export function PaperCard({
  kicker,
  index,
  title,
  subtitle,
  headingLevel = 3,
  rows,
  note,
  action,
  stamp,
  tilt = 'right',
  children,
}: PaperCardProps) {
  const Heading = HEADINGS[headingLevel];
  const hasTop = kicker !== undefined || index !== undefined;

  return (
    <div className={[styles.sheet, styles[tilt]].join(' ')}>
      <div className={[styles.paper, stamp === undefined ? '' : styles.stamped].join(' ')}>
        {/* 內框。朱文印的邊比字粗,紙的內框同理 —— 它是「這是一份正式文件」
            的訊號,不是裝飾。 */}
        <span className={styles.frame} aria-hidden="true" />

        {hasTop ? (
          <div className={styles.top}>
            <span className={styles.kicker}>{kicker}</span>
            {index === undefined ? null : <span className={styles.index}>{index}</span>}
          </div>
        ) : null}

        {title === undefined ? null : (
          <Heading className={styles.title}>
            {title}
            {subtitle === undefined ? null : <small className={styles.subtitle}>{subtitle}</small>}
          </Heading>
        )}

        {children === undefined ? null : <div className={styles.body}>{children}</div>}

        {rows === undefined || rows.length === 0 ? null : (
          <dl className={styles.rows}>
            {rows.map((r, i) => (
              <div key={i} className={styles.row}>
                <dt className={styles.rowLabel}>{r.label}</dt>
                <dd className={[styles.rowValue, r.mono === true ? styles.mono : ''].join(' ')}>
                  {r.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {note === undefined ? null : <p className={styles.note}>{note}</p>}
        {action === undefined ? null : <div className={styles.action}>{action}</div>}
        {stamp === undefined ? null : (
          <span className={styles.stamp} aria-hidden="true">
            {stamp}
          </span>
        )}
      </div>
    </div>
  );
}
