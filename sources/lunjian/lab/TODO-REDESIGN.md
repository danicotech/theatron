# 重做清單

工作檔：`lunjian-layout.html`　備份：`lunjian-layout.before-redesign.html`
狀態：`[ ]` 未做　`[~]` 進行中　`[x]` 完成

---

## A 背景（最大問題：現在是佔位漸層）

- [x] A1 七張整幅場景圖上場，一格一張
- [x] A2 雪與梅瓣的透明疊層（fx-snow-far / fx-snow-near / fx-plum-petals），做出景深
- [x] A3 每格的壓暗與色偏，讓字讀得到（scrim 只蓋字的地方，不是整屏）
- [x] A4 切格時背景整組換，跟著墨滲那一幀

## B 桌機：每一格不同構圖

- [x] B0 山門　滿版天地，字在正中
- [x] B1 戰帖　不對稱：人是實的，帖斜貼上去
- [x] B2 賽制　全寬資料表，沒有紙卡
- [x] B3 對決　全出血，資訊縮到最小，只看人
- [x] B4 獎賞　印牆置中放大，卡退成一行註
- [x] B5 賽程　樹佔全寬，標題退到角落
- [x] B6 報名　極簡，大量留白

## C 手機：獨立構圖，不是縮小的桌機

- [x] C0 裝置分流機制（`body[data-device]`，載入決定一次）
- [x] C1 通則：單欄、貼底、題字退成頁首橫幅
- [x] C2 七格各自的手機構圖
- [x] C3 VS 對立圖的手機版
- [x] C4 safe-area、拇指區、觸控目標 ≥ 44px

## D 清理（死碼會讓後面每一次改動都變慢）

- [x] D1 移除死掉的 CSS：`.seal-rail`、舊 `.hero-wordmark`、`.silhouette`、`.ink-bloom`、`.ink-settle`
- [x] D2 z-index 收成一張固定階梯，不要散落的數字
- [x] D3 移除沒在用的 JS：`splash`、`tracedSVG` 的墨暈分支、`PUNCT` 未用鍵
- [x] D4 移除沒在用的資料檔引用（`type/lettering.json` 還要不要）

## E 品質

- [x] E1 焦點順序：跳連結 → 頁首 → 當前格 → 狀態列；非當前格 `inert`
- [x] E2 對比：紙上與壓暗底上的每一種字都量過 ≥ 4.5:1
- [x] E3 `prefers-reduced-motion`：不寫字、不墨滲、不視差，內容一字不少
- [x] E4 靜態閱讀模式在新版面下重新檢查
- [x] E5 效能：濾鏡層數、背景圖大小、切格時的重繪

## F 驗收

- [x] F1 七格 × 桌機／平板／手機 截圖全過
- [x] F2 Console 無錯誤、無 404
- [x] F3 三態（報名前／進行中／頒獎）各跑一次
- [x] F4 賽程樹平鋪與左右對開各跑一次

---

## 進度

**A 背景完成**（2026-09-16）。七格各有真實場景，五張乾淨底圖輪用，重複的兩格隔三格以上且換裁切換色調。
雪分遠近兩層、梅瓣一層，三層各自的視差增益不同（.5 / 1.1 / 2.2 / 1.6）做出景深。
壓暗只蓋字會出現的那一側（center / left / right / bottom 四種錨點），不做全屏黑幕。

**踩到的坑**：清冊裡的 `*-atmosphere.png` 是設計稿，字燒在圖裡而且寫著「劍塚」。
整幅場景要用 `theatron/web/public/world/bg-*.webp` 與 `library/03-background/courtyard.webp`，那些才是乾淨的。
背景總量從 8.6 MB 壓到 1.5 MB（PNG 轉 WebP）。

## 可用的場景素材（清冊實測）

| 用途 | 檔 | 尺寸 |
|---|---|---|
| 山門 | `preview-design-v1/references/hero-atmosphere.png` | 1672×941 |
| 戰帖 | `theatron/web/public/world/bg-cliff-timber-hall.webp` | 1672×941 |
| 賽制 | `preview-design-v1/references/bp-atmosphere.png` | 1672×941 |
| 對決 | `theatron/web/public/world/bg-snow-arena.webp` | 1672×941 |
| 獎賞 | `theatron/web/public/world/bg-night-crow-courtyard.webp` | 1672×941 |
| 賽程 | `theatron/web/public/world/bg-spring-autumn-lodge.webp` | 1672×941 |
| 報名 | `preview-design-v1/references/signup-atmosphere.png` | 1672×941 |
| 疊層 | `03-atmosphere/fx-snow-far.png`（alpha .02）、`fx-snow-near.png`（.03）、`fx-plum-petals.png`（.09） | 1672×941 |

## B 段收尾（2026-09-16）

四格構圖一次做完。

| 格 | 做法 |
|---|---|
| 戰帖 | 不對稱：人在左邊是實的，帖斜貼右側，卡寬 42vw |
| 對決 | 全出血。資料掛在各自那個人腳下，中間是 VS 墨印，底下一條細註 |
| 獎賞 | 朱文印放大置中（朱紅實底、骨白陰字），紙卡退成一行註 |
| 賽程 | 樹佔全寬，日期收成一列，題字進面板標題列 |

**踩到的坑**：用行號區間換「進度軌」那一段，把整塊「每一格一種構圖」的 CSS 一起刪掉了，
第 2、6 格失去樣式。已還原並補齊。往後改 CSS 一律用唯一字串比對，不用行號。

## 靠近哪一邊哪一邊放大（使用者 2026-09-16 指示）

`--lean` 是指標的 X，最左 −1、最右 +1，已經有阻尼。原本左側寫 `scale(1 + lean*.06)`，
指標移到左邊時 lean = −1 反而縮小 —— **方向是反的**。
改成兩側各自算 `--near-t`（0 遠 → 1 近），scale、brightness、saturate、腳下那份資料的
透明度全部掛在同一個值上，人和字才像同一組。幅度從 ±6% 拉到 ±6.5% scale ＋ ±16% 亮度。

VS 墨印不是圖檔，是 `inkVS()` 用跟題字同一支筆現生的：一筆圈 ＋ V 兩筆 ＋ S 一筆 ＋ 九顆墨點。

**踩到的坑（兩個）**
1. class 撞名：新的 `.vs-mark` 撞到全屏 VS 對立圖那套 `.vs-*`，被 `position:absolute`
   抽出版面，三欄變兩欄，右邊那個人掉進中欄。改名 `.duel-vs`。
2. `#ink-jh` 的 `feColorMatrix` 把 alpha 乘 ~19 再減 8，半透明的東西丟進去會被壓成 0，
   一筆圈整條消失。透明度要掛在濾鏡的**外層** `<g>`（群組透明度在濾鏡之後才合成）。

## A5 Kuwahara 筆觸底圖（使用者 2026-09-16 指示「試試看」）

各向異性 Kuwahara：把照片攤成一塊塊平色，平滑但不跨過邊界，再用結構張量算出的
紋理方向把取樣核拉長，所以屋簷和樑是「順著長邊刷過」而不是化成一顆顆圓斑。

- shader 直接取自 `stylized-components/src/components/kuwahara/glsl/`，一行未改，
  只把 three ＋ postprocessing 換成裸 WebGL2 兩趟 FBO（張量要 RGBA16F，8 bit 會夾平）。
- **離線烘焙，不在執行期跑**。底圖是靜態的，同一張每幀結果一樣，200 samples/px 白付。
  `tools/kuwahara.html`（渲染器）＋ `kuwahara.mjs`（Playwright 驅動）。
- 半徑試過 3 / 4 / 6。6 把燈籠和火盆都糊掉；3 在畫面上只剩約 2px 看不太出來；**取 4**。
- 五張共 856KB，比原始照片版的 1064KB 還小 —— 攤平之後 WebP 更好壓。
- `?paint=0` 換回原始照片版對照。

踩到的坑：`file://` 下每個檔案是各自的來源，`<img>` 會把畫布染成 tainted，
`texImage2D` 直接丟 SecurityError。改由 Node 把圖轉成 data URL 餵進去。

## 版面稽核：5 裝置 × 7 格全過（0 條）

| 修的 | 為什麼 |
|---|---|
| 進度軌 `height:max(48vh,446px)` | 最短那段佔全軌 10.1%，軌不到 446px 它就摸不到 44px 觸控目標 |
| 題字 `left:max(5vw,76px)` | 1024 寬時 5vw 只有 51px，正好切進 20–64 的軌裡 |
| 首屏大字帶 `left/right:76px` | 原本 `left:0;right:0`，盒子必然疊到軌上 |
| `html,body{overflow-x:clip}` | 場景圖故意做得比視窗大、對決立繪是 fixed，兩者都撐出橫向捲軸。用 clip 不用 hidden，hidden 會讓文件變成捲動容器，紙卡的 sticky 就失效 |

## VS 真跡接上（使用者 2026-09-16 提供 `ChatGPT Image09_16_02.png`）

三個地方用到：第 3 格中間的標記、對立圖中間的 VS、對立圖的背景質感。
做法與坑寫在 `art/README-vs-ink.md`，這裡只記關鍵三條。

1. **執行期去不掉紙。** `invert(1)` ＋ `mix-blend-mode:screen` 是最直覺的做法，
   但 `.chapter-sticky` 是 `position:sticky`，自成一個堆疊脈絡，混色碰不到底下
   `#stage` 那層場景 —— 畫面上就是一塊黑方塊。透明度得先寫進檔案（`tools/vs-import.py`）。
2. **裁框不能切到暗半邊。** 整幅畫左半是竹與山的濃墨，暗 = 高不透明度，
   框的左緣一碰到那裡，轉出來四周就起一圈灰霧。
3. **羽化是必要的，不是修飾。** 裁框從畫面中間切一刀，切口上殘留的淡墨會沿著
   直邊連起來，在暗底上就是一個看得見的方塊。用方框距離羽化，不用半徑 ——
   圓形會把 S 的尾巴切掉。

對立圖的底不能整幅照放：那張圖自己中間就有一個 VS，會跟前景那顆疊成兩個。
改成放大三倍、偏到左下角，只取墨、不取字。

## 手機版 VS 對立圖（C3）

桌機那套是「兩人站左右、資訊卡貼底角」。手機沒有那個寬度，照搬就是兩片剪影塞滿畫面。
改成剪影壓到 `.42` 退成背景層、VS 當主角、兩張卡並排貼底。
頁首要 `z-index:2` 才壓得住那層半透明剪影，否則輪次和狀態會被洗掉。

原本散在 `@media (max-width:479px)` 裡的那十四條補丁整段移進 `body[data-device="mobile"]`，
只留一條真的跟寬度有關的字級。順手發現 `.vs-mark svg` 這個選擇器已經沒有對應元素
（DOM 換成 `<img class="vs-mark-art">` 了），一起清掉。

## D 清理（2026-09-16）

| 清掉的 | 為什麼 |
|---|---|
| `tracedSVG()` 整支（2.5KB） | 拿真跡外框、用楷書中線當導引做遮色片顯影。**使用者明確否決過兩次** —— 遮色片掃出來是「一次露出一整個字」，看起來是擦除動畫不是書寫。留著只會讓人再繞回去 |
| `INK.lettering` / `INK.fontword` / `INK.art()` | 只餵 `tracedSVG` |
| `type/lettering.json`、`type/fontletter.json` 的載入 | 同上，少兩筆網路請求。檔案留在磁碟上當研究紀錄 |
| `.ink-bloom`、`.ink-settle`、`.ink-svg.traced*` | 只有 `tracedSVG` 會產生這些元素 |
| `.vs-fig .silhouette` | 沒有任何元素掛這個 class |
| `@media (max-width:479px)` 裡的 14 條 VS 補丁 | 整段移進 `body[data-device="mobile"]`，只留一條真的跟寬度有關的字級 |

**清單寫錯一條**：`splash` 不是死碼，它是收筆時墨點爆開那一下，`playInk` 每次寫完都會呼叫。

`z-index` 全部收進 `--layer-*` 階梯，加了一顆 `--layer-stage:1`。
留下的兩個裸數字是元件內部的相對關係（紙卡背景 `-1`、對立圖頁首 `2`），
那是各自堆疊脈絡裡的先後，放進全域階梯只會讓人誤會它們跟 chrome 有關。

## E 品質（2026-09-16）

新增 `quality.mjs`，跟 `audit.mjs` 分開 —— 這幾項跟版面無關，而且要換 `emulateMedia` 重載。

**E1 焦點順序**：跳連結 → 頁首 → 當前格 → 進度軌 → 狀態列，離線的格一個都吃不到焦點。
順帶修掉一個：桌機的三步案例同時看得到（只是主次不同），但另外兩步被標了
`aria-hidden="true"`。報讀的人少掉兩步，畫面上卻明明讀得到。手機才是真的
`display:none`，本來就不在無障礙樹上，不必也不該補這個屬性。

**E2 對比**：一開始量出 9 條，修完之後**把檢查本身修對**又抓到 7 條新的。

| 問題 | 原來 | 現在 |
|---|---|---|
| `--paper-faint` 一個 token 兩種底 | 紙上 4.43、暗場 3.19 | 拆成 `--paper-faint` #635a4c（紙，5.16）與 `--paper-dim` #968f82（暗場，5.78） |
| 朱紅當 10px 小字 | 2.96 | 新增 `--red-soft` #cf6f67（5.41）。`--red` 是品牌色不是文字色 |
| `--red-soft`、`--paper-soft` 被用了卻沒定義 | 繼承父層的顏色 | 補上定義 |
| 三步案例用 `opacity:.32` 壓暗 | 內文 2.01、紅標 1.57 | **透明度救不回來**：紅標開到 .72 也只有 3.34。改成用顏色分主次，兩個狀態都過 |
| `.scene-note` `#ffffff4d` | 2.70 | `#ffffff76`（4.53，跨過門檻的最小值） |
| 七處 9 與 9.5px 的 mono 小標 | — | 一律 10px。稽核把 10px 當硬下限 |

**檢查本身的洞**：原本只量 `color`，沒把祖先鏈上的 `opacity` 乘進來。
`--muted` 壓到 `.32` 算出來還是 9.23，實際只有 2.01。修好之後立刻多抓到七條。

**E5 效能**：首次載入 4.86MB → **2.36MB**。

| 做的 | 省下 |
|---|---|
| 四張去背立繪 PNG → WebP | 5.0MB → 0.7MB |
| 六張前景圖縮到「最大顯示尺寸 × 2」 | 1074KB → 406KB。`fg-lantern` 原本 900×1080 卻只畫到 122×146，浪費 13.6 倍 |

**沒做的，因為量過沒根據**：本來要把七層 `img.bg` 的調色濾鏡烘進圖檔。
實測把 `img.bg` 與 `img.fg` 的濾鏡全部關掉，掉幀只從 26/83 變成 24/88 —— 雜訊範圍。
這一頁的成本在合成面積，不在濾鏡。所以判準改成量 `blur`（要讀回鄰近像素的那種）
與**主執行緒阻塞**，後者跟顯示卡無關，換到手機一樣成立。切格時最長阻塞 0–55ms。

光柵幀率只印出來參考不當判準：headless 走 SwiftShader，用 CPU 畫每個像素，
這一頁約三個屏的 RGBA 合成在 CPU 上本來就只有 30fps 上下，真機有 GPU，這數字沒有參考價值。

## F 驗收（2026-09-16）

新增 `verify.mjs`。七格 × 桌機／平板／手機、三態、兩種樹型，全過，無錯誤無 404。

**稽核補了一個洞**：`audit.mjs` 一直只跑 `phase=live`（8 人平鋪樹），
從來沒跑過 24 人的對開樹。加進去之後立刻抓到兩條：
對開樹比容器高，`justify-content:center` 讓它上下各溢出一半，上面那半疊到面板標題列上。
改成 `justify-content:safe center`（放得下就置中，放不下就靠起點）。
另外兩條是 9px 的「輪空」與捲動提示。

**現況**：`audit.mjs` 0 條（5 裝置 × 8 組）、`quality.mjs` 0 條、`verify.mjs` 0 條。
