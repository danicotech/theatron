import type { ReactNode } from 'react';

import { Colophon } from '../../../features/chrome/Colophon';
import { WorldBackdrop } from '../../../features/chrome/WorldBackdrop';

/**
 * 賽事底下所有功能頁共用的殼:一張壓暗的場景板在底下、一個小頁尾在底下。
 * 各頁自己的 <main> 仍由 page.tsx 提供 —— 頁面的寬度與欄位(有沒有投注單 dock)
 * 是頁面的事,這一層只管世界。
 */
export default function TournamentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <WorldBackdrop />
      {children}
      <Colophon />
    </>
  );
}
