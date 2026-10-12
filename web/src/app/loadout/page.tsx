import type { Metadata } from 'next';

import { LoadoutRuntime } from './LoadoutRuntime';
import { LOADOUT_MARKUP, LOADOUT_VERSION } from './loadoutMarkup';

/**
 * 備戰方案配置器。
 *
 * 版面、視覺、全部的互動來自 `scrollcraft/builds/lunjian/lab/loadout.html`，
 * 由 `lab/tools/loadout-to-theatron.py` 生成到 `public/loadout/` 與 `loadoutMarkup.ts`。
 * **不要在這裡改版面** —— 改 lab 那一份再重跑腳本，否則兩邊立刻分岔。
 * 首頁（論劍）走的是同一條規矩，這裡只是照抄那個做法。
 *
 * 這一頁沒有後端：方案存在瀏覽器的 localStorage，要帶走就按「匯出 JSON」。
 * 所以它不綁賽事、不需要登入。賽事底下的 `/t/[slug]/me/loadout` 會導到這裡。
 */
export const metadata: Metadata = {
  title: '我的武學配置 · 論劍',
  description: '配流派、心法、奇術與八件裝備，算出屬性總計與畢業率，產生可以貼進報名的方案文字。',
};

export default function Page() {
  return (
    <>
      {/* ?v= 是破快取。這兩支的網址是固定的（不像 lab 那一份帶版本），
          沒有它的話，重新生成之後瀏覽器可能繼續跑舊的 css／js ——
          畫面看起來就是「按了沒反應」。版本是內容雜湊，內容沒變就不換。 */}
      <link
        rel="stylesheet"
        precedence="default"
        href={`/loadout/loadout.css?v=${LOADOUT_VERSION}`}
      />
      {/* suppressHydrationWarning：這段標記落地之後會被 loadout.js 大改 ——
          填流派、心法、倉庫卡片、雷達與報名文字。React 比對伺服器與客戶端
          兩份 DOM 時會看到差異並警告，但那個差異是刻意的，不是壞掉。 */}
      <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: LOADOUT_MARKUP }} />
      <LoadoutRuntime />
    </>
  );
}
