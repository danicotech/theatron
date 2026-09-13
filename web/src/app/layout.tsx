import { themeAttributes, ThemeStyle } from '@theatron/ui';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@theatron/ui/tokens.css';
import './globals.css';

import { Atmosphere } from '../features/chrome/Atmosphere';
import { SiteNav } from '../features/chrome/SiteNav';
import { baiyeShifengTheme } from '../theme/baiye-shifeng';

export const metadata: Metadata = {
  title: 'theatron',
  description: '活動前端',
};

// 三個字體角色,不新增。
// Archivo 標題 / Noto Sans TC 內文 / IBM Plex Mono 所有數字。
// 用 <link> 而不是 next/font 的理由:活動主題可以在執行期換掉 --font-display
// (theming.md 允許自訂顯示字體),而 next/font 會把字體名稱雜湊成建置期的常數,
// 執行期換不了。字體名稱要維持字面值,主題注入才對得上。
const GOOGLE_FONTS =
  'https://fonts.googleapis.com/css2' +
  '?family=Archivo:wght@400;500;700;800;900' +
  '&family=IBM+Plex+Mono:wght@400;500;600' +
  '&family=Noto+Sans+TC:wght@400;500;700' +
  // 顯示字體:活動主題(baiye-shifeng)換成了襯線體,見 web/src/theme。
  '&family=Noto+Serif+TC:wght@600;900' +
  '&display=swap';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant" {...themeAttributes(baiyeShifengTheme)}>
      <body>
        <ThemeStyle theme={baiyeShifengTheme} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" precedence="default" href={GOOGLE_FONTS} />
        {/* 導覽列是固定的,鍵盤使用者每一頁都得先 tab 過五個連結 —— 跳過它。
            目標是每頁 <main id="main">。 */}
        <a className="skip-link" href="#main">
          跳到主要內容
        </a>
        <SiteNav />
        {children}
        <Atmosphere />
      </body>
    </html>
  );
}
