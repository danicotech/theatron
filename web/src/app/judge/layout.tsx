import type { ReactNode } from 'react';

import { WorldBackdrop } from '../../features/chrome/WorldBackdrop';

/**
 * 裁判台的殼。板子跟賽事頁同一張,裁判在場邊拿著手機看的畫面不該像另一個網站;
 * 沒有頁尾 —— 裁判頁的最後一個元素是操作鈕,底下不該再有東西讓人多捲。
 */
export default function JudgeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <WorldBackdrop />
      {children}
    </>
  );
}
