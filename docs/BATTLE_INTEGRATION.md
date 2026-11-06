# 戰局 A–J 正式整合（2026-10-31）

把 `nav-schedule-preview` 已核准的 A–J 賽事畫面接進正式首頁的「賽程」與「比武」兩章。
視覺基準：`battle-preview.html#A–H` 與 `champion-reference.html?layout=I|J`，以及使用者提供的四張參考圖
（`nav-schedule-preview/assets/battle-references/AB.png、CDEF.png、GH.png、IJ.png`）。

## 檔案與流程

| 位置 | 角色 |
| --- | --- |
| `design/lunjian/lab/battle-model.js` | 由公開賽程資料判斷版型（A/B/I/J 看賽程，C–H 看場次雙方人數）、冠軍、晉級歷程、標題文案 |
| `design/lunjian/lab/battle-view.js` | 三個 Shadow DOM 畫面：A/B 對戰樹、C–H 比武、I/J 冠軍；選手資料對話框 |
| `design/lunjian/lab/battle-embed.css` | 隔離在 Shadow DOM 內的補充樣式（樹、連線、狀態、空照片佔位、月山背景） |
| `design/lunjian/lab/battle-live.css` | 正式頁面範圍樣式：兩章的山景底、烏鴉／木框／燈籠導覽；`@NAV` `@SCHED` `@DUEL` `@BATTLE` 由生成器展開 |
| `design/lunjian/lab/tools/battle-assets.py` | 把核准稿的 CSS 快照到 `design/lunjian/battle-study/`，素材轉 WebP 進 `web/public/battle-preview/`，合成 `web/public/lunjian/battle-art.css` |
| `design/lunjian/lab/tools/to-theatron.py` | 一如既往的生成器；現在順便跑上面的打包，並把 `battle-view.js`／`battle-model.js` 帶版本號寫到 `web/public/lunjian/` |
| `web/src/features/landing/tournamentDisplay.ts` | 未改；`gameAvatarUrl`（管理員收圖）直接餵給 view 當正式照片 |

改畫面一律改 lab 來源，然後在 theatron 根目錄執行 `python design/lunjian/lab/tools/to-theatron.py`。
核准稿不在 repo 內時，生成器沿用 `design/lunjian/battle-study/` 與已打包的 WebP；要重新打包請設 `BATTLE_STUDY_ROOT`。

## 行為

- 賽程章：`#bracket-host` 內先是戰局畫面（Shadow DOM），下方 `details.battle-results` 保留原本的對戰表，供管理模式的籤位編輯與完整賽果使用。
- A/B：左右兩側各自依輪次排列，決賽在中央黑紙上；每場的「第 N 場／比分」籤可直接進入比武；手機改為分輪清單，可展開完整圖橫向滑動。
- C–H：比武章改由 `#battle-duel-host` 承載；1v1 大人物牌、2–4 人直列、8 人雙列、16 人分四組；手機紅藍方切換。返回賽程後焦點回到原場次籤。
- I/J：中央冠軍，左右保留晉級歷程（I）與晉級路線（J）；歷程列可回看該場比武。
- 未公布：畫面整個隱藏，只顯示「對戰表尚未公布」，不輸出任何選手。
- 缺照片：一律用剪影佔位並標示「遊戲照片待提供」，不借用示意人物。
- 深淺模式跟隨 `data-color-mode`，導覽素材日夜各一套。

## 驗證

- `node scripts/verify-battle-layouts.mjs [base] [out]`：A–J × 1440／1024／390 × 深淺，檢查版型判斷、頁面錯誤、破圖、橫向溢出，輸出截圖與 `report.json`。
- `node scripts/verify-battle-interactions.mjs [base] [out]`：賽程→比武→返回焦點、選手對話框與 Escape、鍵盤、I/J 歷程跨斷點、H 分組、手機切邊、輪次頁籤、導覽抽屜、主題切換、烏鴉 hover、燈籠、未公布不外洩。
- `node scripts/audit-battle-ui.mjs [base] [out]`：自動稽核每個畫面（A–J × 三尺寸 × 深淺）：文字裁切與非預期換行、元件超出框線或畫面、場次籤壓到文字、卡片互相重疊、44px 觸控目標、14px 最小字級、字體家族是否為站內 Noto TC、導覽標籤換行、間距是否落在 4px 網格。輸出 `audit.md`／`audit.json`，有問題的畫面附截圖。
- `node scripts/verify-battle-production.mjs [base] [out]`：正式站煙霧測試（路由與素材 200、無 5xx、真實 API 未公布時不外洩、手機導覽）。
- `web/src/app/scheduleDuel.test.ts`：16 項，涵蓋新戰局的選場、對話框、配置入口與返回焦點。

版面規則（依 Material 的尺度，套用專案自己的語彙）：卡片之間 16px、輪次欄之間 72px 溝槽（場次籤在溝槽裡、不壓卡片）、觸控目標 44px、內文與段位最小 14px、數字 tabular-nums、字體只用站內 `--font-display`／`--font-body`／`--font-mono`。

兩支腳本用的是注入賽程資料的檢視方式（`window.__LUNJIAN.updateTournament`），只在本機／驗證時使用，正式資料不會被改動。

## 已知限制

- 後端 `Player` 只有個人資料；沒有「隊伍／成員」契約，D–H 與 J 目前只能用注入資料驗證，正式活動（百業試鋒）是個人賽，只會出現 A/B/C/I。要上團體賽需先討論 schema。
- 管理員收圖的 `gameAvatarUrl` 是 256px 正方形縮圖，顯示時裁在名牌內；參考圖的「人物向上突出框線」需要去背半身圖，目前後端沒有這種素材。
- 2026-10-31 以 Codex CLI（`codex exec` 內建生圖）依參考圖補齊四張素材，存於 `nav-schedule-preview/assets/battle-produced/`，提示詞、原始輸出與去背腳本記在同目錄 `codex-2026-10-31-prompts.json` 與 `_src-2026-10-31/`：
  - `moon-mountain-v2.png`：灰墨月山，取代米色捲雲的 v1，用於 A–H 中軸。
  - `crown-v1.png`：A/B 決賽欄「冠軍」上方皇冠。
  - `team-emblem-red-v1.png`／`team-emblem-blue-v1.png`：H 隊名旁的紅藍隊徽。
  使用者已於 2026-10-31 確認定稿。
- 仍未補的參考圖元素：J 成員卡與 C–F 名牌的去背半身人像（需要每位選手的燕雲照片，不能用生成人物冒充）、手機版 A/B 直式紙面（沿用桌面紙面）。
- 核准稿的 Noto Serif TC 子集字型只含預覽文字，未隨站上線；站上沿用系統字體堆疊。
- 站內導覽抽屜按 Escape 不會關閉（既有行為，與本次無關），驗證腳本改用關閉鈕並記錄。

## 2026-10-31 第二輪：全站導覽、版面重建、Codex 補素材

- **導覽列全站統一**：烏鴉、木框、燈籠不再只在賽程／比武兩章出現。樣式來源 `design/lunjian/lab/timber-navigation.css`，生成到 `web/public/lunjian/timber-navigation.css`，由根版面 `layout.tsx` 載入；裝飾層由 `web/src/features/chrome/navigationArtwork.ts` 注入，所以舞台、/home 與所有 React 子頁共用同一套。1160px 以上單列；601–1159px 放得下幾章就顯示幾章，其餘收進「更多」（見第十八輪）；手機的章節列可左右滑；右側固定「日夜／會員專區／更多」，800px 以下只留目錄鈕。
- **A/B 對戰樹**依原稿重建：滿版紅藍紙翼、橫向名牌（種子號＋人像＋姓名＋段位＋狀態章）、雙側晉級線（贏家走金線）、中央「月山＋皇冠＋冠軍」黑框、待定冠軍框、狀態說明列。平板整棵樹等比縮放、不裁切；手機改分輪清單。
- **C–H 比武**依原稿重建：標題「戰局 / X · NvN」、紅藍滿版紙翼夾黑紙中軸、中軸月山與大比分、隊名、名牌依人數改高度、G 雙列、H 隊徽＋分組頁籤＋展開完整名單。手機改「比分卡＋隊伍切換＋單隊紙面」。
- **Codex 新增素材**（`nav-schedule-preview/assets/battle-produced/`，提示詞見 `codex-2026-10-31-prompts.json`）：`wing-red-v1`、`wing-blue-v1`（滿版紙翼）、`center-strip-v1`（黑紙中軸）、`portrait-empty-v1`（缺照片時的無五官水墨剪影）。使用者已於 2026-10-31 確認定稿。
- **新增檢查**：`scripts/audit-site-ui.mjs` 掃全站每頁 × 四寬度 × 深淺；`scripts/compare-battle-reference.mjs` 把 A–J 現況與原稿並排輸出。測試資料移到 `scripts/battle-fixture.mjs`。

## 2026-10-31 第三輪：紅藍對立方向、全站資訊視窗統一

- **面對面**：原始人像與空狀態剪影都面向右，藍方一律水平鏡像（A/B 名牌、C 大人像、D–H 名牌、I/J 兩側名牌、手機分輪），所以紅方面向右、藍方面向左。滑入效果改用獨立的 `scale`／`translate` 屬性，不會把鏡像抵消。
- **資訊視窗統一**：除了比武與賽程，其他頁面都是「圖像背景＋規則說明油紙視窗」。油紙＝`--surface-paper-texture`（水墨雲紋卡紙）蓋 70% 紙色，外框 1px `--border-auth`。
  - 舞台章節：讓武的木框改成同款油紙（`design/lunjian/lab/chapter-plaque.css`），獎賞補上同款視窗（`paper-theme.css`）。
  - React 頁：會員登入、註冊、會員專區、小工具、裁判登入的容器加 `data-paper-window`，共用 `web/src/app/paper-window.css`；卷軸木軸移除；頁面背景改為與舞台同一張水墨場景。
- 已知限制：備戰方案（/loadout）與運彩頁（/sportsbook）是工作台型頁面，未改成單一視窗；loadout 的產生器在唯讀 `sources/`，其「帶入報名表的文字」摺疊列高度 28px 未修。

## 2026-10-31 第四輪：還原超出範圍的改動

使用者指出要改的只是卡片內的元件擺放與字體，前幾輪重建整章的做法超出範圍。依使用者選擇「保留要求的，還原其餘」：

- **保留**：全站烏鴉／木框／燈籠導覽、圖像背景加規則說明油紙視窗（讓武、獎賞、會員登入註冊、會員專區、小工具、裁判登入）、Codex 生成並定稿的素材（仍打包在 `web/public/battle-preview/`）、戰局元件裡紅藍面對面的鏡像規則。
- **還原**：
  - 導覽列的毛筆底線、hover 變色、品牌字底線與上浮、會員專區底線（疊在新版導覽上）。
  - 比武章：黑影俠客對峙、VS 水墨、結果與倒地動畫、封盤印章、毛筆章名、舞台背景大圖。
  - 賽程章：原本的紙面對戰表（樹狀／分輪切換、管理員排籤位）。
  - 兩章不再套用戰局山景與紅藍紙，回到舞台背景。
- **未掛載**：A–J 戰局畫面（`battle-view.js`、`battle-embed.css`、`battle-live.css`）程式與檢查腳本保留在 repo，但舞台不再載入；`to-theatron.py` 不再把 `battle-live.css` 打進 `lunjian.css`。
- 後續只依使用者指定的卡片，調整卡片內部的元件擺放與字體。

## 2026-10-31 第五輪：導覽燈籠與首屏

從讀取畫面 → 封面 → 首頁的冷啟動流程中，導覽列有五個問題，均已修正並部署：

- **燈籠不亮**：點亮層排在原本木框底下，被蓋住了。點亮層改疊在上層，遮罩換回定稿的三格燈紙。
- **滑到燈籠就熄**：燈籠掛在導覽框外。框外加上不擋按鈕的感應區，離開後保留 100ms，觸控點一下亮 1.5 秒，鍵盤聚焦也會亮。
- **第一次 hover 缺圖**：hover、選取、按下、烏鴉、夜間版與點亮版圖片，在導覽掛載後的閒置時間預先載入。
- **首屏導覽沒框**：木框與烏鴉改成在伺服器標記就輸出，不再等 JS 注入；章節鍵加上紙色底，圖片到之前不透明。
- **從封面進入後導覽消失**：舞台舊版開場與新版封面開場同時監聽入場按鈕，舊版先把按鈕停用，新版動畫沒有播放，導覽停在透明度 0。新版開場改為獨占按鈕。此問題在本輪之前的正式站就存在。

另：`bracketTree.test.ts` 與 `chapterTitles.test.ts` 共 10 項失敗，未處理。以最後一次 commit 為基準，這是目前未提交的改動造成的：`lunjianMarkup.ts` 的 `#schedule` 少了 `data-chapter-title="賽程"`（章名從 7 個變 6 個），而 `bracketTree.test.ts` 新增的懸賞雙榜 5 項測試從未通過過。

## 2026-10-31 第六輪：燈籠亮度與賽程換回核准戰局

- **燈籠**：定稿遮罩只在三格燈紙中央露出很小的亮光，夜間未點亮的燈紙本來就接近白色，滑過時幾乎看不出變化。改為露出整片燈紙，並在燈籠周圍加一圈暖光（screen 混色）。
- **賽程章**：使用者指出賽程是舊畫面。賽程章改回掛載核准的 A/B 戰局（`battle-view.js`），原本的完整對戰表收在下方「完整對戰表」供管理員排籤位。頁面層樣式只套用在賽程章（`battle-live.css` 的 `@SCHED` 以 `#schedule.chapter:has(#bracket-host.battle-live)` 限定），章節切換、水墨轉場與導覽不變。比武章維持原本的黑影對峙。
- 未公布時只顯示「對戰表尚未公布」，紅藍染紙鋪滿整章；上一章／下一章固定在最下方。
- **比武章**：使用者要求比武也換。比武章改回掛載核准的 C–H 戰局（`createBattleDuel`），原本的黑影對峙在戰局載入後隱藏。`@DUEL` 改以 `#duel.battle-art-ready.chapter` 限定，戰局沒掛上時不套任何樣式。返回賽程會回到同一張場次籤。
- **QA 審查後的修正**：
  - 舞台頁直接點燃進場時，新版開場會先清掉 `data-intro` 再交棒，舞台的進場編排因此被跳過。現在交棒之後才清。
  - 選手詳情開著時若遇到即時更新，名牌會被重建；關閉後焦點改為先回到戰局裡的同一個名牌。
  - 管理員切到編輯時，「完整對戰表」會立刻展開。
  - 換頁時若指標仍停在導覽上，燈籠保持亮著。
  - 生成器輸出 `homeMarkup.ts`／`home.css` 時固定使用 LF；`timberNavigation.ts` 加進 `.prettierignore`。
  - 正式站檢查改成掃描整個賽程內容，確認沒有洩漏參賽者名稱。
- `scheduleDuel.test.ts` 新增 3 項，直接跑真正的 `battle-view.js`，分別測選場進比武再返回、即時更新後的焦點、編輯展開。

## 2026-10-31 第七輪：戰局一屏放下

- **規則**：橫向螢幕（桌機與平板橫放）上，賽程與比武兩章不需要捲動。場景鋪滿整個畫面、紙張美術延伸到底邊；上一章／下一章匾額與中間的「重新整理賽程」「完整對戰表」或比武狀態列，疊在美術上排成同一列。內容高於剩餘空間時整塊等比縮小（`battle-view.js` 的 `fit`），對戰線依實際縮放重算。直向平板與手機則改成堆疊、可在章內捲動，但不能橫向捲動。
- **美術**：紅藍染紙疊在中軸黑紙上面，兩側各加寬到 46%，與黑紙之間不留縫；兩張都往上超出畫面，頂邊對齊。未公布時也有中軸黑紙。
- **未公布卡片**：改成規則說明油紙，外框套用章節匾額的木框，置中放大，標題與說明分兩行。
- **檢查**：`node scripts/verify-battle-fit.mjs [base] [out]` 會跑未公布、A/B/I/J、C–H 共 11 種狀態，涵蓋 1920×911、1440×900、1366×768、1280×720、1024×768、768×1024、390×844 七種尺寸，共 77 項；改這兩章後部署前要跑一次。

## 2026-10-31 第八輪：照參考圖的紙張頂邊與遠景擺動

- **更正第七輪**：紅黑藍不是整片鋪滿畫面。橫向螢幕照使用者給的參考圖：夜山遠景鋪滿上方（導覽與章名後面），紅、黑、藍三張紙都到底而且不動。
- **頂邊**：三張紙的頂邊是平滑的淺 V。紅從外側往中間微微下斜，中間的黑紙最低且平，藍往右上斜回去。紅藍素材本身的陡斜撕邊被裁掉（118%、底部對齊），斜線由遮罩畫出來。紅藍頂端約在畫面高度 23.5%，且至少在導覽下方 96px；黑紙再低 10%。沒有章名的多人戰局，紙從導覽下方就開始。
- **比例**：紅蓋到約 42%，藍從約 58% 開始，黑紙寬 26vw（320–520px）、露出約 20%，並壓在紅藍下面。
- **遠景擺動**：只有最後面的夜山會跟著滑鼠擺（`battle-view.js` 平滑更新 `--cam-x`／`--cam-y`），紙張、文字與按鈕都不動。只在橫向螢幕、滑鼠操作且沒開減少動態時啟用；滑鼠離開視窗會回到正中。
- **未公布卡片**：拿掉額外的白底，直接用章節匾額自己的紙（`border-image` 加 `fill`）。

## 2026-10-31 第九輪：共用頂邊、對話框與色碼

- **共用頂邊**：紅、黑、藍包進同一層 `.papers`，三張紙共用一個頂邊遮罩：從紅的外側斜下來接到黑紙頂邊，平過黑紙，再斜上到藍的外側。三張紙各自保留寬度，不必合成一張圖；合成一張圖反而會在不同螢幕比例下整體被拉歪。頂邊高度用 `svh`，因為遮罩的位置百分比是以「容器減圖片」計算，不能直接用 %。
- **選手資料對話框**：即時更新會重建整個戰局，原本開著的對話框會被移除，焦點掉回頁面。現在重建前記下開啟它的名牌，重建後從同一名牌重新開啟；名牌已不存在時，焦點回到戰局內第一個按鈕。`scheduleDuel.test.ts` 新增一項，共 17 項。
- **色碼**：`timber-navigation.css` 與 `battle-live.css` 寫死的色碼全部換成主題語意變數（`--surface-auth-canvas`、`--text-auth-ink`、`--text-on-scene`、`--accent-brand-on-paper`、`--accent-fire-core`、`--surface-scene-scrim` 等）。導覽的夜間配色改由主題的 darkExtras 提供，不再另寫一組。`scripts/check-tokens.mjs` 也會檢查這兩份來源樣式。
- **檢查腳本**：`verify-battle-production.mjs` 預設網址改成本機 `http://127.0.0.1:3042`，打正式站要明確傳網址。


## 2026-11-01 第十輪：比武標題與背景

- **比武標題**：比武章拿掉「戰局／C · 1v1 對決」，標題只寫「比武」；中間原本的「比武」字樣隨之移除，有實際輪次時仍顯示「決賽」這類輪次名。多人戰局中間的標題也從「戰局」改成「比武」。
- **背景**：比武章改用和賽程「未公布」相同的整張紙張圖 `pending-unified-ink-v2.webp`（這張圖與套用規則是 10-31 晚另一個工作階段加的）。賽程 A/B 仍是紅黑藍三張分開的紙，頂邊共用一條撕紙遮罩；遮罩的纖維取自紅藍素材本身的撕邊，由 `design/lunjian/lab/tools/paper-edge.py` 產生 `art/battle-paper-edge.webp`。

## 2026-11-01 第十一輪：比武回到原本場景、拿掉多餘文字

- **背景改回**：使用者看過整張紙版後覺得原本的比武畫面比較好，比武章改回紅黑藍三張紙（與賽程 A/B 同一條頂邊遮罩）；`pending-unified-ink-v2.webp` 只留給賽程「未公布」。
- **文字**：1v1 也只寫「比武」，不再出現「戰局／1v1 對決」；中間沒有實際輪次時不補「對決」。
- **狀態列**：比武章底下「對戰表還沒公布。」這類狀態句與上方細線不再顯示，場景中間已經有場次狀態；`#duel-status` 改成只給螢幕閱讀器（仍是 live region）。賠率、動作或封盤印章出現時，那一列照常顯示。

## 2026-11-01 第十二輪：比武回到剪影＋人物、章節牌縮小

- **比武改回剪影版**：使用者決定比武章回到雪地廣場、兩名剪影人物的原版。`lunjian-layout.html` 的 `DUEL_BATTLE_ART=false` 讓 `renderBattleDuel` 不掛 C–H 戰局；`battle-view.js` 的比武場景與 `battle-live.css` 的 `@DUEL` 規則保留不動，改回 `true` 即恢復。第十、十一輪的比武標題與狀態列調整只作用在 C–H 戰局上，現在不會出現。
- **驗證跟著改**：`verify-battle-fit.mjs` 預設只跑賽程（live、A、B、I、J，5 種狀態 × 7 種尺寸 = 35 項）；重新打開 C–H 時加 `CASES=…,C,D,E,F,G,H`。`verify-battle-production.mjs` 改成檢查比武顯示剪影廣場與兩名人物；`scheduleDuel.test.ts` 改成確認比武沒有掛 C–H 戰局。
- **重新整理賽程 hover**：比照章節牌，墨色轉紅、筆刷線畫在字下（不壓在撕紙邊上）、紙張微微浮起；減少動態時不位移。
- **章節牌（上一章／下一章）**：全站統一縮成 148×62（原本 200×80，賽程／比武放大到 260×96），標題 18px、方向 12px，上下留白相同，所以箭頭與文字落在牌子正中線。箭頭改成畫出來的筆劃（不再用字型的 ←→，字框偏移導致對不齊），緊貼文字、另一側留等寬空格讓文字仍在牌子正中；hover 時箭頭朝該章方向挪 4px、墨色轉紅、筆刷線在字下。賽程與比武底部保留給頁尾的高度由 128px 降為 88px，頁尾控制項跟著對齊新牌子的中線。

## 2026-11-01 第十三輪：備戰方案卡改成匾額油紙

- **卡片**：選手備戰方案（`#psheet .dz-sheet`）改用賽程公告同一張匾額紙（`/navigation-02/plaque.webp`，木框＋油紙），標題與內容置中，分隔線改成兩端淡出的細線。紙在日夜兩種模式都是亮色，所以卡內把 `--text-auth-*`、`--border-auth`、`--surface-auth-field` 改指向公告墨色 `--text-on-notice`，夜間不會變成淺字配淺紙。樣式在 `design/lunjian/lab/paper-theme.css`。
- **按鈕**：`.dz-bet`（返回比武、返回賽程、前往此場比武）改成紙張按鈕 `action-paper-v1.webp`，hover 與「重新整理賽程」相同：墨色轉紅、筆刷線在字下、微浮。為此把 `.psheet .dz-bet` 從 `web/src/app/color-mode.css` 的紅色動作按鈕清單拿掉，並在按鈕加 `data-ink-wave="off"`（全站墨染 hover 會把紙按鈕整塊染黑）。下注按鈕 `.duel-bet` 不變。
- **關閉鈕**：沿用全站筆刷叉（`ink-close.css`）；拿掉原本給它的實色紙底（在匾額紙上看起來是一個方塊）。

## 2026-11-01 QA 審查後修正（第十二、十三輪）

- `chapter-plaque.css` 合併成一份：舊的章節牌字級、箭頭與手機版規則已無作用，刪掉；hover、手機、減少動態各只剩一個 media 區塊。
- 減少動態時，章節牌箭頭與「重新整理賽程」hover／focus 都不位移（原本少了 :hover，蓋不過 hover 規則）。
- 章節牌底線縮到只在字下（左右各內縮 40px），離底邊 12px，不壓到牌框。
- `battle-model.js` 拿掉沒人用的 `duelHeading` 與 `TEAM_FORMATS`（內含「戰局」「對決」文案）；比武標題只剩 `battle-view.js` 的 `sceneTitle('比武')` 一個來源。
- 已知、未修：手機橫放（844×390、932×430）符合一屏版面的條件，但賽程放不下，要捲 36–157px；`verify-battle-fit.mjs` 預設尺寸沒有手機橫放，所以抓不到。看起來是既有問題，不是這幾輪造成的。
- 備戰方案卡第二次審查：卡內嵌入的配置元件讀的是 body 已算好的 `--text-primary`、`--text-secondary`、`--border-subtle`、`--surface-*`，夜間會變成淺字配淺紙；改在 `.psheet .dz-sheet` 重新宣告這些對應，表面改用不分日夜的 `--surface-notice`。關閉叉號捲到深色卡頭上時看不見，補回一圈淡出的紙色圓底。

## 2026-11-01 第十四輪：宗旨、規則說明、讓武、報名改成匾額油紙卡

- **範圍**：四章的主卡（`#prologue`、`#rules`、`#invitation` 的 `.manga-page`，`#register` 的 `.registration-stage`）改用備戰方案卡同一種木框油紙。獎賞（`.awards-stage`）與首頁 `.home-copy` 不動。樣式在 `design/lunjian/lab/paper-theme.css`。
- **為什麼拆成兩張圖**：這幾張卡很長（讓武約 6800px），直接拉伸 `plaque.webp` 會把木紋和紙紋拉成直條。所以由 `plaque.webp` 衍生出 `art/plaque-frame.webp`（木框，紙挖空、外緣補實，側邊木條以「原樣＋上下鏡像」排成可無縫重複的一段，`border-image` 縱向用 `round`）與 `art/plaque-paper.webp`（同一張紙裁出、2×2 鏡像成無縫紙紋、降低對比），紙從撕邊下透出來。產生腳本在 `design/lunjian/lab/tools/plaque-assets.py`，切片值 65／100 要和 CSS 的 border-image 一致。
- **夜間**：紙面蓋一層 88% 的 `--surface-auth-paper` 暗紗，內容沿用夜間配色；木框不變。備戰方案卡仍是日夜都亮紙。
- **拿掉**：`chapter-plaque.css` 裡「讓武沿用規則說明視窗、木框退役」那條覆寫（它把讓武鎖回舊的 1px 框油紙），以及它的手機 padding。

## 2026-11-01 第十五輪：手機版導覽列獨立設計

- **範圍**：寬度 ≤600px，或寬度 ≤1159px 且高度 ≤500px（手機橫放）。樣式在 `design/lunjian/lab/timber-navigation.css` 的同一個 media 區塊，取代原本 600px 的縮小規則。
- **版面**：不再是桌機木框縮小。改成貼齊畫面頂端、高 68px（加 safe-area）的導覽列（匾額沿用 `plaque-navigation.css` 的 `/navigation-02/plaque.webp`，夜間同樣壓暗）：左邊夜鴉閣木牌和烏鴉，中間是七章的橫向章節列（放不下就左右滑），一條細線隔開右邊的「目錄」鈕。柱子與燈籠只留給較寬的螢幕。抽屜不變。
- **目前章節**：用 `lunjian-layout.html` 的 `markNav` 標上的 `aria-current` 上色加底線；`markNav` 在章節列放不下時把目前這章捲到正中（`inline:'center'`，原本 `nearest`），前後章都露出來。章節列用左右 auto margin 置中，放得下時（手機橫放）七章整排置中，放不下時從頭排起（不能用 justify-content:center，會把前兩章推到捲不到的左側），左右各留 12px 不讓頭尾被淡出遮住。使用者原本看到只有目前一章「太空了」，所以改成整排（2026-11-01）。
- **高度**：手機 `--nav-h` 改成 `68px + safe-area`。`body.reading .chapter` 的 `scroll-margin-top` 從固定 120px 改成 `var(--nav-h) + 8px`；桌機算出來仍是 120px。
- **手機橫放**：導覽列變矮後，`SIZES=844x390,932x430 verify-battle-fit.mjs` 從 10 項失敗降到 6 項（超出 12–105px，原本 4–157px）；仍未完全放下，剩下的是重新整理鈕與章節牌落在畫面外。`battle-view.js` 的 `fit()` 讀不到 calc() 形式的 `--nav-h` 時改量導覽列實際下緣（原本退回 112px）。抽屜在這個範圍也顯示日夜切換鈕（列上放不下）。

## 2026-11-02 第十六輪：手機導覽列的牌子與匾額比例

- 夜鴉閣木牌改成整列高（124×68），貼齊左上角，和桌機一樣比匾額大一圈。
- 匾額（`.lj-nav__inner::before`）上下各內縮 8px、從 x=116 開始，牌子後面不再有匾額。章節列和「目錄」對齊牌子的中線（y=34）。
- 匾額周圍的縫隙鋪 `--surface-scene-glass`（日夜相同的夜色），捲動時頁面內容不會從縫隙透出來。這裡不能用 lunjian.css 的 `--ink`：/judge、/kitchen-sink 沒有定義它，/loadout 又把它改成文字色。
- 牌子貼在畫面邊緣，焦點框改畫在牌子內側（`outline-offset:-4px`）。手機橫放時重設 `grid-template-rows`，避免吃到 801–1280px 的 48px 列高。
- 手機橫放的賽程仍放不下（6/10 失敗），但每項少超出 44px。

## 2026-11-02 第十七輪：601–1159px 的章節列

- （放不下時左右滑的做法已由第十八輪取代。）原本這段寬度把章節整排收進目錄，匾額中間只剩右側按鈕，看起來是空的。改成和手機一樣的一排章節，放不下就左右滑，但保留桌機的鍵面樣式；放得下（約 1024 以上）時置中。
- 紙底改鋪在整條章節列上，置中留下的空位也是紙，不會露出暗縫；右側按鈕前加一條細分隔線。
- 800px 以下列上只留目錄鈕，會員專區與日夜切換在抽屜裡，章節列多出約 100px。
- `navigationArtwork.ts` 的 `mountChapterRow`（全站共用）：Tab 到只露出一半的章節時把它捲進來（瀏覽器預設不會）；滑鼠滾輪在章節列上改成左右捲，捲到底就交還給頁面。

## 2026-11-03 第十八輪：放得下幾章就顯示幾章

- 第十七輪的章節列放不下時會左右滑，邊緣的章節只露出一半、字被截斷。改成依序顯示放得下的完整章節，其餘收起來；「更多」抽屜本來就列出全部七章（目前這章有標示），所以收起來的章節從那裡進。
- `mountChapterRow` 在章節列寬度改變與字型載入後重算：先全部顯示，超出就從最後一章往前收（加 `data-nav-folded`，CSS 隱藏），至少留一章。只在章節列是 `overflow:hidden`（601–1159px）時收；手機的章節列仍左右滑，1160px 以上七格並排都不受影響。
- 實測可見章數：601→2、700→4、801→3（會員專區與日夜回到列上）、900→5、982→6、1024 以上→7。
