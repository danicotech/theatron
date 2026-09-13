import type { CSSProperties } from 'react';

import styles from './Plum.module.css';

/**
 * 梅 —— 枝與花分開兩支,因為它們的職責不同。
 *
 * `PlumBranch` 是布景:一條橫過畫面的枯枝,純裝飾,對輔助科技完全隱藏。
 * `Blossom` 是**狀態**:第五章每個日期是一朵花,到期才開。所以它吃一個 0…1 的
 * 開放度,而不是一個 `bloomed` 布林 —— 序幕裡枯梅接住最後一滴時那朵花是被
 * 捲動刮開的,中間的每一格都要有。
 *
 * 一份實作兩個地方用(序幕的枯梅、第五章的時程),這是「一個概念只有一個
 * 權威位置」:兩邊的花如果各畫一份,遲早會變成兩種花。
 *
 * 為什麼是 SVG 不是圖檔:規格要的梅枝去背素材只有一件雪景版(素材缺口第三節),
 * 而它的色調跟這個色盤對不上。畫出來的枝可以吃主題色,而且縮到 390 寬不會糊。
 */

export interface PlumBranchProps {
  /** 從哪一邊伸進來。 */
  from?: 'left' | 'right';
  className?: string | undefined;
}

export function PlumBranch({ from = 'right', className }: PlumBranchProps) {
  return (
    <svg
      className={[styles.branch, from === 'left' ? styles.fromLeft : '', className]
        .filter(Boolean)
        .join(' ')}
      viewBox="0 0 400 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* 主枝。三段不同曲率 —— 等曲率的弧線讀起來是電線,不是枝。 */}
      <path
        className={styles.wood}
        d="M400 96 C 336 92, 302 74, 258 70 C 208 65, 176 80, 128 72 C 86 65, 52 40, 0 30"
      />
      {/* 兩根分枝。往上翹,因為梅是往光的地方長的。 */}
      <path className={styles.twig} d="M258 70 C 246 54, 230 44, 206 38" />
      <path className={styles.twig} d="M128 72 C 124 58, 112 48, 92 44" />
    </svg>
  );
}

export interface BlossomProps {
  /**
   * 0 是花苞,1 是全開。
   *
   * **不給就不寫 inline style** —— 這時候開放度由外層繼承下來的 `--bloom` 決定。
   * 序幕那一朵是被捲動每格刮開的,寫成 inline style 等於每格重繪一次 React 樹;
   * 讓它吃繼承的變數,舞台把數字寫在自己身上就好。
   */
  open?: number | undefined;
  /** 這朵花是什麼。有的話會進無障礙樹;沒有就是純裝飾。 */
  label?: string | undefined;
  className?: string | undefined;
}

/** 五瓣。梅是五瓣的,四瓣或六瓣會讀成別的花。 */
const PETALS = [0, 72, 144, 216, 288];

export function Blossom({ open, label, className }: BlossomProps) {
  const decorative = label === undefined;
  return (
    <svg
      className={[styles.blossom, className].filter(Boolean).join(' ')}
      viewBox="-20 -20 40 40"
      style={
        open === undefined
          ? undefined
          : ({ '--bloom': Math.max(0, Math.min(1, open)).toFixed(3) } as CSSProperties)
      }
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? 'true' : undefined}
      aria-label={label}
      focusable="false"
      data-open={open !== undefined && open >= 1 ? '' : undefined}
    >
      {/* 旋轉掛在 <g> 上而不是花瓣自己身上:花瓣要用 CSS transform 做「散開」,
          而 CSS 的 transform 會整個蓋掉 SVG 的 transform 屬性 —— 兩個擠同一格,
          五瓣就會疊成一瓣。 */}
      {PETALS.map((deg) => (
        <g key={deg} transform={`rotate(${deg})`}>
          <ellipse className={styles.petal} cx="0" cy="-9" rx="5.4" ry="7.2" />
        </g>
      ))}
      <circle className={styles.heart} cx="0" cy="0" r="2.6" />
    </svg>
  );
}
