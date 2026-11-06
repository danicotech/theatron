import { themeAttributes, ThemeStyle } from '@theatron/ui';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@theatron/ui/tokens.css';
import './globals.css';
import './typography.css';
import '../features/chrome/help-hints.css';
import './interaction.css';
import '../features/chrome/site-navigation.css';
import './color-mode.css';
import '../features/chrome/brand-identity.css';
import '../features/chrome/ink-wave.css';
import '../features/chrome/plaque-navigation.css';
import '../features/chrome/bounty-navigation.css';
import '../features/chrome/theme-toggle.css';
import '../features/chrome/ink-close.css';
import './paper-window.css';
import './large-screen.css';

import { SiteChrome } from '../features/chrome/SiteChrome';
import { lunjianExtraCss, lunjianTheme } from '../theme/lunjian';
import { HomeNavigation } from './home/HomeNavigation';
import { HOME_REVISION } from './home/homeMarkup';
import { TIMBER_NAVIGATION_HREF } from './timberNavigation';

export const metadata: Metadata = {
  title: { default: '夜鴉閣 | 論劍試鋒', template: '%s | 夜鴉閣 | 論劍試鋒' },
  description: '賽事公告',
};

// 全站統一 Google Noto TC 家族，保留可讀的字體名稱供主題使用。
const GOOGLE_FONTS =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&family=Noto+Serif+TC:wght@400;500;600;700;800;900&display=swap';

const KAGE_IMPORTS: Record<string, string> = {
  'jz/vendor/three.module.js': '/jz/vendor/three.module.js',
  'jz/vendor/GLTFLoader.js': '/jz/vendor/GLTFLoader.js',
  'jz/vendor/BufferGeometryUtils.js': '/jz/vendor/BufferGeometryUtils.js',
  'jz/js/arena-kit.js': '/jz/js/arena-kit.js',
  'jz/js/backdrop-kit.js': '/jz/js/backdrop-kit.js',
  'jz/js/blossom-rig.js': '/jz/js/blossom-rig.js',
  'jz/js/burn-field.js': '/jz/js/burn-field.js',
  'jz/js/camera.js': '/jz/js/camera.js',
  'jz/js/cloth-physics.js': '/jz/js/cloth-physics.js',
  'jz/js/cloth.js': '/jz/js/cloth.js',
  'jz/js/embers.js': '/jz/js/embers.js',
  'jz/js/environment.js': '/jz/js/environment.js',
  'jz/js/flame-rig.js': '/jz/js/flame-rig.js',
  'jz/js/night-crow-title.js': '/jz/js/night-crow-title.js',
  'jz/js/particles.js': '/jz/js/particles-plum.js?v=48',
  'jz/js/plum-geometry.js': '/jz/js/plum-geometry.js',
  'jz/js/raven-emblem.js': '/jz/js/raven-emblem.js',
  'jz/js/raven-standard.js': '/jz/js/raven-standard.js',
  'jz/js/scene.js': '/jz/js/scene.js',
  'jz/js/world.js': '/jz/js/world.js',
  'preview/assets.js': '/preview/assets.js',
  'preview/content.js': '/preview/content.js',
  'preview/layered-art.js': '/preview/layered-art.js',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant" {...themeAttributes(lunjianTheme)} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.dataset.colorMode=localStorage.getItem("lunjian-color-mode")==="dark"?"dark":"light"}catch{document.documentElement.dataset.colorMode="light"}`,
          }}
        />
      </head>
      <body>
        {/* 3D 場地的模組對應表。那 23 個檔在 public/jz 與 public/preview，
            彼此之間用裸名稱互相 import（`jz/js/scene.js`），所以要有這一張表
            瀏覽器才解析得出來。

            為什麼不走打包器：那一包有 1.3 MB 的 three、4 MB 的貼圖常數與
            兩份百萬字級的題字幾何，全都是凍結的第三方產物，不會被 tree-shake
            也不需要型別檢查。丟進 Turbopack 只是讓每次 dev 重編多花好幾秒。
            而且它們彼此用裸名稱互相 import，走打包器就得把 23 個檔的路徑全部重寫。

            實際使用者是 public/lunjian/stage3d.js。 */}
        <script
          type="importmap"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({ imports: KAGE_IMPORTS }) }}
        />
        <ThemeStyle theme={lunjianTheme} />
        {/* 朽木褐、劍光青、枯竹黃 —— 色盤有、但 EventTheme 的欄位裝不下的三個。
            理由與注入方式見 web/src/theme/lunjian.ts。 */}
        <style dangerouslySetInnerHTML={{ __html: lunjianExtraCss() }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" precedence="default" href={GOOGLE_FONTS} />
        {/* 全站導覽：烏鴉、木框、燈籠。來源 design/lunjian/lab/timber-navigation.css。 */}
        <link rel="stylesheet" precedence="high" href={TIMBER_NAVIGATION_HREF} />
        {/* 導覽列是固定的,鍵盤使用者每一頁都得先 tab 過五個連結 —— 跳過它。
            目標是每頁 <main id="main">。首頁自己帶一個，所以這裡也讓開。 */}
        <SiteChrome />
        <HomeNavigation revision={HOME_REVISION} />
        {children}
      </body>
    </html>
  );
}
