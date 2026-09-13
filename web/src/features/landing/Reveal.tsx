import type { ElementType, ReactNode } from 'react';

import styles from './Reveal.module.css';

export interface RevealProps {
  children: ReactNode;
  /** `up` 會帶一點上浮,`fade` 只有透明度。整段文字用 up,圖與細線用 fade。 */
  mode?: 'up' | 'fade';
  /** 預設是 div;要在 <p> 裡面或要當 <li> 用時換掉它。 */
  as?: ElementType;
  className?: string | undefined;
}

/**
 * 進入視窗才出場的包裝。
 *
 * 真正決定何時出場的是 useReveals —— 它掛 data-rv-in,也負責同層元素之間的
 * 延遲。這裡只提供屬性與樣式,所以同一套出場規則在整頁只有一份實作。
 *
 * 刻意不是每個東西都包:整頁都 fade-up 是最好認的 AI 動態簽名。
 * 只有章節的第一段、統計帶、卡片列這些「一組東西」才用它。
 */
export function Reveal({ children, mode = 'up', as, className }: RevealProps) {
  const Tag = as ?? 'div';
  return (
    <Tag className={[styles.rv, className].filter(Boolean).join(' ')} data-rv={mode}>
      {children}
    </Tag>
  );
}
