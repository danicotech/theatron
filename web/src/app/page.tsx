import type { Metadata } from 'next';

import { SportsbookBridge } from '../features/sportsbook/SportsbookBridge';
import { LunjianRuntime } from './LunjianRuntime';
import { LUNJIAN_MARKUP, LUNJIAN_REVISION } from './lunjianMarkup';

/**
 * 《論劍》首頁。
 *
 * 版面、視覺、捲動敘事全部來自 `scrollcraft/builds/lunjian/lab/lunjian-layout.html`，
 * 由 `lab/tools/to-theatron.py` 生成到 `public/lunjian/` 與 `lunjianMarkup.ts`。
 * **不要在這裡改版面** —— 改 lab 那一份再重跑腳本，否則兩邊立刻分岔。
 *
 * theatron 原本的三幕劇場（Theatre / Curtain / Acts / WorldScene）不再掛在首頁上。
 * 那一套的元件都還在 features/landing 底下，沒有刪，但首頁不用它們了。
 * 舊的首頁留在 `page.theatre.tsx.bak`，要對照隨時看得到。
 *
 * 標記是伺服器端就算好的整段 HTML：關掉 JS 一樣讀得到七格的內容，
 * 因為那本來就是語意化的 section 與 h2，動的只是上面那層布景。
 */
export const metadata: Metadata = {
  title: '百業試鋒｜群俠赴約',
  description: '論劍，月下論劍。踏雪入關，了解段位與 BP 讓武制度、賽程及報名資訊。',
};

export default function Page() {
  return (
    <>
      <link
        rel="stylesheet"
        precedence="default"
        href={`/lunjian/lunjian.css?v=${LUNJIAN_REVISION}`}
      />
      {/* suppressHydrationWarning：這段標記落地之後會被 lunjian.js 大改 ——
          加 data-on、塞進度軌的七段、填對戰資料。React 比對伺服器與客戶端
          兩份 DOM 時會看到差異並警告，但那個差異是刻意的，不是壞掉。 */}
      <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: LUNJIAN_MARKUP }} />
      <SportsbookBridge />
      <LunjianRuntime key={LUNJIAN_REVISION} revision={LUNJIAN_REVISION} />
    </>
  );
}
