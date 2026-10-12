# 七章逐筆題字整合

日期：2026-09-21。`chapter-titles.js` 是既有 `brush.js`／`ink-title.js` 的薄控制器，沒有新增動畫框架或另一套字形引擎。每筆的形狀由真實中線經 `brushStroke` 生成，仍沿同一中線以既有 `ink-draw` CSS 書寫；不以整字遮罩假裝逐筆。

## 章名與容器

章名依序為宗旨、規則說明、讓武、報名、比武、賽程、獎賞，原章節網址不變。正文 h1／h2 和長句說明保留，不將整段文字替換成 SVG。

```html
<section id="rules" class="chapter">
  <div class="chapter-ink-title" data-chapter-title="規則說明" aria-hidden="true">規則說明</div>
  <!-- 原本的標題、摘要和正文保留 -->
</section>
```

控制器只尋找章內 `[data-chapter-title]`。視覺容器由主版面定義尺寸與 `currentColor`，產生 SVG 後依 viewBox 設定 aspect-ratio；純文字與 SVG 都必須有足夠預留空間。七章都使用同一標記容器；比武章將容器放回原右上題字位置，同時停用該章的舊浮動 `#grid-title`，避免雙重文字及兩套播放。原 `#wordmark` 論劍沿用開場引擎。對沒有標記容器的章節呼叫 enter 是安全的 no-op，仍會清理上一章。

## ES module API

```js
import {createChapterTitles} from './chapter-titles.js';

// 先完成既有 INK.load('glyphs.json')，再建立。
const chapterTitles = createChapterTitles({
  root: document,
  staticMode: reduced.matches || document.body.classList.contains('reading'),
});
chapterTitles.enter(sectionElement); // 墨幕覆蓋下建立 SVG；也可傳 'rules' 或 '#rules'
chapterTitles.setStatic(true);      // 全部標記容器還原可讀章名
chapterTitles.setStatic(false);     // 不自行重播；下一行由 runtime 決定時機
chapterTitles.enter(sectionElement);
chapterTitles.clear();              // 停止當前章書寫並保留文字
chapterTitles.destroy();            // 還原原 HTML、aspect-ratio、狀態，移除監聽
```

- `createChapterTitles({root=document, staticMode=false})` 回傳上述四個方法。
- 依賴與載入：既有 classic `brush.js` → `ink-title.js` → 完成 INK glyph 資料 → 動態 import 本模組。模組只讀該 document 的 `window.strokeSVG`，不新增 classic 全域或自己發出 fetch。
- `enter(section)` 回傳是否有可用書寫 SVG。同一章重複呼叫保留現有 SVG，不重新播放；先切到另一章再返回才重新書寫。
- 切章清除上一章 CSS 動畫與末筆監聽，文字仍可讀；glyph 或引擎缺失保留純文字。呼叫者在既有資料載入完成後可再次 enter，失敗的純文字容器不會被永久標記為完成。
- `setStatic` 不改全站模式、hash 或焦點；runtime 負責先同步 reading／reduced 狀態。控制器另監聽 reduced-motion 切為 reduce，立刻停止並顯示完整文字；偏好恢復時不自動重播。
- 同一 root 重複建立控制器會先 destroy 舊控制器。destroy 後所有方法不再修改頁面。
- 沒有 timers、RAF、Observer、非同步排隊或 splash；不用原 playInk 的未託管收筆 timers。SVG 原生 animationend 只用來記錄末筆完成，離章即移除。
- `data-title-state` 為 plain／writing／complete，僅供樣式和回歸觀察；不要用它隱藏原正文。

## 過場中暫停，揭幕後書寫

runtime 在 `applyGrid` 的完整墨幕下 enter；版面以 `body[data-cut]`／`body[data-intro]` 控制標記容器內 `.writing *` 的 `animation-play-state: paused !important`。這樣 SVG 已備妥且筆畫停在開頭，揭幕完成移除屬性後從第一筆書寫，不會出現純文字先顯示又歸零的閃現。無需額外 prepare API；靜態／reduced 模式仍由 setStatic 保持文字。

## 字形來源

七章需要的缺字為宗、旨、規、則、說、明。已從 [Hanzi Writer 官方資料倉庫](https://github.com/chanind/hanzi-writer-data) 的固定 commit `68d10a4b21150cae5e1ebbd223eed289cf32d90c` 下載真實 `strokes`／`medians`，逐項原樣映射為本地的 `s`／`m`。沒有捏造或手畫任何筆順。其他字沿用原 glyphs.json。

每字來源 URL、上游原始檔 SHA-256 及筆數記於 [chapter-glyphs-source.json](chapter-glyphs-source.json)。筆數為宗 8、旨 6、規 11、則 9、說 14、明 8。

資料適用既有 Arphic Public License，來源及授權文件沿用 [COPYING](../asset-ledger/strokes/COPYING-makemeahanzi.txt) 與 [APL 全文](../asset-ledger/strokes/APL-arphic-public-license.txt)。新增資料不得移除來源及授權說明，正式散布須一併保留授權。

## 檢查邊界

已以真實 brush.js／ink-title.js 及補齊後 glyphs 在 JSDOM 執行七個章名，驗證每筆開始時間不早於上一筆結束、同章重入不換 SVG、靜態模式與 destroy 還原。筆數依序 14／42／32／18／12／29／30；依現有引擎最短每筆時長，規則說明約 4416ms，其餘約 2385–2980ms，不假設全都恰好 2400ms。

本檢查不代表瀏覽器畫面驗收。主代理負責在 lab 版面掛載、生成器同步、CSS 尺寸，以及 desktop／mobile、慢字形載入、reading 和 reduced-motion 的整合驗證。
