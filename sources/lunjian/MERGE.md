# 合併紀錄（2026-09-17）

四件事：3D 場地接回來、併進 theatron、墨轉場改成浪、跑起來。

---

## 唯一來源

`scrollcraft/builds/lunjian/lab/lunjian-layout.html` 是版面與視覺的唯一來源。
theatron 那一份是**生成的**，改版面請改 lab 再重跑：

```
cd scrollcraft/builds/lunjian/lab
python tools/to-theatron.py
```

手抄一份到 React 只會立刻分岔 —— 改了一邊忘了另一邊，兩個月後沒人知道哪份才算數。

---

## 1. 3D 場地

`KAGE-STYLE-PREVIEW.html` 是 18 MB 的單檔，3D 的部分是一個 15 MB 的
`<script type="importmap">`，把 23 個模組全部當 data URL 內嵌。

**先拆成真實檔案**（`jz/`、`preview/`，解碼後 10.8 MB）。拆了才改得動、diff 得出來，
也才不必每次動一行就重新編碼整包 base64。拆法就是讀那一行 JSON、
把每個 value 從 base64 解回來寫成檔案。

接法只有三個接點：

| 接點 | 做法 |
|---|---|
| 建場景 | `createScene(canvas)` → `prepare()` |
| 換機位 | `swapTo(k)` 裡呼叫 `scene.seek(k)`。camera.js 的七個機位跟七格一對一，硬切不插值 |
| 每一幀 | `scene.render(t, 1, S.frac, dt, 0, S.mx, S.my, 1)`，掛在既有的 `tick` 裡 |

`p = 1` 是 journey。原本那個單檔還有一段「燒戰旗」的開幕簾（`p < 1` 的分支），
這裡不接：這一頁自己的開場是「論劍」一筆一筆寫出來，兩個開場擺一起會互相打架。

**兩種舞台擇一，不疊。** 3D 開著時 2D 的整幅場景板要 `display:none`，
不然 3D 在下面完全看不到。`?stage=2d` 切回純 2D，`?stage=3d` 強制。
減少動態的人不給 3D —— 那是一整個會動的場景，不是一條可以關掉的 transition。

**雪與梅瓣**：3D 開著時用場景自己的粒子（`scene.js` 的 `snow()` 與 blossomRig），
那是真的在三維空間裡飄、有景深、會被建築擋住的。2D 那三張疊圖是沒有 3D 時的替身，
兩套疊在一起只會變成兩層不同步的雪。

---

## 2. 併進 theatron

使用者指示：**theatron 自己的視覺全部不要用**。所以序幕布幕、三幕劇場、
程序化的 world3d 都不再掛在首頁上（元件留著沒刪，只是首頁不用了，
舊首頁在 `features/landing/_page.theatre.tsx.bak`）。

生成三樣 ＋ 複製素材：

```
theatron/web/public/lunjian/lunjian.css    68 KB   ← <style> 整段
theatron/web/public/lunjian/lunjian.js     41 KB   ← 主驅動 <script>
theatron/web/src/app/lunjianMarkup.ts      22 KB   ← <body> 標記，字串常數
theatron/web/public/lunjian/{art,type,vendor,*.js}  49 檔
theatron/web/public/{jz,preview}                    23 檔，10.8 MB
```

**路徑要前綴。** lab 裡寫的是 `art/bg/x.webp`，相對的是那一頁自己；
搬到 theatron 之後頁面在 `/`，會解析成 `/art/bg/x.webp`。
HTML、CSS、JS 三邊都要改寫成 `/lunjian/art/...`，腳本自動做。

### 三個踩到的坑

1. **`innerHTML` 塞進去的 `<script>` 不會執行**（HTML 規範明訂）。
   所以腳本不能跟標記一起走，要由 `LunjianRuntime` 在標記落地之後依序 append。
   順序是硬的：anime → brush → ink-title → 主驅動 → stage3d（module）。
2. **兩套頁首打架。** 首頁自帶頁首、進度軌、狀態列與跳連結，
   再疊一層 theatron 的 `SiteNav` 就是同一個位置兩條橫線、tab 兩次才進得了內容。
   用 `SiteChrome`（讀 `usePathname()`）讓首頁以外才掛。
3. **水合警告。** 標記落地後會被 `lunjian.js` 大改（加 `data-on`、塞進度軌七段、
   填對戰資料），React 比對兩份 DOM 會警告。那個差異是刻意的 —— `suppressHydrationWarning`。

3D 模組放 `public/` 而不是走打包器：它們是凍結的第三方產物，不會被 tree-shake
也不需要型別檢查，丟進 Turbopack 只是讓每次 dev 重編多花好幾秒；
而且彼此用裸名稱互相 import，走打包器就得把 23 個檔的路徑全部重寫。
裸名稱由 `app/layout.tsx` 注入的 importmap 解析。

順手把 **劍塚 → 論劍**、**JIANZHONG → LUNJIAN** 改完（26 檔、54 處，
含 `theme/jianzhong.*` → `theme/lunjian.*` 與匯出符號），typecheck 通過。

---

## 3. 墨轉場：從黑布改成浪

shader 取自 `stylized-components/.../WaterWaveSimulation/shaders/wave.ts`
（二階波方程），用原生 WebGL2 跑，不引入 three.js。

第一版做出來就是使用者說的「一塊黑布」。三個錯：

1. **注入強度寫成 `hash(floor(uv.y * 26.0))`** —— 沿 y 被切成 26 條各自定值的橫帶，
   帶與帶之間沒有內插。畫面上就是一排長方形階梯。改成內插過的值雜訊。
2. **位移量 0.085，而且取「目前像素」的波高。** 取目前像素會讓同一列的位移隨 x 變，
   邊緣被拉斜；振幅又太小，整條邊幾乎沒動。改成取「前緣那一欄」的波高，
   位移只隨 y 變，整列一起推，振幅拉到 0.16。
3. **只有一條硬邊。** 真的墨有三件事：滲開的濃度梯度、飛白（乾筆的白絲）、
   衝在最前面的幾點飛沫。三件都補上。

補完之後還發現兩件：

- **後緣是一條死直線。** 波場只在前緣注入，後緣那一欄的波高幾乎是 0。
  後緣的形狀改由自己的一組雜訊負責，振幅還要比前緣大 —— 墨被拖走的那一邊
  本來就比衝出去的那一邊散。而後緣才是揭開新場景的那一邊，它更該像墨。
- **飛白寫反了。** `fbm(vec2(uv.y*78.0, uv.x*22.0))`：y 高頻 x 低頻，
  結果整片是掃描線。墨由左往右走，絲要順著筆走的方向拉長 ——
  y 要低頻（絲少而粗）、x 要高頻（沿途斷斷續續）。

另外全蓋滿的那幾幀只剩濃淡那一項在做事，所以 body 的雜訊要夠強，
不然就是一塊純黑的布 —— 那正是要避免的。

調形狀用 `window.__LUNJIAN.holdCut(p)`：把切鏡釘在指定進度不動。
切鏡只有 560ms，而且 `tickCut` 吃的是真實時間差，
軟體渲染下光是截一張圖就吃掉一整幀，中段根本拍不到。

---

## 章題重做

原本是「一塊米色宣紙 ＋ 撕邊濾鏡」，題字蓋在上面。
那張紙在整個畫面裡是唯一一塊大面積亮色，而全站其他地方都是暗底、細線、mono 小標 ——
它不屬於這套語言，看起來像貼上去的貼紙。

拿掉紙：筆畫本身就是那個物件，用骨白直接寫在場景上，靠兩層投影撐住可讀性，
靠一條細線與一行 mono 小標（`04 THE DUEL`）把它固定在版面系統裡。
這跟第 3 格中間那顆 VS 墨印是同一個做法，兩者才對得上。

連帶清掉只服務那張紙的 `#paper-edge` 濾鏡與 `.paper-bg`。

---

## 4. 跑起來

```bash
cd theatron && pnpm --filter @theatron/web dev
```

`http://localhost:3000`。`?stage=2d` 看純 2D、`?g=3` 直接跳第 4 格、
`?phase=split` 看 24 人的對開樹、`?view=reading` 看靜態閱讀。

純 HTML 版另外跑：

```bash
python -m http.server 4500     # 在 repo 根
```

`http://localhost:4500/scrollcraft/builds/lunjian/lab/lunjian-layout.html`

### 驗收現況

| 檢查 | 結果 |
|---|---|
| `lab/audit.mjs` | 0 條（5 裝置 × 8 組） |
| `lab/quality.mjs` | 0 條（焦點、對比、減少動態、閱讀模式、效能） |
| `lab/verify.mjs` | 0 條（七格三裝置、三態、兩種樹型） |
| `theatron pnpm typecheck` | 通過 |
| theatron 首頁 | 七格全部可捲，無主控台錯誤、無 404 |

三支檢查一律加 `?stage=2d`：3D 是 10.8 MB 的模組，headless 又走軟體光柵，
載完再畫一幀要好幾秒。檢查的是版面與品質，不是 3D；3D 自己用截圖驗。

---

# 第二輪（2026-09-17）

## 導覽從捲動改成定格

使用者：「每個章節的滾輪都太少了 而且和scrollbar 沒對到時間軸 我就不要用滾輪了」。

兩個問題本來就治不好：

- 每一格的捲動距離由 `--span` 決定，但捲軸拉桿的長度是整份文件的。
  拉桿走一半不等於走到第四格 —— 那是兩套不同的時間軸疊在同一個控制項上。
- 錨點跳轉正好落在章節邊界，6vh 的遲滯就不肯換格。**點「對決」會停在「賽制」**，
  點「報名」會停在「賽程」。使用者說的「點 tab 也好點 sider 也好畫面都沒東西」
  就是這個：位置到了，格沒換。

現在七格是七個 `position:fixed` 的畫面，沒有頁面捲動（`scrollHeight − innerHeight = 1`）。
換格只有一個入口 `goTo(k)`：導覽列、進度軌、卡上的連結、方向鍵、Home / End 全走它。
**刻意不接滾輪** —— 要的是定格，不是滾一點點就換一格。

章內進度（相機呼吸、賽制的三步、尾段靜默）原本是捲動的函式，現在改由時間帶：
進格之後 `DWELL = 11s` 走到 1 然後停住。靜態閱讀模式不套這一段，那個模式要的
就是一份可以從頭捲到尾的文件。

導覽列原本只列四格，看起來就像整站只有四個章節。改成七格全列，並標出當前格。

## 開場簾接回來

`p` 是那一套自己的開場進度：`-1` 簾掛著、`0…1` 旗在燒、`1` 入關走七機位。
點旗 → `banner.hit(x,y)` 換成旗上的 uv → `banner.start(uv)` 從那一點起火，
3.5 秒燒完自動入關；Esc 或「直接入關」跳過；`?intro=0` 完全不播。

旗是場景裡的布料模擬，所以只有 3D 起得來時才有這一段。
簾在的時候站上的介面一概不出現（`body[data-intro]`），
「論劍」的書寫也押後到入關才開始 —— 旗還沒燒完就把站名寫好，入關時就沒東西可看了。

## 山門：前景太大、背景太近

**真正的原因是重複**，不是尺寸沒調好。3D 場景本身就有欄杆、竹子與月亮，
2D 前景又疊一份 —— 畫面上有兩個月亮、兩排欄杆。
前景層表加 `flat:true`：那幾層只有純 2D 時才掛。

相機 z 從 81 拉到 93、fov 50→46。**不能拉到 104** —— 那會把後方那棟建築的
暗屋頂整個框進來，在副標後面變成一塊硬邊的黑。93 兩邊都避開。

找那塊黑花了不少工夫：射線只打到雪的 Points 與天球，`readPixels` 又讀不到當幀畫面
（`autoClear=false` 加上已經 present）。最後是靠「換一個距離看它消失」確定的。

## 雪與梅瓣

`particles.js` 裡 `const PETALS=0, BLOOMS=0` —— **梅瓣被關掉了**，
而上面那段註解還寫著「現在 240 片」。開回 240 片紅瓣 ＋ 64 朵白花。

雪原本三層共 2320 顆。鏡頭退後之後同樣的密度攤在更大的視野裡就變稀薄，
看不出在下雪。加到 3820 顆，粒徑與濃度一起抬。

天球的 `pow(1-p.y, 3)` 讓天頂到地平的差距太陡，放軟成 1.6，天頂色也抬起來。

## 重複的畫面換底

原本七格用五張底：山門用在 0 與 6、賽制用在 2 與 5。
改用 KAGE 預覽那一套 `plate-*`：

| 格 | 原本 | 現在 | 為什麼 |
|---|---|---|---|
| 5 賽程 | hall（與 2 重複） | `plate-approach` | 賽程是一條路 |
| 6 報名 | gate（與 0 重複） | `plate-door` | 報名是走進那道門 |

兩張都過一次 Kuwahara（r=4），跟其餘五張同一種筆觸。

## 前景補位

盤了全庫 231 件真的去背素材（角落必須透明才算）。這一輪補兩件：
賽制右上掛一盞燈籠（那一格原本只有一個火盆當暖點），獎賞右側掛一面黑旗
（跟印牆的朱紅對位）。其餘五格兩側都已經有東西，沒有硬塞。

## 測試環境的一個坑

軟體光柵下 `dt` 被 `Math.min(now-last, 50)` 夾住，560ms 的切鏡要 12 幀才走完 ——
在 2fps 的 headless 裡等於 6 秒的牆鐘時間。
用 GL 參數啟動的測試要把等待拉長，否則會誤判成「點了沒反應」。


---

# 第三輪（2026-09-18）：備戰方案併進來

`lab/loadout.html` 是選手的備戰方案配置器（流派、心法、奇術、八件裝備、
屬性目標、報名文字）。它跟首頁是同一種東西 —— 一個從 lab 長出來的整頁版面 ——
所以走同一條規矩：**lab 是唯一來源，theatron 那份用腳本生成。**

```
cd scrollcraft/builds/lunjian/lab
python tools/loadout-to-theatron.py
```

生成四樣 ＋ 素材：

| 產物 | 大小 | 來源 |
|---|---|---|
| `public/loadout/loadout.css` | 79 KB | `<style>` 整段 |
| `public/loadout/loadout.js` | 134 KB | 原樣複製，只改兩個路徑常數 |
| `public/loadout/build-note.js` | — | 原樣複製 |
| `src/app/loadout/loadoutMarkup.ts` | 9 KB | `<body>` 標記 |
| `public/loadout/{assets,data}` | 5.3 MB | 162 檔 |

`loadout.html` 檔頭原本寫著「定案後搬成 `features/loadout/*.tsx` 並把這個檔刪掉」。
那句話比這份文件早，已經改掉了 —— 理由就是最上面那條：手抄會分岔。

## 比首頁單純的地方

`loadout.js` 是 **ES module**，自己 `import './build-note.js'`，
相對於 `/loadout/loadout.js` 解析成 `/loadout/build-note.js`，瀏覽器會自己去載。
所以 `LoadoutRuntime` 沒有首頁那種「順序是硬的」問題，掛一支 `type=module` 就好。

路徑也只有兩處要改：CSS 裡的 `url(../loadout/assets/…)`，
以及 JS 裡的 `ASSETS` 常數與 `catalog.json` 的 fetch。兩處都有斷言，
改到別的地方就代表 lab 與產物會有行為差異 —— 那正是生成腳本要防的事。

## 兩個網址

| 網址 | 做什麼 |
|---|---|
| `/loadout` | 真正的頁面 |
| `/t/[slug]/me/loadout` | `redirect('/loadout')` |

為什麼賽事底下只是導過去：配置器**沒有後端**，方案存在瀏覽器的 localStorage，
跟哪一場賽事無關。同一份東西掛兩個真頁面會讓人以為「賽事底下那份」
跟報名資料有連動 —— 那件事還沒做。等它真的會存進報名，再把那裡改成真的頁面。

## 又踩到「兩套頁首打架」

跟第一輪首頁一模一樣的坑，這次的症狀更明確：
`SiteNav` 蓋在備戰方案自己的工具列上，**「匯出 JSON」點不到**
（Playwright 的錯誤訊息直接指出是 `nav[aria-label=全站導覽]` 攔截了 pointer events）。

`SiteChrome` 的判斷從「首頁以外」改成一份名單：

```ts
const OWN_CHROME = new Set(['/', '/loadout']);
```

之後再從 lab 生成整頁版面，記得把網址加進去。

## eslint

`public/` 沒有被 ignore，所以裡面每一支 .js 都是一條
`Parsing error: … was not found by the project service`。
這在加備戰方案之前就是紅的（`lunjian/`、`preview/` 那 23 個 3D 模組都中），
只是這次又多兩條。`public/` 是靜態資產不是原始碼，加進 `ignores` 一次解決。

另外 `*Markup.ts` 關掉 `no-irregular-whitespace`：那裡面的全形空白是中文排版，
是內容不是程式碼，而且檔案是生成的，手改下次會被蓋掉。

## 驗收

| 檢查 | 結果 |
|---|---|
| `selfcheck.mjs` 打 lab（`:4500`） | 44 項全過 |
| `selfcheck.mjs` 打 theatron（`:3100/loadout`） | 44 項全過 |
| `pnpm typecheck` | 通過 |
| `pnpm lint` | 通過（連帶修好原本就紅的 34 條） |
| `/t/[slug]/me/loadout` | 導到 `/loadout` |
| `/`、`/t/[slug]` | 沒受影響，導覽列該在的還在 |

`selfcheck.mjs` 這次改了兩處**測試自己的錯**，不是產品的錯：

1. favicon 的 404 過濾只認得 python http.server 的「404 (File not found)」，
   Next 說的是「404 (Not Found)」。（順帶：theatron **整站沒有 favicon**，
   這是本來就有的缺口，跟這次合併無關。）
2. 「頁面沒有 null 字樣」會走訪 `<script>` 的內容，而 Next 把 RSC payload
   塞在 `<script>` 裡，那串 JSON 一定含 null。改成只看渲染得出來的文字。


## 補完無障礙（同一天，稍後）

新加的 `web/src/app/loadout/page.test.tsx` 一跑就紅：jsdom 裡 axe 抓到四條。
但 **jsdom 不載外部 CSS**，對話框在那裡全部是「看得見」的，所以那四條有真有假。
拿真瀏覽器 ＋ axe-core 跑一輪才分得出來 —— 分完是這樣：

| 情況 | 真的問題 |
|---|---|
| 頁面剛載入 | 沒有 `<main>`、沒有 `<h1>`、內容散在地標外、空分類的頁籤只有 1.88:1 |
| 對話框打開 | `#pop-box` 沒有名字、對話框的 `<header>` 變成第二個 banner、按鈕包按鈕、浮動提示在地標外 |
| 倉庫有東西 | 卡身是**淺色**，上面的金／紅／畢業率三個顏色分別只有 4.00／4.02／2.75 |
| 編輯視窗 | 六個詞條下拉沒有名字（第一個 option 是提示，不算名字） |

全部改在 lab，重跑腳本。幾個值得記的：

**按鈕不能包按鈕。** 心法／奇術的格子本身是按鈕，右下角調數值的晶片也是按鈕。
`nested-interactive` 不只是規則潔癖 —— 實測 **tab 走不進晶片**，階數只能用滑鼠改。
改成外層 `div.slotwrap` 畫框線、內層 `button.slot` 只管開面板、晶片是它的兄弟。
改完 tab 序是 `slot → chip → slot → chip`。順手把心法與奇術兩份幾乎一樣的
組裝程式碼併成 `slotCell()`。

**opacity 不能拿來當「淡」。** 空分類原本 `opacity:.42`，對比剩 1.88:1；
而 `--faint` 打在最深的面板上本來就只有 4.09:1，乘任何 opacity 都破。
改成靠色階分：有東西用 `--dim`、空的用 `--faint`，並把 `--faint`
從 `#7d8794` 抬到 `#8a939f`（每一塊底色都過 4.5，最低 4.79）。

**淺底要往深調。** 裝備卡的卡身是 `#e4e5ea`，不是暗底。
`#976500 → #845800`、`#cf3322 → #b82c1d`、`#b08230 → #7d5c22`，色相沒變。

**alt 不要重複。** 圖正下方就印著同一個名字，`alt` 留著會被唸兩遍
（「環　環，流星雲瓏」）。名字交給按鈕的 `aria-label`，圖的 alt 清空。

驗收：真瀏覽器 ＋ axe，**六個狀態 × 兩種裝置 ＝ 0 條**
（剛載入／選了流派／倉庫配滿／編輯視窗／武器套裝視窗／屬性目標填好）。

## 首頁的驗收條件重寫

`features/landing/theatre.test.tsx` 驗的是三幕劇場版的首頁，而首頁在第一輪就換掉了 ——
它找的 `#stop-*` 錨點一個都沒有，那七條從換版那天起就一直紅著。
刪掉，改成 `web/src/app/page.test.tsx`，照現在的版面寫：七格錨點、
h1 與六個 h2、導覽列的連結指向真的錨點、沒有樣板變數、無障礙。
舊版面的元件與 `_page.theatre.tsx.bak` 都留著，沒刪。

## favicon

整站沒有 favicon，每一頁都在主控台留一條 404。加了 `web/src/app/icon.svg` ——
一把直立的劍，金 `#c9a227` 配底 `#080d13`，跟頁首同一組色。
**不畫「論劍」兩個字**：中文在 16px 會糊掉，而且 SVG 圖示不保證有中文字型。
第一版太細（劍身 3.1/32，16px 下只剩 1.5 個實體像素）而且劍首跟護手黏在一起，
加粗到 4.4 並拿掉劍首之後 16px 也認得出來。


## 2026-09-21 左右賽程樹、場次交接與透明 VS

lab 新增 bracket-tree.js/css 及 arena-ticket.js/css；生成器將樣式合併、同步模組並在動態 import 帶入內容 hash。賽程改為左右會合決賽，手機分輪；選場以 query match 進入原 #duel 舞台，不開舊 VS 視窗。正式資料由 React 生成 client 投影，只有示範模式使用本地注單；正式下注前往既有 MatchPage，selected player 只高亮盤口，不自動提交。

透明素材 vs-arena-ink.webp 取代中央 VS 圖，保留原背景；原稿、提示詞及 alpha 證據見 lab/VS_ARENA_PROMPT.md。宗旨第三格 frame-stage 指定松枝已移除，人物、庭院與對白保留。來源已重新生成，沒有手修生成物。

18 檔 182 項相關測試通過，最終焦點补驗三檔 34 項；typecheck、lint、token（310 檔）與 production build 通過。本機服务已重啟。CUA 仍無法啟動，實際瀏覽器與 Hestia 端到端未驗證；完整紀錄見 Theatron docs/UI_UX_VERIFICATION.md 末段。


### 2026-09-21 武俠名帖卡片

依新季後賽參考，bracket-tree 改為左右雙名帖、姓名字印、獨立比分與中央問鼎印記；長內容高度納入中央印記／季軍战定位。每場仍只有一個原生按鈕，保留選場、焦點及投注交接。手機維持分輪。只改 lab 正本與相關測試，再生成同步。57 項相關回歸、typecheck、lint、token、build 通過；本機服務可用，CUA 故障致實機視覺未驗。設計詳見 theatron/docs/BRACKET_CARD_DESIGN.md。


### 圖片卡面與中央冠軍追加

生成 bracket-card-dark/light 兩張無字卡面，PNG 留 art/_src，WebP 同步 public；圖文分離保留動態玩家資料。中央改為 tt-champion 冠軍卡，只有決賽有效已確認勝者才顯示姓名，否則待定；手機放在決賽輪最前方，點卡進決賽，更新保留焦點。來源與提示詞見 lab/BRACKET_CARD_PROMPTS.md。59 項回歸及 typecheck／lint／token／build 通過；素材 HTTP 200，CUA 仍故障，實機視覺未驗證。


### 2026-09-21 獨立席位與中央決賽（取代雙名帖場次卡）

bracket-tree.js/css 重構成每席單獨定位的名帖與獨立比分按鈕，支線匯合再接下一輪；中央決賽雙席、冠軍與季軍另位。lunjian-layout 的名帖開 dossier，場次走既有 #duel。生成器新增隔離 bracket-tree.css 及 React 使用的 bracketTreeRuntime.js，裁判 MatchList 共用幾何並進既有裁判台。所有賽果仍經生成 client 的既有逐回合確認流程，沒有新後端契約。CUA 故障及 Hestia 未配置的實機／端到端限制維持。


### 2026-09-21 中央冠軍、黑白勝敗與示範編輯

冠軍改在同高決賽雙席中央，比分在下。加入黑白方互換、大斜勝章、敗退轉暗紅墨黑與亮黃流動晉級線；輪詢不重播。新增 bracket-editor.js/css 本機管理（preview 專用），交換首輪玩家、改分與改勝者後重新計算下游，支援分階段儲存／復原／還原。生成器同步新模組與 CSS，正式 JudgeService 邊界不變；無新增後端契約或部署。


### 2026-09-21 黑白方與落敗卡分離

lab/bracket-tree.css/js 將落敗改為灰紙、暗紅敗印、虛線邊與局部裂痕；方別標籤不隨勝敗變色。勝者線 4px、高亮 5px、流動筆觸 2px。to-theatron.py 已同步 public 與 React runtime，裁判 CSS 移除舊暗色敗者覆蓋。素材檔案未修改。


### 2026-09-21 賽程 RWD／中央直線

修改 lab/bracket-tree.js/css：決賽雙席水平接冠軍卡緣，比分獨立；完整樹按容器／輪數調整卡寬，放不下切分輪，CSS 使用 data-view。縮減垂直留白，resize 保留輪次／焦點。生成器已同步 public 與 React runtime，未變更素材或 API。


### 2026-09-21 紅藍陣營／敗者退墨

lab/bracket-tree.js/css、bracket-editor.js 與 lunjian-layout.html 調整卡面至紅藍語意色，移除可見方別；敗者同色退墨、勝者金印。舊黑白儲存配置兼容，比分不重置。to-theatron.py 已同步；React theme extras 與裁判樣式同步調整，未變更素材。


### 2026-09-21 資料室、簡化 dialog、冠軍效果

lab/bracket-editor.js/css 增加 2–64 人確定性示範生成、首輪輪空、按人數／進度分開儲存、檢視選擇；重整原生 dialog 為直接比分／獲勝者操作。bracket-tree.js/css 新增確認冠軍魁印與金框展開，普通輪詢不重播，保留減少動態／閱讀模式。生成器已同步 public 與 React runtime。


### 2026-09-21 姓名副列移除／解除樹高度限制

lab/bracket-tree.js/css 移除玩家段位、籤號與文字胜敗副列，清理無用样式；取消圖內高度上限，保留超寬水平捲動，y 軸交外層頁面。已生成 public 與 React 共用 runtime，無變更資料模型。


### 2026-09-21 敗者刀光及撕裂卡面

lab/bracket-tree.js/css 加入右上至左下 SVG 刀光、互補鋸齒 clip-path 雙卡面、transform／opacity 時序；取代原角落裂痕與背景色敗退動畫。保留唯一姓名、點擊與焦點；生成器已同步 public 及 React runtime。


### 2026-09-21 檢視／編輯與報名者安排

保留已確認的紅藍名帖、勝敗斬切、金線與中央冠軍美術。工具列改為「檢視／編輯」；檢視僅留模式與排版選擇，編輯才顯示 2–64 人設定、報名者及比分工具。報名者可搜尋、新增，拖曳到首輪卡片或點選姓名後點籤位；另有目標籤位下拉選單，供手機／鍵盤操作。已排入者交換籤位，待排入者替換上場，被替換者留在報名者名單；人數不因換位增減。

換位清除受影響比賽及失效後續賽果，其他場次保留；輪空選手可替換且維持 0:0 自動晉級，輪空空席不能直接填人，須先調整總人數。支援復原、刷新保留與 Escape 取消選取，離開編輯／卸載清理拖曳狀態及監聽。報名者名單以 phase 存於 lunjian.bracket-roster.v1，原比分命令格式保持相容，各人數／進度配置仍分別儲存。

本輪仍為 preview=1 的本機示範編輯模板；報名者可手動新增，尚未接真實報名名單或提交正式賽果。正式裁判沿用既有 /judge 路由與生成 API。


### 2026-09-21 編輯視窗配色層級

依使用者標註，編輯 dialog 加入朱紅／霧藍兩側淡底、亮色標籤及比分；選定勝者以暖金色比分、摘要及實底獲勝按鈕突出。比賽前／中／完成以藍／紅／金色呼應現有文字，儲存操作採金底深字，提示採淡藍底，錯誤沿用柔紅。後輪鎖定姓名仍保持可讀，不用低亮灰字；保留鍵盤焦點、原生表單與手機版型。僅調整 lab/bracket-editor.css，生成同步，已確認的賽程樹美術與編輯邏輯保持不變。


### 2026-09-21 運彩本機試玩交接

`lab/lunjian-layout.html` 新增頁首運彩／會員點數、sports-open 與 ready 事件，以及 applySportsbookEvent 獨立賽事投影。preview 比武入口改接 React 運彩中心；先還原 dossier 焦點再開新 dialog。快照啟用後銷毀原編輯器，避免拖曳／改比分影響已鎖注單；賽程、比武與獎賞依該快照更新，原美術保留。

已用 to-theatron.py 同步標記、CSS、runtime、素材；生成前比對 public 素材與 lab SHA，未直接改生成物。會員、盤口、注單、結算、兌換之正本在 Theatron React `features/sportsbook`；舊 arena-ticket 保留供非 preview 的局部演出，不再負責完整試玩交易。

### 2026-09-21：觀局雅集入口
首頁導覽入口改稱「觀局雅集」，更多選單同步「進入觀局雅集」。lab 正本經 to-theatron.py 生成同步，資料鍵、事件與路由維持相容。


### 2026-09-29 UI 控制回饋與備戰保存
lab lunjian-layout.html 對導覽、CTA、比武控制與 BP 控制加入 150ms 按壓，不套用到人物、點燃與賽程卡片。loadout.html/js 補角色按鈕語意、短視窗入場、觸控尺寸、持續保存狀態、失敗重試與 pagehide flush，移除靜默忽略保存失敗。兩生成器已同步；執行前核對 public 受管理素材與正本 SHA 一致。實機動畫與手機浮層驗收待 CUA 沙箱恢復。

### 2026-09-29 備戰 Chromium 實測修正
隔離 Playwright 可操作真實 Chromium，已補驗三尺寸 18 狀態。loadout 正本拆開流派標題按鈕與等級控制、擴大工具／數值／匯出觸控區域、整理手機搜尋／關閉排列及數字面板寬度。`openPop`／`drawQadd` 的區域 `on` 改為 `selected`，避免遮蔽同名事件綁定函式。素材 SHA 比對一致後生成，版本 `086fb51915`。完整範圍與未完成項目見 Theatron UI_INTERACTION_PLAN；尚未將此結果視為所有浮層或動畫驗收完成。


### 2026-09-29 備戰 modal 及手機表單
loadout 正本十個 overlay 改為原生 dialog，保持外觀並修復焦點回復、嵌套確認及卸載。角色／匯入增欄位錯誤與覆寫確認，匯入保留 textarea 節點；套裝 optCard 參數改名避免 on 遮蔽。裝備加減支援鍵盤，手機預覽改可展開，表單單一捲動。生成版本 `84435305ca`；素材與 data SHA 核對一致，來源／輸出邊界仍正確。三尺寸實測細節見 Theatron UI_INTERACTION_PLAN。

### 2026-09-29 備戰編輯交易與報名交接
loadout.html/js：位置／武器種類／清空均暫存在編輯草稿，取消不保存，儲存才套用；表單輸入與選單達 44px，空詞條對比修正。流派初始化期間停用入口，返回報名先 flush，失敗聚焦重試並停留原頁，成功防重複導航。來源及 public 素材／data SHA 一致後生成，最後版本 `3074752b67`。隔離 Chromium 三尺寸 48 狀態及同活動往返／儲存失敗通過，詳細證據及全站未完成項目見 Theatron UI_INTERACTION_PLAN。


### 2026-09-29 首頁七章 UI 與詳情層級
lab/lunjian-layout.html 擴大報名／獎賞底部連結及頒獎按鈕、修正賽程題字深底對比、鍵盤 skip-link 聚焦目前正文並處理開場／詳情 inert；角色詳情層級高於頁首，關閉鈕 sticky，開啟重設捲動。素材 SHA 一致後生成版本 `1337e28f410f`。隔離 Chromium 三尺寸首頁 51 狀態及操作 27 狀態通過，未改原場景或動畫引擎；3D 流暢度仍待實際硬體驗收。完整結果見 Theatron UI_INTERACTION_PLAN。


### 2026-09-29 賽程編輯互動回饋
lab/bracket-editor.js、bracket-editor.css 補 44px 關閉鈕、人數錯誤就近顯示與焦點、比分錯誤焦點及編輯時清除、保存失敗不覆蓋警告、150ms 按鈕與 dialog 回饋。素材 SHA 比對一致後生成 `537368069856`。Theatron 隔離 Chromium 三尺寸 30 狀態通過；另檢查原勝敗／冠軍 keyframes 與距離縮放，未更改其美術。詳見 UI_INTERACTION_PLAN。

### 2026-09-29 備戰穿脫及 IO 錯誤路徑
lab/loadout.js 保留穿脫焦點、隔離非同步讀檔與剪貼簿回饋、支援同檔重試，複製配置失敗提供原生手動複製視窗。素材 SHA 核對後生成版本 366c143e36。三尺寸 72 狀態及 4 檔 67 測試通過；詳見 Theatron UI_INTERACTION_PLAN。

### 2026-09-29 墨暈時鐘
lab/lunjian-layout.html 的切章改用獨立實際時間，保留視差積分；稀疏影格仍先全覆蓋再換內容。111 檔素材 SHA 核對後生成 36b9e64bcf27。5 檔 76 測試與 build 通過，瀏覽器證據詳見 Theatron UI_INTERACTION_PLAN；不宣稱硬體 3D FPS 已驗證。


### 2026-09-29 首頁報名表入口
lab renderRegister 對無正式活動／本機試玩提供 data-registration-entry 與獨立表單備援 href，React bridge 直接開四步表單。明確選定本機活動後允許原首頁載入本機投影，並保留 URL preview／sportsEvent；正式 slug 入口不變。111 檔素材 SHA 核對後生成 e92ba976b01f。無活動代號首頁完整報名三尺寸 27 狀態通過，詳見 Theatron UI_INTERACTION_PLAN。


### 2026-09-29 報名書卷
報名章的雙 folio 卡替換為 registration-stage：左側題字、右側 registration-inline React 掛載點與紙卷邀請。保留 register-status／register-cta／activity-retry／data-loadout 與活動狀態更新，React 接管展卷；原擂台 shot 3 保留。最新生成 e7076c3717de；不得以先前報名 dialog 覆蓋本次使用者指定的章內表單。


### 最新覆蓋：中央收卷／導覽單行
2026-09-29 使用者明確指定：報名不用左右分欄，初始收起的書卷置中，點擊後原地展開。所有尺寸 nav 只能一行，取代先前小於 1024px 雙列規範；窄螢幕同排橫捲七章，次要操作進更多。正本 lab/lunjian-layout.html，生成版本 2335dc6a524a；驗收見 Theatron docs/UI_UX_VERIFICATION.md 最新段落。


### 2026-09-29 公開簡化與靜態首頁
新增 lab/home.html 經既有生成器輸出 /home 的 markup/css；lunjian-layout.html 移除公開閱讀提示與試看引導、管理控制限 mode=manage。報名卷改直接題字報名表；dossier 精確對應原 loadout catalog 圖片，未知配置不套圖。生成版本 f070ffbab50b。規劃與驗收見 Theatron docs/PUBLIC_PRESENTATION.md、UI_UX_VERIFICATION.md。


2026-09-29 首頁覆蓋：home.html 改共用 header、只留中央題字與兩 CTA；新增 home-stage.js 接既有 3D 山門。雪竹／雪梅／火盆取代枯松與石橋，前景 5/6/7、文字 10。生成器同步新模組且版本包含模組內容。驗收見 Theatron docs/UI_UX_VERIFICATION 最新段落。


2026-09-29 首頁視差：home-stage 將平滑指標與鏡頭進度同步至題字和分層前景，3D camera 增益 2.4；home.html 留雪竹、雪梅與最右下火盆，移除暖燈。2D／reduced-motion 維持静態；卸載清除 transform。驗收與選图以 Theatron docs/PUBLIC_PRESENTATION.md 最新段落為準。


2026-09-29 恢復 /home 原燒布：home.html 的 SHARED_BOOT 由生成器取自 lunjian-layout 正本；home-intro 管理等待點燃與備援，home-stage 呼叫既有 stage3d(runtime)，不重寫燃布。canvas 放主內容外，避免 intro 隱藏 main 時一併隱藏布幕。題字改小幅轉面與較慢阻尼。51 項回歸及桌機 3D／手機 2D 開場通過，詳見 Theatron UI_UX_VERIFICATION。


2026-09-29 首頁 CTA 改 Next 站內導覽並交接既有 scene/canvas；home-stage 到 stage3d 的交接只使用一次，逾時釋放。lunjian-layout 直接初始化目標章節，字形／3D 載入後 applyGrid 使用 animate:false，避免反覆啟動漫畫。最初燒布保留。82 項回歸與實際同一 WebGL 物件交接通過；軟體瀏覽器操作限制詳見 Theatron UI_UX_VERIFICATION。

2026-09-29 回首頁使用 lab/home-return.js 共用墨暈、等待 home-stage 首幀後揭幕；保留首次燒布。修掉 stage 後兩個多餘 closing div，防止 SSR 節點逸出 React 卸載範圍，並補內頁卸載最後一幀／比武清理保護。設計及驗證詳見 Theatron PUBLIC_PRESENTATION 與 UI_UX_VERIFICATION 最新段落。


2026-09-29 報名卷軸收合銜接：lab/lunjian-layout.html 的收起入口改為深木軸、獨立端帽與 84px 紙面，對齊 React RegistrationScroll 的連續捲動終點；由正本生成，不手改產物。深木色與紙色沿用語意 token。桌機／手機落點與焦點、草稿保留驗證通過；詳見 Theatron docs/UI_UX_VERIFICATION.md 最新段落。

2026-09-29 最新覆蓋：依使用者要求，收起入口恢復 64px 淺色圓紙卷和小端帽，移除 84px 上下木框；筆畫保持完成避免收合後重新描字。正本生成，動效與 React 交接修正見 Theatron PUBLIC_PRESENTATION 最新段落。

2026-09-29 報名捲動範圍：lab 正本縮減報名章 padding，展開 stage 留白改 8px；收合時暫停章節 overflow、使用 stable gutter，避免位移動畫長出 scrollbar，閱讀模式除外。由正本生成，桌機 1055×884 首步完整可見，詳見 Theatron UI_UX_VERIFICATION。

2026-09-29 最新卷軸：lab 增加共用 registration-roll 紙卷與橢圓端面，供原入口與 React 上軸共用；恢復 registration-seal-label 原 ink-draw，不再以 none 關閉筆畫。裝飾與 CTA 文字更新分離。正本生成，末段去重影與驗證詳見 Theatron PUBLIC_PRESENTATION 最新段落。

2026-09-29 共用 registration-roll 加上左右木柄；入口與 React 捲合上軸同步採用，手機預留柄的左右空間。由 lab 正本生成，驗證見 Theatron UI_UX_VERIFICATION 最新紀錄。


2026-09-29：完成首頁月位上移／火盆換覆雪松枝、比武題字左上暖金、頁首黑體、規則白衣人物置中、報名題字放大與加速、木柄穿過卷心的層次修正。首頁月位在交接內頁前還原。決策見 Theatron docs/PUBLIC_PRESENTATION，驗證見 Theatron docs/UI_UX_VERIFICATION。本次 3D 自動瀏覽器無回應，實際 3D 視覺不列為通過。


### 2026-09-30 報名選取備戰角色／右方黑影

設定角色改為選擇儲存角色，沿用 lab 的 v3 儲存與 build-note 格式。列出同活動同會員的備戰角色及原本不綁帳號的本機角色庫，不掃描其他會員／活動的隔離儲存。按角色一次套入角色姓名、流派、主副武器、裝備與完整武學配置；摘要保留必要三欄，完整配置及選填備註收在 details。尚未配置的角色直接前往指定角色編輯，不能當成有效配置套用。

「前往備戰方案／編輯這個備戰角色」先儲存報名草稿，成功才離頁；傳遞活動、指定角色及明確 returnTo 列舉值。備戰頁先 flushSave，成功才返回原本的報名卷軸或雅集參賽頁，回程只接受同一活動及會員的角色；卷軸自動展開到設定角色，最後確認才完成報名。保留舊 arts 回程相容。圖庫／儲存讀取失敗顯示重試，不當成沒有角色。

正本為 lab/registration-roles.js、build-note.js、loadout.js，由 loadout-to-theatron.py 同步生成 React 共用 runtime；不複製第二套格式解析邏輯。設計理由與驗收只寫 Markdown，不放公開頁面。

右方交鋒黑影放大 20%，依原圖透明邊距補正腳底落點，讓左右人物份量接近；文字與按鈕、賽後勝敗插圖不縮放。桌機及手機沿用同一比例。

2026-09-30 最新覆蓋：比武題字從左上改上方置中；宗旨／規則／讓武章名使用 H2，保留單一 H1，移除補充灰字及賽程兩側標頭。bracket-tree 增加預設關閉的 previewEmpty，首頁未公布時使用空席／準決賽／決賽示意，所有資料操作 disabled，手機仍可切輪。維持活動 DATA 原值；公布後正常 render，不暴露未公布名單。正本生成，驗證見 Theatron docs/UI_UX_VERIFICATION。

2026-09-30：lab 比武移除腳下查看備戰方案偽元素，人物／姓名仍直接開 dossier；兩個底部操作改中央主次排列。宗旨白衣仍跨框，第一格文字移左下、第三格對白調整圓角及內距避免越界。首頁生成器同步；首次展卷就緒門檻與焦點修正在 React，詳見 Theatron PUBLIC_PRESENTATION。

2026-09-30 最新覆蓋：使用者撤回最新跨框調整，novice-breakout 回到 100% 高度，第一格對白回原右下；對話框留白及其他修正保留。正本生成，labRuntime 33 項通過。

2026-09-30：第一格對白明確靠右，第二格 top 48px／手機 32px。lab 正本生成，瀏覽器兩尺寸及 labRuntime 33 項通過。

2026-09-30 獎賞由 lab 正本改為三級印章：冠軍 124／108px 朱紅金飾蠟印、亞軍 76px 銀章、季軍 48px 方印，新增銀色語意色版。保持 data-comic-layer 的同一落印生命週期。生成完成，兩尺寸瀏覽器與 50 項回歸通過。


### 2026-09-30 最新覆蓋：三席書卷印與獨立背景
使用者改為統一中國書卷印風格並區分亞季軍：冠軍大白文方印、亞軍回紋角飾朱文方印、季軍直式朱文長印，全部固定卡片右上，移除蠟印／銀章。章內直排文字依尺寸縮小並保留邊距。刪除大數字與「第 N 名」，底部為名次＋得主；未知顯示待揭曉，已有本機／示範資料分開標示來源，沒有補造人名。三位獨立人物向左移，移除較晚規則對人物位置的舊覆寫。

三張背景各自生成為完整不透明水墨場景：冠軍山門石階 `manga-awards-courtyard`、亞軍臨水庭院 `manga-awards-lakeside`、季軍竹林演武場 `manga-awards-bamboo`。PNG 原稿及 WebP 皆在 lab/art，提示詞摘要見 lab/AWARDS_BACKGROUND_PROMPTS.md；只有格式轉換，沒有程式繪改素材。保留逐格落印及 reduced-motion。

修正 React precedence 樣式在熱更新後殘留的舊銀章／relative 定位：LunjianRuntime 只在本次版本 CSS 就緒後停用舊 lunjian.css，其他 stylesheet 不受影響。隔離瀏覽器 1198／375px 驗證右上定位、文字落在印框內、人物靠左、三張不同圖片正常載入、無水平溢出。畫面證據 docs/previews/september-polish/awards-1198.png 及 award-{1,2,3}-375.png；本轮為 2D 備援，未驗證 GPU 3D。內嵌瀏覽器工具仍因 Windows sandbox lock 失敗，未操作使用者目前頁面。


### 2026-09-30 最新覆蓋：獎賞背景改為疏淡水墨
依使用者指出背景細節過密，內建 imagegen 重新生成三张獨立低對比背景：manga-awards-mist-gate（遠山孤門）、manga-awards-mist-lake（霧湖小亭）、manga-awards-mist-bamboo（疏竹山嵐）。使用少量大形狀、大片霧色與淡墨，不使用密集漫畫刻線、建築雕飾、瓦片或石板紋理。連續紙色淡墨鋪滿卡面，沒有透明缺角；三張場景各異，人物左側與印章右上維持既有位置。
PNG 原稿在 lab/art/_src/awards-quiet，WebP 在 lab/art；舊圖保留但卡片不再引用。已從 lab 生成，33 項 labRuntime 通過；1198／375px 的 2D 瀏覽器確認三張載入、印章位置與文字邊界、人物靠左、無水平溢出，並檢視桌機合成畫面與手機卡片。沒有新增互動或修改資料流程。


### 2026-09-30 演武台背景、獎賞章名與備戰返回入口
獎賞三張背景依最新要求重新生成為演武台：山門石台、臨水擂台、竹林練武台。保持淡墨低對比與獨立場景，寬平台面、台身及階梯清楚可見；背景裁切重心 72%，保留人物左側、三級印章右上。新增 art/manga-awards-arena-{gate,lake,bamboo}.webp，PNG 原稿存 art/_src/awards-arena。獎賞章名置中並直接作為 H2／section accessible name，移除「三席，留名。」及「每一席，都由交鋒寫下。」。

備戰頁新增一直可見的「返回比武」連結，桌機與手機均不需開更多選單；首頁／備戰往返保留 sportsEvent、slug、preview、stage、mode、view，返回固定 #duel 並略過重播開幕。品牌及手機選單出口同步；有未寫入配置時先 flushSave，失敗停留並聚焦重試，不把未儲存資料默默丟掉。移除頁首版本／日期的 DOM 與寫入程式，角色與 catalog 格式不變。既有報名交接按鈕 returnTo=register 不改。

已從 lab 分別生成首頁及備戰；labRuntime、loadout/page、chapterTitles 54 項通過。verify-loadout-duel-return-browser.mjs 實際點擊返回並確認同場參數、#duel[data-on]、再進備戰的 URL、無頁面例外及無水平溢出；1198／375px 均通過。獎賞亦於两尺寸檢查與檢視畫面，證據 september-polish/awards-1198、award-*、loadout-return-*。使用隔離 2D 瀏覽器，未宣稱 GPU 3D 實測。

2026-09-30 比武前景：依使用者標記移除 shot 3 的 fg-banner-black 圖層（LAYERS[3] 清空），2D／3D 都不再掛左上旗子素圖，開場燃布不變。正本已生成；34 項 labRuntime 通過，隔離 1198px 2D 瀏覽器確認前景為空且雙俠仍存在，截圖 duel-no-flag.png。此前本輪 typecheck、修改檔 ESLint、token lint 通過。


### 2026-09-30 分頁標題統一
宗旨、規則說明、讓武、賽程、獎賞標題統一水平及垂直置中，字級 48–68px；移除章節編號與標題旁短句。比武沿用置中的舞台題字並統一字級，報名保留置中的卷軸入口。保留正文與活動狀態。

宗旨題字的「旨」使用較細筆鋒與較小行書偏移，分開上下結構並保留逐筆動畫。報名卷軸移除兩行重複抬頭，主標題改為朱紅色「百業試鋒，赴約名帖」。

最新使用者調整：七章題字右側加入同式朱紅方印（序／壹／貳／參／肆／伍／陸），不恢復短句；一般標題區高度由 144／120px 收至桌機 112px、手機 96px。印章絕對定位，題字中心不偏移。

2026-09-30 最新調整：七個分頁的章序印章統一移至題字左側，保持題字中心及桌機／手機間距；獎賞卡片的名次印章位置不變。

章序印章放大為桌機 46×50px／手機 34×38px；寫字期間隱藏，沿用最後一筆 animationend 的 complete 狀態觸發 420ms 淡入落印。切場暫停，減少動態直接顯示。


2026-09-30 漫畫與字體：依使用者回覆修正分層順序為背景 240ms → 人物 360ms → 前景 220ms → 對白 280ms，只為存在的圖層建立時間段；整格左右入場仍為 900ms 串行。獎賞落印在對白之後（880ms）開始。移除人物／前景位移以免覆蓋原構圖；快速捲過播放中画格立即完成並釋放佇列，保留切章卸載及鍵盤保護。漫畫／全文副標題統一 H3，唯一 H1 為活動名，章節 H2 不變；副標 20–28px、正文 15–16px、朱紅註記 12px，正文墨色。報名卷軸例外使用右側小章（30×34／26×30px）。
新增 web/public/duel-title-study.html：四種比武標題設計以原頁 iframe 預覽，只有試樣 iframe 套用樣式，提供寬版／手機及重播；正式比武設計等待使用者選擇。

2026-09-30 已依使用者選擇套用比武標題 C「長印橫題」；印章相對試樣往右、往上各 12px，題字置中、長印 -8deg、全字完成後 480ms 落印。桌機長印 43×76px、手機 34×58px，其他頁印章維持既有設定；試樣預設同步 C。

比武 C 印章最新微調：在上一版位置上再往上 8px、往右 2px；相對原試樣共右移 14px、上移 20px，桌機／手機及試樣同步。


2026-09-30 比武底部入口簡化：移除兩名選手快捷下注按鈕，只保留「觀局雅集」，點擊仍開啟本場觀局；返回賽程保留。修改 lab 後重新生成；scheduleDuel／labRuntime 45 項通過，瀏覽器確認入口可開啟。


### 2026-09-30 配裝卡片與觀局統一
- 投注入口整合為「投注區」，內部切換對局／名次；對局選手與勝負、比分選項依左右方排列，保留同一注單。
- 首頁與觀局內的備戰配置共用 dossier-demo.json 示範資料；真實公開角色優先。示範裝備屬性與 BP 限制明標示範，不寫入選手資料。
- 配裝視窗統一為窄版紙頁；武學採橫卡、心法採直卡、裝備採圖片抬頭加屬性列，BP 採獨立表格。內層保留原生 dialog 焦點與 Escape／外側關閉。
- 比武摘要顯示主武學、雙武器、稱號與段位，放大文字與間距；移除多餘賠率提示、重複場次及待評定狀態。
- 配裝選擇器改黑體，名稱桌機 18px／手機 17px，分類橫捲、長說明自然換行；桌機奇術兩欄，手機單欄。
- 驗證：Sportsbook、scheduleDuel、labRuntime、loadout/page 共 80 項測試通過；typecheck、指定 ESLint、349 檔 token 檢查通過。Playwright 隔離資料驗證 1198／375px 的內外配置與流派／心法／奇術選擇器，沒有橫向溢出。截圖位於 Theatron docs/previews/september-polish/。首頁僅驗證 2D 備援，未重新驗證 3D 舞台。


2026-09-30 卡片與入口追修：武學改成單張流派卡，使用現有流派徽記、兩項武學及背景族徽；奇術以 CSS 書脊、線裝、頁邊和直排題簽呈現。首頁與觀局內配裝同步。BP 表增加完整外框、列線、欄線與固定 BP 欄寬。移除宗旨底部的下一頁／參賽入口／活動狀態區塊；/home「了解賽制」改連宗旨 #prologue，保留活動參數。桌機 1198px、手機 375px 瀏覽器驗證卡片與 BP 無橫向溢出、首頁跳轉正確；Sportsbook／labRuntime 63 項、HomeRuntime／labRuntime 35 項（含重疊測試）通過，typecheck、ESLint、token 檢查通過。僅驗證 2D 場景。


2026-09-30 閱讀與視覺細修：完整規則改原生 dialog，入口置於靠右的「下一章 · 選擇讓武」上方，保留五節全文，支援關閉鍵、Escape、外側關閉與焦點返回。宗旨 details 加入 380ms 高度展收，可連續反向點擊，reduced-motion／閱讀模式直接切換，卸載清理動畫。報名章移至題字右側 12px；心法名稱與主修置中；裝備抬頭改黑至金漸層；中央輪次場次改深底金線牌，桌機 18px、手機 14px。34 項 labRuntime 回歸通過，token 檢查通過；瀏覽器驗證桌機正常展收、桌機／手機規則五節完整與無橫向溢出，手機 reduced-motion 可用；場次牌與心法置中已於 1198／375px 驗證。首輪手機完整載入等待逾時，改 DOMContentLoaded／獨立頁重試通過。


2026-09-30 場次標示追修：依使用者要求移除中央輪次／場次的方框、實心底及內框陰影，保留桌機 18px／手機 14px 金色字與墨色文字陰影，以非互動場景標示呈現。


2026-09-30 奇術選擇器：紅色截字印記改為 CSS 線裝武學書，完整書名單一直排，依字數自動增加封面高度（至少 116px），保留搜尋、分類與選取。桌機 1198／手機 375px 驗證 21 張書名均不折列或裁切；labRuntime／loadout/page 40 項通過。


2026-09-30 報名重整：使用者要求取代卷軸設計，入口與表單改一般紙頁，移除軸頭與展收動畫。統一主要／次要操作、四步進度、欄位與手機排列；保留登入、角色配裝、確認送出、回執及返回草稿。已排名單活動使用公開狀態說明。詳細設計審理與元件／流程對應見 docs/REGISTRATION_DESIGN.md。桌機 1198／手機 375px 確認無溢出及草稿保留；Bridge/labRuntime 39 項通過。


## 2026-09-30 流程覆蓋：直接進入報名

最新需求取代入口卡：進入報名章直接掛載表單，不先點「開始報名」。版面為接近讓武章的全幅淡紙面與寬正文。第一步包含參賽賽制、讓武裁判、配置公開三項已讀確認；完整賽制與讓武清單可另行查看。Stepper 在章內捲動時置頂；追蹤最遠到達步驟，返回後可點回已到達步驟，原輸入保留。未到步驟仍須通過驗證。已排定名單活動保留閱讀清單，停用報名後續步驟並明示原因。標準返回導向讓武，不再回到入口卡。首次進入報名才初始化本機報名，不在其他章節建立活動。

驗證：1198／375px 自動進入報名、三項清單、固定步驟列（捲動後 top 80px）、無橫向溢出；新增已讀完成與前後跳轉保留輸入的測試。僅驗證 2D 場景。


2026-09-30 已讀確認最新覆蓋：依使用者要求移除三張說明卡與逐項勾選，統一成單一「我已閱讀並了解賽制與讓武原則」勾選項；句內賽制／讓武原則為獨立可操作連結。開放報名與名單已排定狀態共用同一呈現，固定步驟導覽保留。桌機／手機確認僅一個 checkbox、連結可跳轉讓武；35 項相關測試、typecheck、ESLint、token 檢查通過。

### 2026-09-30 報名題字與雙人物構圖
- 移除報名面板的「返回讓武」與「百業試鋒」小標。
- 章節標題復用既有逐筆書寫引擎，呈現「報名」與「參」印章。
- 第一步在固定步驟列下恢復白衣、黑衣人物，沿用既有素材；保留單一已讀勾選及賽制／讓武連結。
- 驗證：typecheck、69 項相關測試、修改檔案 ESLint、349 檔 token lint 通過；2D 預覽 1198px／375px 均有雙人物、單一勾選且無橫向溢出。截圖位於 docs/previews/september-polish/registration-figures-{1198,375}.png。

### 2026-10-12 夜鴨爭鋒讀取識別與前進箭頭
- 使用者選定讀取名稱「夜鴨爭鋒」；更新小型 SVG 月影／閣簷／交劍圖記與四字標題，完成时落下「夜鴨閣」印章。
- 載入線改為向右劍痕，CSS transform 跟隨實際進度；100% 轉金，短暫停留後銜接原點燃布幕。保留語意 progress、百分比與 reduced-motion；沒有新增依賴或虛假進度。
- 宗旨、規則、讓武三個下一章入口統一使用 →。
- 46 項 labRuntime／stageIntro 測試、typecheck、349 檔 token lint 通過。2D 桌機 1198px／手機 375px 實測新名稱、100% 與箭頭，截圖 docs/previews/september-polish/night-duck-{loading,ready}-{1198,375}.png；本次未另驗 3D。

### 2026-10-12 烏鴉、月亮與羽毛線條識別
- 依最新要求取代閣簷雙劍：Logo 為彎月、棲鴉與飄羽的原生 SVG 線稿，保持「夜鴨爭鋒」標題與完成落印。
- 跑條改羽軸與羽枝，由實際進度水平揭露，不壓縮羽毛比例；原生 progress 保留可及語意。線稿入場沿用 CSS 筆畫動畫及 reduced-motion。
- 46 項開場／labRuntime 測試、token lint 通過；1198／375px 2D 瀏覽器確認羽毛揭露比例與名稱，截圖 crow-moon-{1198,375}.png。

### 2026-10-12 鋒芒烏鴉與線條本身動態
- 使用者要求取代圓潤棲鴉：改為尖喙、斜眼、展翼與分叉尖羽的角線輪廓，月亮與獨立羽毛保留。
- 移除讀取羽毛的水平 clip-path 揭露。羽軸與 12 根羽枝各自使用 pathLength／stroke-dashoffset 隨實際進度繪製；羽枝交錯輕揚，羽軸細光循環流動。100% 完整繪出並停止等待動畫，reduced-motion 停用裝飾動態。
- 沿用原生 SVG/CSS，未增加 Canvas 或 GSAP 依賴。46 項測試、typecheck、token lint 通過；1198／375px 2D 驗證線條沒有遮罩、等待中 transform 隨時間變動、完成 offset 為 0，reduced-motion 為 none。截圖 crow-sharp-{1198,375}.png。

### 2026-10-12 D3 疏影越月定稿與正式整合
- 使用者確認 D3。正式開場改用 D3 梅枝、山峰、月環 Canvas 線稿；沿用米白淡金及深色背景，長讀取條採已選定 A 幾何羽枝。
- lab/boot-symbol.js 為共享繪製器，首頁及 /home 都接至原生 progress 真實載入值；完成後完整顯示並停止動態，銜接原點燃布幕。隱藏分頁、hidden 開場及卸載停止 RAF，清理 observer/listener；reduced-motion 靜態呈現。
- 從 lab 原始碼與生成器整合，未改試稿；保留既有進站狀態與功能。48 項 labRuntime/stageIntro/homeIntro 測試、typecheck、349 檔 token lint 通過。
- 瀏覽器 1198/375px 2D 確認載入 85%、完成 100%、點燃後進站、無橫向溢出及無 JS 錯誤；3D 確認 data-stage=3d、100% 及 Canvas 圖形且無 JS 錯誤。reduced-motion 保留既有靜態入口。截圖 docs/previews/september-polish/plum-D3-production-{1198,375}.png。

### 2026-10-12 讓武頁尾導覽位置
- 讓武頁尾交換完整規則與報名赴約位置，順序為「← 完整規則／先準備備戰方案／下一章 · 報名赴約 →」。窄螢幕換行後下一章仍靠右，原連結目的地保留。
- 從 lab 修改並重新生成；34 項 labRuntime 測試通過。786px 驗證左右順序，375px 驗證下一章右緣對齊且無橫向溢出；截圖 docs/previews/september-polish/handicap-footer-{786,375}.png。

### 2026-10-12 七章共用前後導覽
- 依最新需求取代個別 manga-link／manga-turn／document-footer 導覽：七章使用同一 chapter-nav，左側上一章、右側下一章；文字以方向小標與正式章名統一，箭頭統一 ←／→、64px 高度及鍵盤焦點。宗旨左側返回 /home，獎賞右側回到宗旨，不虛構第一章的前章。
- 統一章尾位置、雙欄排版、字級、分隔線與手機間距。規則／讓武／報名為墨字，比武／獎賞局部深色底確保場景上的可讀性。備戰方案另列；對局返回賽程的焦點交接仍保留。完整規則對話框沿用同一導覽樣式。
- 從 lab 修改並生成；更新既有流程測試的頁尾選擇器，45 項 labRuntime/scheduleDuel 測試通過，指定 ESLint 及 349 檔 token lint 通過。
- 1198/786/375px 閱讀模式七章均有兩個可見入口且無橫向溢出；786/375px 一般模式驗證七章章尾均可捲動到達、鍵盤 Enter 返回上一章及前後切章正常，無 JS 錯誤。截圖 docs/previews/september-polish/chapter-nav-*.png。本輪畫面驗證使用 2D 場景，未另重跑 3D。

### 2026-10-12 報名底部「我的武學配置」入口
- 從讓武章移除配置入口，移到報名內容下方、前後章節導覽上方；以紙面區塊、說明與朱紅主要按鈕呈現。名稱改為「我的武學配置」，同步首頁捷徑、報名內相關文字、配置頁標題與 metadata。
- 未登入顯示「登入並設定」，透過現有本機會員登入表單開啟配置目的視窗；取消還原入口焦點。登入後顯示繼續入口並聚焦，頁面按鈕改為「設定我的武學配置」；已登入直接前往配置。保留 sportsEvent／preview／stage 等現有參數，追加 returnTo=register；不更改公開配置器的儲存與存取機制。
- 從 lab 生成首頁與配置頁。80 項 SportsbookBridge／Sportsbook／SavedLoadoutRoles／labRuntime／loadout 頁測試通過，typecheck、修改檔案 ESLint、349 檔 token lint 通過。
- 786/375px 2D 瀏覽器確認入口位置、登入視窗、取消焦點與無橫向溢出。隔離瀏覽器完成本機註冊、登入後聚焦繼續入口、進入配置頁並保留活動與返回報名參數，無 JS 錯誤；未對使用者現有資料建立測試帳號。截圖 docs/previews/september-polish/my-loadout-*.png。

### 2026-10-12 報名操作區精簡

移除 lab 首頁獨立 registration-loadout 大卡與專屬樣式；配置入口由 React Participation 的報名操作區承接。RegistrationScroll 收斂本機提示與間距。已檢查資產目的地並以 to-theatron.py 重新生成；786／375px 瀏覽器及 71 項相關回歸通過。

### 2026-10-12 獨立对局小工具入口

- lab/lunjian-layout.html 的「更多」新增 data-match-tools 入口；由 React SportsbookBridge 承接擲骰與猜拳視窗，首頁及 /home 共用。保留既有字體、Logo、章序與資產。
- 生成前已核對 art/type/vendor 目的地均在 theatron/web/public，無需保留的目的地獨有資產；執行 lab/tools/to-theatron.py 同步，未直接修改生成檔。
- 工具不讀寫比賽資料或先後攻。1198／375px 驗證骰子、出拳交接、Escape 返回焦點及賽事 state 完全不變；/home 手機 reduced-motion 通過。
- 合併 sportsbook、labRuntime、LunjianRuntime、activityDisplay 共 179 測試通過，typecheck／ESLint／token 檢查通過。完整驗收見 theatron/docs/ROLE_FLOW_AUDIT.md。

### 2026-10-12 獎賞說明與操作列重構

- 獎賞下方窄版說明卡改為與頒獎席同寬的資訊列；桌機／平板左侧兩段說明、右側獨立操作區，使用細線與向右箭頭，移除行內中點分隔。600px 以下上下排列，兩個入口各保留 44px 以上觸控區。
- 保留原前三名卡片、獎項待公布文案及活動／配裝的 data 屬性與動態連結。正本為 lab/lunjian-layout.html，生成前確認 art/type/vendor 無目的地獨有或不同檔案，再執行 to-theatron.py。
- 1198／786／375px 瀏覽器驗證資訊列與頒獎席等寬對齊、手機堆疊、鍵盤焦點、動態 href、長文字及無橫向溢出；786px 另檢查一般動態場景。無 pageerror，截圖與幾何紀錄在 docs/previews/awards-footer/。
- labRuntime、LunjianRuntime、activityDisplay 共 53 測試通過；typecheck、364 檔 token 檢查通過。同步倉庫內 lab 快照與 manifest。
