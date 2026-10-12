# Theatron UI／UX 修復驗收

最新狀態見文末「2026-09-21 距離縮放、中央 VS 與頁首整理」：本輪程式驗證待跑，CUA 啟動故障，實機視覺未驗證。下方既有測試數與尺寸通過紀錄屬各次歷史迭代。

日期：2026-09-20。對應 [原始審查](UI_UX_AUDIT.md)。本次保留七章錨點、武俠素材、定格導覽、旗面燃燒與既有功能路由；沒有新增動畫框架、後端 API 或資料庫修改。

## 八項問題與修復結果

| 問題 | 已完成修復 | 可重現驗證 |
| --- | --- | --- |
| 01 規則消失 | 移除計時淡出與逐步隱藏；三步永久顯示；手機垂直排列，超高正文獨立捲動 | `/?stage=2d&intro=0#rules` 停留 30 秒；切到報名再返回；更多 → 靜態閱讀；`labRuntime.test.ts` 用真實生成 runtime 推進 31 秒 |
| 02 報名 CTA | 既有生成 Tournament client → `activityDisplay` → runtime；所有 CTA 同一來源；無活動與失敗不假稱開放 | `activityDisplay.test.ts` 逐階段核對；`LunjianRuntime.test.tsx` 模擬生成回應、錯誤、重試與中止；頁面現在未設定活動 |
| 03 NAV | CSS／JS 統一 1024px；手機雙列、橫向章節列；備戰／活動入口／更多；aria-current、自動露出、hash 與歷史同步 | 七種寬度矩陣見下；鍵盤 Enter／方向鍵；瀏覽器上一頁／下一頁 |
| 04 開場 | 依最新要求更新為 KAGE 式載入、全畫面點燃與幕後雙俠；移除直接進入；鍵盤可點燃；2D 也等待點擊 | 追加驗證見 [OPENING_DESIGN.md](OPENING_DESIGN.md)；先前略過按鈕方案已被使用者的新要求取代 |
| 05 內容層級 | 首屏說明段位與 BP；無資料的對決／獎賞／賽程縮為摘要與下一步；fixtures 僅 `preview=1` | 一般頁面無虛構選手／賠率；`/?preview=1&phase=live` 持續顯示示範資料，切回報名前也不移除標示 |
| 06 文字與閱讀 | NAV 14px、正文 16px、輔助 ≥12px；配裝 h2 統一 16px；1120px 內容上限；手機 16px 留白；深色閱讀底與紙面對比 | 375px／1440px 實際截图及 computed style；手機規則可捲到底；裝飾置於正文後 |
| 07 視覺焦點 | 移除 2D 額外月亮、戰帖重複標籤；獎賞印章降為輔助；手機移除場景預留的大空白 | 2D／3D、桌機／手機實際畫面；七章空資料不再出現重複待公布格子 |
| 08 配裝起步 | 原生流派按鈕；焦點管理；操作順序；空倉庫收控制；空雷達提示；空配置停用複製／匯出；準備報名與活動代號；保留 v3／JSON／arts | 真瀏覽器 Enter／Space 開啟、Escape 還原焦點；runtime 測試刷新、JSON 匯出→匯入、分享文字與無代號不產生連結 |

## 瀏覽器尺寸矩陣

首頁使用 `#register` 檢查最右方章節；高度 900px。使用真實 in-app browser 的 viewport 與 DOM 幾何資料，沒有以原始碼存在取代畫面驗證。

| 寬度 | 導覽模式 | 當前章節完整露出 | 頁首 CTA 可達 | 整頁橫向溢出 |
| --- | --- | --- | --- | --- |
| 375 | 雙列 | 通過 | 通過 | 無 |
| 390 | 雙列 | 通過 | 通過 | 無 |
| 768 | 雙列 | 通過 | 通過 | 無 |
| 900 | 雙列 | 通過 | 通過 | 無 |
| 960 | 雙列 | 通過 | 通過 | 無 |
| 1024 | 桌機 | 通過 | 通過 | 無 |
| 1440 | 桌機 | 通過 | 通過 | 無 |

配裝亦檢查上述七種寬度，均保留起步入口且沒有整頁橫向溢出。另檢查 375×812 的 3D 山門／戰帖／賽制及其餘四章摘要、1440×900 的 2D／3D 首頁與配裝、390×844 的配裝鍵盤與準備報名。正文超高的章節保留內部垂直捲動；定格模式的文件本身不顯示捲軸。

## 自動化與生成

驗證結果：完整測試 59 個檔案、531 項通過；最後補上依賴重掛載防護後，再跑兩個 runtime 測試檔的 15 項回歸，全部通過。typecheck、lint、token 檢查與 production build 通過。375px 真瀏覽器賽制停留 109 秒後仍為 opacity 1，三步均為 display block。

在 `theatron/` 執行：

```powershell
python ../scrollcraft/builds/lunjian/lab/tools/to-theatron.py
python ../scrollcraft/builds/lunjian/lab/tools/loadout-to-theatron.py
pnpm test
pnpm typecheck
pnpm lint
pnpm lint:custom
pnpm build
```

生成前已比對目標素材目錄與來源的 SHA-256；沒有僅存在目標的差異，解析後的目的地均位於 `theatron/web/public/`。沒有直接修補生成物。

新增回歸：

- `web/src/app/labRuntime.test.ts`：實際執行生成 JS，以時間推進、DOM 操作、真實 catalog／codec 驗證閱讀、NAV、CTA、示範、fallback、reduced-motion、清理、配裝及 JSON。
- `web/src/app/LunjianRuntime.test.tsx`：生成 API 回應的整合、讀取中、未設定、失敗重試與離頁取消。
- `web/src/features/landing/activityDisplay.test.ts`：所有賽事階段的 CTA 文案／網址對應。
- 既有 `SignupForm.test.tsx` 保留 `?arts=` 預填驗證；既有首頁／配裝 axe 檢查繼續執行。

## 驗證邊界

- 未提供 Hestia、活動 slug 與測試帳號；真實活動讀取、登入、報名提交、裁判與投注端到端流程未驗證。API 各階段使用生成 schema 的測試資料；沒有捏造線上成功結果。
- reduced-motion 與 3D 資源失敗由 runtime 自動化驗證；一般 2D／3D 由真瀏覽器驗證。未宣稱跨所有 GPU／瀏覽器或整站 WCAG 認證。
- 配裝資料仍在此瀏覽器，JSON 才是可攜備份；帶入報名文字不等於提交。
- 本機服務保留於 http://127.0.0.1:3000/；沒有正式部署。

## 追加驗證：章序與讓武條件（2026-09-20）

- 新顺序：開門見山 → 規則說明 → 條件 → 報名 → 對決 → 賽程 → 獎賞；舊錨點保留。
- 以方向鍵逐章切換，核對章節、目前 NAV、2D 場景；以舊 #invitation 直接進入條件，點正文入口前往 #register。回歸測試同時驗證 3D 報名鏡位仍為 6。
- 瀏覽器：1440 × 900 條件正文、390 × 844 手機正文與報名交接、1024 × 768 導覽和操作區無重疊，無文件橫向溢出。
- 3 個測試檔共 24 項通過；typecheck、lint、token 檢查與 production build 通過。未重新做所有活動階段或真實提交驗收。

## 追加驗證：百業試鋒全文分頁（2026-09-20）

- 宗旨全文、五節規則與六類限制均存在於靜態 HTML；25 項測試含 axe、長文鍵盤捲動、BO3 固定配置條款及分類數量。
- 閱讀正文 30 秒、切走返回及靜態閱讀切換後仍可讀；桌機 1440 × 900 與手機 375 × 812 檢查無橫向溢出，PageDown 保持在規則章並移動正文。
- typecheck、lint、token 檢查及 production build 通過。真實報名提交、逐項讓武內容與費用不在此次驗證範圍。


## 追加驗證：漫畫素圖分層與暈墨換章（2026-09-20）

- 3 個測試檔、28 項通過：原文 details、五節規則、30 秒持續閱讀、BP 0／8／16／24、鍵盤、活動 CTA、配裝資料、axe，以及新加入的 timeline 清理與轉場連續操作。
- 新過場回歸：600ms 仍是舊章且已有墨點；覆蓋完成後才換章；揭露途中再點另一章，最後 NAV／hash／章節一致且移除 data-cut。
- 動畫清理回歸：閱讀模式與卸載會 pause timeline、anime.remove 並清空行內透明度；reduced-motion 保留完整展開內容。Observer disconnect 另經源碼核對，未宣稱跨所有瀏覽器效能測試。
- 真瀏覽器：3D 燃幕與桌機分層構圖、2D 手機規則，所有檢查中的素材成功載入。390 × 844 規則 PageDown 捲動 633px 且不換章，完整規則入口可展開五節。
- 規則／讓武頁於 375、390、768、900、960、1024、1440px 檢查文件與內容區無非預期橫向溢出、導覽存在、目前項目可見；宗旨另作桌機與手機視覺檢查。
- 生成素材 12 張，透明人物、松枝、長劍 WebP alpha 已檢查；場景、人物、前景、HTML 對白分開掛載。使用者 YouTube 參考只觀看，沒有下載挪用。
- pnpm typecheck、pnpm lint、pnpm lint:custom（298 檔）、pnpm build 與 git diff --check 通過。首次 token 檢查指出 SVG 一次性顏色，已改成既有 surface-paper／text-on-paper 並重跑通過。
- 設計與完整生成提示詞：[MANGA_DESIGN.md](MANGA_DESIGN.md)。使用既有 Anime.js 3.2.2；不新增框架，不改後端契約，不部署。Hestia 真實提交仍未驗證。


## 本輪：自查修正與 A／B／C 過場（2026-09-20）

- 37 項測試通過（stageIntro、labRuntime、page、inkTransitions）：三種濕邊不同、換頁點 alpha 全為 255、兩端清空、資源釋放、無 Canvas 備援；墨幕下準備下一章且揭露後不重播；慢圖解碼等待；七章 keyboard／NAV／hash 與後四章正文保留。
- typecheck、lint、lint:custom（299 檔）、production build 通過。git diff --check 無錯誤，僅既有 CRLF 提示。
- 首頁、motion-study.html、ink-transitions.js、兩張新透明素材均回應 HTTP 200；本機服務保留在 3000，未部署。
- 第一頁宗旨 markup 的 SHA-256 前後一致：7e6add02d1c619826bb07c98faef8536b13896c1a122e3859906a2d91774cfa1。第一頁專屬構圖 CSS 未改。
- 以實際 renderer 輸出六階段色版進行算法圖像檢視，見 previews/ink-variants.png；不是瀏覽器截圖，不能證明整頁構圖或實機幀率。
- **未完成：本輪逐章真瀏覽器視覺驗收。** CUA 多次出現 trusted Node process exited / helper_sandbox_lock_failed，沒有更動權限或繞過工具。375、390、768、900、960、1024、1440px 的新構圖、2D／3D 實際運鏡及動畫觀感均須補驗；上一段歷史通過紀錄不能代替。
- 使用者已選定 B 游墨 + A 中央揭幕；新 B 融合版已套用。另增加四個時間點驗證 B 與 A 的揭幕 alpha 完全一致、覆蓋輪廓仍不同。Hestia 真實報名提交仍未驗證。


## 最新驗證：逐格串行、三章 3D 混合與正式讓武（2026-09-20）

- 六個測試檔共 60 項通過：comicSequence、labRuntime、stageIntro、inkTransitions、page、handicapContent。修正新增測試的嚴格型別後，重跑受影響兩檔 14 項再次通過。
- 逐格動畫包含真實 vendor Anime.js 的 complete 邊界（duration−1 與 duration），以及 Observer 跨批／逆序／重複、快捲略過、焦點優先、閱讀切換、切章與卸載後舊回呼失效、揭幕首格限制。
- 原鏡位 6／3／4 的直接進章、4 秒入鏡衰減、指標倍率 0.35、章切清除偏移、原首頁幅度、閱讀與 abort 均有回歸。修正初始化 curtain render 將 camera path 重設為山門的問題。這些是執行期邏輯檢查，不代表實際 GPU 視覺或幀率驗收。
- 正式讓武六類 36 項、每項 BP、退款／可重複／自身生效／移動例外／特殊勝利／裁判／可拒絕條款均已核對。分類點擊、直接 hash、history 返回同步、焦點及靜態閱讀六類全展開通過。
- pnpm typecheck、pnpm lint、pnpm lint:custom（301 檔）與 pnpm build 均通過。初次 typecheck／build 發現測試陣列索引型別過寬，已修正並重跑通過。
- 首頁生成器執行前確認 art／type／vendor 目的地在 web/public 內，逐檔 SHA-256 與 lab 一致。只改正本後生成，同步 stage3d 與首頁內容；未修改凍結 camera.js。
- 宗旨 markup SHA-256 仍為 7e6add02d1c619826bb07c98faef8536b13896c1a122e3859906a2d91774cfa1。
- 首頁、lunjian.js、stage3d.js 及 motion-study.html 回應 HTTP 200；本機 3000 保持提供預覽。
- **未驗證：本轮新布局與 3D 的真瀏覽器畫面。** 再次嘗試 CUA 仍回報 trusted Node process exited unexpectedly，無法檢視 375／390／768／900／960／1024／1440px 或實際轉場觀感；不能用以上測試及 HTTP 健康檢查取代。工具恢復後需補逐章桌機／手機視覺驗收。
- Hestia 真實活動與報名提交仍未驗證；此次沒有部署、沒有新增後端契約，也不將讓武閱讀目錄當作已提交的配置。


## 最新驗證：左至右分格、對決三態、三席角色與墨景融合（2026-09-20）

- 八個檔案 78 項測試全部通過：comicSequence、duelPreview、labRuntime、stageIntro、inkTransitions、page、handicapContent、LunjianRuntime。新測試型別／lint 問題已修正後重跑。
- 1440／768px 畫格交替 −44／+44／−44px、375px 為 −24／+24／−24px，淡入 900ms；完整 timeline 1500ms，仍一格 complete 後才啟下一格。三席各自的 420ms 蓋印於該格 900ms 處播放，沒有提前全組落印。閱讀／卸載清除 transform。
- 報名與對決共用 shot 3，依不同章節 ID 重啟 .16／.20 入鏡；獎賞保留 shot 4／.18。章序、錨點和正式規則四強仍保留。
- 對決一般未公布狀態有原雙黑影和單一 VS、沒有假比分。使用者選擇演出預覽才顯示 0:0／1:1／2:1，持續標記示範資料；賽後切換新勝敗圖，返回恢復原圖／正式狀態／焦點。預覽不改 SIGNUP 或 IN_PROGRESS 的正式 CTA、全域階段、localStorage；卸載後按鈕失效。
- 版本更新回歸：舊主程式與舞台掛載移除，載入同 revision 的主 JS 與 stage3d，共享墨字依賴保留一次。CSS 使用相同生成 revision，避免預覽新舊混用。
- pnpm typecheck、pnpm lint、pnpm lint:custom（302 檔）、pnpm build、git diff --check 全數通過。未修改後端／契約或正式部署。
- 六張新角色已用內建 image_gen 生成並目視確認：勝者扶劍、敗者伏地、墨袍冠軍、白袍亞軍、短袍槍客、持卷裁判。PNG／WebP 有 alpha；格式轉換未繪製新內容。全部素材 HTTP 200；生成標記中的 29 個素材路徑均存在。
- 新紙色主題已經來源碼疊層審查：規則／讓武取消 dark scrim、vignette、scene-shade 及手機 ::before 漸層；不影響 data-intro。已修正舊手機 hybrid selector 將新擂台高度壓成 210px 的優先度問題。
- **實機未驗證**：CUA 再次啟動仍回報 trusted Node process exited unexpectedly。上述是程式、資產、HTTP 與源碼驗證；新分格、共享淡墨底景、六張角色在 375／390／768／900／960／1024／1440px 的實際觀感、裁切及 GPU 幀率仍需補驗，不能以舊輪截圖或本輪單元測試代替。使用者提供的截圖用作問題定位，不是改完後的驗收圖。
- 本機服務保留在 127.0.0.1:3000；真實 Hestia 活動與報名提交仍未驗證。


## 2026-09-21 比武還原、角色互動與逐筆題字

本輪依 `lab/shots/_th-3d-duel.png` 恢復全舞台擂台構圖，原版截圖僅作參考；沒有把它當作目前畫面的驗收證據。比武保留 `#duel`，三種階段按鈕與四種結果均為明標的局部演出。

已完成的自動化與檔案檢查：

- 七個既有回歸檔案 72 項通過：comicSequence、labRuntime、stageIntro、inkTransitions、page、handicapContent、LunjianRuntime。
- 三個定向檔案 33 項通過：duelPreview 11、duelInteraction 10、chapterTitles 12；合計 105 項。另追加的閱讀模式回歸結果見下方最新紀錄。
- 比武前／中／後、四種勝敗圖片／比分、切回原圖、示範標示、活動 CTA 與 localStorage 隔離、卸載後停止互動均有回歸。
- 未公布選手只顯示待評定／待公開；獨立詳情面板、黑影與資料卡 Enter／Space、Tab 圈限、Escape 還原焦點、方向鍵不穿透、滑鼠左右／中央／離開與觸控忽略均通過。
- 七章的真正逐筆 SVG 使用正式 glyph 資料，筆畫數依序 14／42／32／18／12／29／30，獨立遮罩與遞增時間；同章不重播、靜態／reduced-motion、切章及卸載還原均通過。
- typecheck、lint、lint:custom（304 檔）、production build 與 git diff --check 通過。29 個標記圖檔路徑皆存在；首頁、新題字模組、glyphs 與四張追加人物 WebP 均 HTTP 200。模組、glyphs 與 stage3d 正本／生成檔位元組一致。

可重現入口：[比武](http://127.0.0.1:3000/?stage=3d#duel)。依序按「比賽前」「比賽中」「完成比賽」，完成後切換輾壓勝利／慘輸／險勝／平手；點雙側人物或腳下資料開備戰方案，使用關閉／Escape 返回。「返回賽事資訊」恢復未公布或目前活動展示狀態。逐筆題字可由七章導覽逐一進入，靜態閱讀直接顯示完整文字。

限制：CUA `rewriteDocumentation()` 與 `getState()` 均回報 `trusted Node process exited unexpectedly`，本輪無法完成 375／390／768／900／960／1024／1440px 與 2D／3D 的實際動畫、對比及構圖目視驗收。已目視新增人物靜態素材與歷史對決參考，但程式檢查不代表實際頁面視覺通過。Hestia 環境仍未提供，真實選手／配裝／報名提交沒有端到端驗證；沒有正式部署。

最新補驗：duelInteraction 增加閱讀模式案例後為 11 項，與 labRuntime 22 項再次執行共 33 項全通過。確認閱讀模式保留角色聚焦、開啟詳情與焦點還原，但 --lean 維持 0，滑鼠不帶動放大。完整本輪去重後為 10 個檔案、106 項回歸通過。


## 2026-09-21 距離縮放、中央 VS 與頁首整理

**目前狀態：本輪 11 個檔案、117 項回歸通過；實機視覺未驗證。** 本節以重新執行的結果為準，不沿用上輪 106 項回歸的通過結論。此次只改首頁呈現，保留選手詳情、七章逐筆題字與四種賽後姿態。

| 項目 | 本輪要求與可重現檢查 | 狀態 |
| --- | --- | --- |
| 人物距離互動 | fine pointer 從人物 hitbox 外沿 X／Y 靠近，縮放連續加強；離開時平滑回復，腳底不漂移，資料文字不縮放 | 回歸／來源碼檢查通過；實機待驗 |
| 取消裝飾 | 人物不增亮／反光，沒有背框及 VS 地面光圈；鍵盤焦點標示與原生按鈕操作保留 | 回歸／來源碼檢查通過；實機待驗 |
| VS 位置 | 定格模式標記中心為 viewport 50svh，1173×912 時 y=456px；比分在下，切四種結果與未公布狀態不受腳下資料高度推動；閱讀模式不重疊正文 | 回歸／來源碼檢查通過；實機待驗 |
| 移除節點 | status-bar、scene-note、duel-summary 不再呈現或由 runtime 重建；初始化、直接 hash、切章、重掛載不因空節點中斷 | 回歸通過 |
| 重構頁首 | ≥1024px 品牌／七章／操作三區；<1024px 雙列且目前章節可見；備戰、活動 CTA、更多皆可達 | 回歸通過；實際尺寸待驗 |
| 更多選單 | 靜態閱讀入口與僅限 preview=1 的全站階段切換皆在更多；選單項不重疊，示範標示持續，真實活動 CTA 不被演出改寫 | 回歸／來源碼檢查通過；實機待驗 |
| 既有功能 | 選手詳情 Tab 圈限／Escape／焦點還原、七章逐筆、before／live／after 與 dominant／crushed／narrow／draw、離章保留及返回正式資訊繼續有效 | 回歸通過 |
| 靜態與清理 | 觸控不觸發距離縮放，reduced-motion／閱讀停止縮放；離章、游標離開、開啟詳情與卸載不殘留互動目標或監聽 | 回歸通過 |

本輪實際執行：

- `pnpm test web/src/app/labRuntime.test.ts web/src/app/duelInteraction.test.ts web/src/app/duelPreview.test.ts web/src/app/comicSequence.test.ts web/src/app/stageIntro.test.ts web/src/app/inkTransitions.test.ts web/src/app/page.test.tsx web/src/app/handicapContent.test.ts web/src/app/LunjianRuntime.test.tsx web/src/app/chapterTitles.test.ts web/src/features/landing/activityDisplay.test.ts`：11 檔、117 項通過。
- `pnpm typecheck`、`pnpm lint`、`pnpm lint:custom`（304 檔）、`pnpm build`：通過。
- 距離回歸以未縮放人物 geometry 驗證：hitbox 外已有反應、同 X 改 Y 越近越大、另一側獨立、touch／離開／卸載清零。鍵盤聚焦與關閉詳情後焦點還原不產生縮放。更多選單 Escape 回 summary、示範階段切換、靜態閱讀皆通過。
- `50svh` 置中與移除光效經 CSS 來源碼檢查；VS 位於 arena，比分不是 mark 的尺寸來源。這是結構／樣式證據，不是瀏覽器像素量測。
- 首頁生成器已同步正本；執行前驗證 art/type/vendor 目的地在 public 且沒有獨有修改。本機首頁回應 HTTP 200。

本輪 CUA 仍回報 Windows sandbox kernel 啟動故障（Failed 5），沒有成功取得修正後的瀏覽器畫面。待工具恢復後，補驗 375／390／768／900／960／1024／1173／1440px、2D／3D、閱讀模式、手機觸控與 reduced-motion；1173×912 使用者截圖只作問題定位。不可據原始碼推算、單元測試、HTTP 200 或歷史截圖宣稱視覺通過。

預覽入口：[比武](http://127.0.0.1:3000/?stage=3d#duel)、[全站示範](http://127.0.0.1:3000/?preview=1&stage=3d#duel)。Hestia 真實選手／配裝／報名提交仍未完成端到端驗證，沒有正式部署。


## 2026-09-21 左右賽程樹、指定場次與投注交接

**程式與生成驗證完成；實機視覺、Hestia 端到端仍未驗證。** 本輪既有未提交修改保留，沒有部署或發起正式投注。

| 範圍 | 實作與證據 |
| --- | --- |
| 左右樹狀圖 | 4／8／16／24 人籤位測試，兩側逐輪向中央會合、SVG 連線、季軍戰另列；長選手名不截斷，籤號 0 不顯示；手機分輪鍵盤切換 |
| 正式晉級線 | 只使用明確連線或相鄰輪次可唯一確認的勝者席位；不猜未定連線，顯示部分關係待公布；輪空與不戰而勝分開 |
| 選場與返回 | 點原生場次按鈕後在現有 #duel 帶入同場雙方／比分／勝者，query match、直接連結與 popstate 同步；墨幕後聚焦左方人物，返回還原場次，場次消失則回閱讀區 |
| 選手與投注 | 正式姓名及公開段位進入詳情，沒有裝備就顯示尚未提供；正式連結帶 slug／match／player 到原比賽頁，安全映射勝負盤 p1／p2 並高亮，選擇不自動投票／下注 |
| 示範注單 | 人物詳情／舞台入口帶入同一方；本金 1–10000 整數、bigint 計算、複核／返回修改／本地收據；不呼叫 fetch、不寫 Storage、不扣代幣。缺少另一位選手及結束的示範場次不提供下注 |
| 輪詢與清理 | API 更新與重試、異步中止、runtime 重掛載、資料更新保留賽程焦點與捲動；離頁清理 module、Observer、監聽、dialog 與 timer |
| 透明 VS | 新 vs-arena-ink.webp 1254×1254，63.29% 全透明；固定 50svh 中線，不換背景；慢速呼吸，閱讀／reduced-motion 靜止。素材已檢視，實際場景視覺待驗 |
| 松枝移除 | 生成標記的 .frame-stage 不含 pine-layer，仍包含 novice-breakout、frame-speech 與 manga-courtyard-layer.webp；只移除指定第三格前景 |

本輪執行結果：

- 下列命令 18 個檔案、182 項全部通過。先前發現的 MatchPage 非同步 effect 斷言已改成等待完成，再次整組執行通過。
- 最後補上場次消失後的焦點後，scheduleDuel／arenaTicket／bracketTree 三檔 34 項再次通過；測試檔 ESLint 亦通過。
- `pnpm typecheck`、`pnpm lint`、`pnpm lint:custom`（310 檔）通過；最後生成後 `pnpm build` 再次通過。`git diff --check` 通過。
- 生成前驗證 art/type/vendor 每個目的地在 web/public 且現存檔等同 lab 來源。bracket-tree／arena-ticket／chapter-titles／stage3d 位元組一致，動態 import 帶正確模組 hash。
- 本機服務原已停止，本輪以文件命令重啟，保持運行；`/`、示範首頁、新 bracket-tree.js／arena-ticket.js／VS WebP 全部 HTTP 200。HTTP 只代表可讀取，不代表視覺通過。

```powershell
pnpm test web/src/app/labRuntime.test.ts web/src/app/duelInteraction.test.ts web/src/app/duelPreview.test.ts web/src/app/comicSequence.test.ts web/src/app/stageIntro.test.ts web/src/app/inkTransitions.test.ts web/src/app/page.test.tsx web/src/app/handicapContent.test.ts web/src/app/LunjianRuntime.test.tsx web/src/app/chapterTitles.test.ts web/src/features/landing/activityDisplay.test.ts web/src/features/landing/tournamentDisplay.test.ts web/src/app/bracketTree.test.ts web/src/app/scheduleDuel.test.ts web/src/app/arenaTicket.test.ts web/src/features/bracket/MatchPage.test.tsx web/src/features/betting/MarketBoard.test.tsx web/src/app/t/[slug]/m/[matchId]/page.test.tsx
```

重現：[示範賽程](http://127.0.0.1:3000/?preview=1&phase=live&stage=3d#schedule) → 選任一場次 → 比武黑影 → 備戰方案／模擬下注。已結束場次顯示勝敗；未定對手沒有示範下注入口。從左下「返回賽程」回原場次。一般模式使用設定的活動；沒有活動時只顯示待公布與明確示範入口。

本輪 CUA 的 rewriteDocumentation/getState 均仍回報 `trusted Node process exited unexpectedly; kernel reset`，沒有成功取得新的瀏覽器畫面。待恢復後需補驗七種寬度、長名稱、樹圖捲動、3D 背景下透明 VS、手機投注 sheet、閱讀與 reduced-motion。Hestia 未提供，正式公開賽程、裝備、下注提交／結算不能宣稱已端到端通過。


## 2026-09-21 追加：武俠雙名帖賽程

依使用者季後賽卡片參考，套用左右名帖、中央問鼎印記、獨立比分欄與左墨右紙。維持正式資料／示範分隔、場次按鈕、選手詳情及下注路由。設計與正本見 BRACKET_CARD_DESIGN.md。

- `pnpm test web/src/app/bracketTree.test.ts web/src/app/scheduleDuel.test.ts web/src/app/labRuntime.test.ts web/src/app/page.test.tsx`：4 檔、57 項通過。
- 新增 4／8／16 人長內容高度的幾何回歸：問鼎印記保持在決賽上方、季軍戰保持在下方，皆在畫布範圍內；字印 aria-hidden，姓名完整保留。
- `pnpm typecheck`、`pnpm lint`、`pnpm lint:custom`（310 檔）、`pnpm build` 通過。
- lab 已生成同步，前置安全檢查確認素材目的地及來源相同。首頁／合併 CSS／bracket-tree.js 皆 HTTP 200，服務持續運行。
- 本輪 CUA getState 仍回報 `trusted Node process exited unexpectedly; kernel reset`，所以桌機／手機實際構圖、字印字體與線條對比尚未目視驗證。上述幾何及來源碼回歸不能替代實機驗收；沒有執行正式投注。

預覽：[武俠名帖賽程](http://127.0.0.1:3000/?preview=1&phase=live&stage=3d#schedule)。


## 2026-09-21 追加：生成卡面與中央冠軍卡

已使用內建 image_gen 生成黑墨／白紙兩張無字卡面，目視檢查中央留白與邊角墨紋後保存 PNG 原稿及 WebP 網頁格式。實際輸出 2172×724，未裁切或重繪；提示詞和雜湊在 lab/BRACKET_CARD_PROMPTS.md。圖片只作卡片材質，姓名、段位、比分保持 HTML。

中央改為可點擊冠軍卡，既有透明頒獎角色僅作象徵插畫。決賽尚未 done、winner 不屬於雙方或無玩家資料都顯示「冠軍待定」；完成且可確認才顯示姓名。手機只在決賽輪出現，API 更新保持卡片焦點，點擊沿原路進入決賽。

- 最新同組四檔（bracketTree／scheduleDuel／labRuntime／page）共 59 項通過：包括冠軍更新／資料邊界／焦點／點擊回傳決賽，以及手機冠軍所在輪次。
- typecheck、lint、token（310 檔）、production build 皆通過。
- 生成資產與正本相同，卡片 CSS URL 和 championArt URL 皆正確前綴；完成階段首頁、新兩張 WebP、既有冠軍圖皆 HTTP 200。
- CUA 仍未能啟動，沒有完成實機構圖／手機視覺验收；素材已目視不等於網頁視覺通過。沒有提交真實注單或部署。

[冠軍賽程示範](http://127.0.0.1:3000/?preview=1&phase=finished&stage=3d#schedule)；[比賽中示範](http://127.0.0.1:3000/?preview=1&phase=live&stage=3d#schedule) 可核對冠軍待定。


## 2026-09-21 獨立席位、中央決賽與裁判共用樹

已完成：一席一卡、比分匯合點與單獨晉級線、中央決賽雙席／冠軍、季軍戰獨立；左右統一紙面，勝敗保留姓名比分；名帖看選手，比分進比武。裁判 MatchList 使用同一 lab 生成控制器，場次導入既有裁判台與逐回合確認，不直接改整場勝者。

執行（theatron/）：

```powershell
pnpm test web/src/app/bracketTree.test.ts web/src/app/scheduleDuel.test.ts web/src/features/bracket/WuxiaBracket.test.tsx web/src/features/admin/MatchConsole.test.tsx web/src/app/labRuntime.test.ts web/src/app/page.test.tsx
pnpm typecheck
pnpm lint
pnpm lint:custom
pnpm build
```

結果：6 檔、76 項通過；typecheck／lint／token（314 檔）／production build 全部通過。包含 4／8／16／24 人、長姓名幾何、待定／勝敗／冠軍、顯式缺席位與衝突來源不連線、選手與比分各自操作、面板輪詢後焦點還原、手機分輪／斷點／鍵盤、StrictMode 卸載、裁判路由編碼、BO3 選人後確認與晉級回應。

先確認生成器替換目的地都在 web/public 下，既有 art／type／vendor 每檔與 lab SHA 相同，再執行生成器。新增生成 React bracketTreeRuntime.js 與隔離 bracket-tree.css；程式及文件依最新版設計更新，保留其他既有修改。

未驗證：CUA 初始化仍報 trusted Node process exited unexpectedly，實際 375／390／768／900／960／1024／1440px 與 3D 畫面尚未驗收。幾何／DOM 測試不能代替實機。未提供 Hestia，真實裁判權限、提交、晉級與派彩端到端未驗證；正式未知晉級關係不猜線，待 API 公開。沒有正式部署。


## 2026-09-21 中央冠軍、黑白效果與示範管理

完成：冠軍水平置於決賽雙卡之間、黑白方互換、亮黃晉級線流動、大斜勝章落印、敗者紅墨轉暗。結果變化／手動重播才進場，普通輪詢不重播，reduced-motion／靜態閱讀無動畫。

新增本機示範管理：編輯模式下選場、交換首輪玩家、設定比分／狀態／贏家；修正晉級及季軍來源、清除失效下游結果。分 phase 的 localStorage 操作紀錄可刷新還原、復原、雙按還原示範；失敗提示，不提交後端。正式裁判台的逐回合確認仍保留。

```powershell
pnpm test web/src/app/bracketEditor.test.ts web/src/app/bracketTree.test.ts web/src/app/scheduleDuel.test.ts web/src/features/bracket/WuxiaBracket.test.tsx web/src/app/labRuntime.test.ts web/src/app/page.test.tsx web/src/features/admin/MatchConsole.test.tsx
pnpm typecheck
pnpm lint
pnpm lint:custom
pnpm build
```

結果：7 檔、86 項測試通過；typecheck、lint、token（315 檔）及 production build 通過。回歸涵蓋冠軍位於雙席中線、黑白方／動畫重播旗標、未確認資料不造線、正式不可編輯、BO3 不合法比分、首輪交换、后轮失效／保留、輪空、存取錯誤、分階段還原、編輯到冠軍及比武同步、關閉／卸載。

生成前檢查 art/type/vendor 目的地都在 web/public，下游既有檔案逐檔 SHA 與正本一致，才執行 to-theatron.py。本輪新增 bracket-editor.js/css 正本與生成同步，沒有改 loadout 儲存或提交正式投注。

未驗證：CUA 再次初始化仍報 trusted Node process exited unexpectedly，沒有完成桌機／手機實機視覺驗收。Hestia 尚未配置，真實裁判提交、晉級、派彩端到端未驗；任意修改已結算比分／贏家沒有現成後端 API，不屬於已實作的正式改判。使用者可在 preview=1 的示範管理中操作所有已提供本機功能。


### 2026-09-21 灰紙敗者與加粗勝者路徑

- 正本 bracket-tree.js/css 已生成同步；保留黑白方標籤、灰紙敗者與暗紅敗印，勝者線 4px／高亮 5px。React 裁判卡移除舊暗色落敗覆蓋。
- bracketTree、scheduleDuel、WuxiaBracket、labRuntime：4 檔、61 測試通過。
- typecheck、lint、lint:custom（315 檔）、production build 通過；git diff --check 無空白錯誤。
- 本機預覽 HTTP 200，已確認服務送出的 bracket-tree.css 包含 4px 晉級線與敗印樣式。
- CUA 初始化因 Windows sandbox SetNamedSecurityInfoW / error 5 失敗，本次未完成實際瀏覽器視覺與動畫驗收；不能把 HTTP 或 DOM 測試視為視覺驗收。未測正式 Hestia 裁判提交。


### 2026-09-21 RWD 與決賽水平連線

- 4 檔、73 個測試通過：bracketTree、scheduleDuel、WuxiaBracket、labRuntime。新增容器 375／390／768／900／960／1024／1100／1173／1440px 的布局決策與圖寬上限測試（DOM 模擬，非瀏覽器截圖驗收）、縮放輪次／焦點保留、左右方奪冠均水平接中央卡緣。
- typecheck、lint、lint:custom（315 檔）、production build 通過；diff --check 通過。本機 HTTP 200，服務送出最新版直線及容器計算 runtime。
- CUA 本輪再次因 Windows sandbox SetNamedSecurityInfoW error 5 無法啟動，實際 RWD 截圖、3D 畫面融合與動畫仍未實機驗收。保留現有本機服務。


### 2026-09-21 紅藍卡面與相容性

- bracketTree、bracketEditor、scheduleDuel、labRuntime：80 測試通過；WuxiaBracket 的查詢同步讀屏方別名稱後，單獨重跑 2 測試通過（共 82）。驗證舊 white-left 偏好與既存比分還原、敗者仍保留所在方色、沒有可見方別標籤，裁判場次跳轉／焦點不變。
- typecheck、lint、lint:custom（315 檔）、production build 與 diff --check 通過；本機 HTTP 200，服務已送出紅藍樣式及編輯器文案。
- CUA 仍因 Windows sandbox SetNamedSecurityInfoW error 5 無法初始化；本輪視覺、動畫與實際色彩對比未於瀏覽器驗收。不宣稱正式 Hestia 賽果寫入已測。


### 2026-09-21 示範人數／編輯視窗／冠軍動畫

- bracketEditor、bracketTree、scheduleDuel、WuxiaBracket、labRuntime 共 5 檔、101 測試通過。新增 2/3/7/8/9/15/16/17/31/32/33/63/64 人樹、唯一選手／冠軍、首輪輪空 0:0、後轮未知席位、進度切換、各人數獨立保存與刷新恢復；快捷獲勝按鈕、64 人全樹／分輪、手機強制分輪；冠軍確認／改判／重播與輪詢不重播。
- typecheck、lint、lint:custom（315 檔）、production build、diff --check 通過。本機 HTTP 200，服務已送出資料室及簡化視窗。
- 瀏覽器 CUA 初始化再次失敗，尚無實機視覺、動畫與觸控驗收。Superdesign 遠端 create-design-draft 帶入專案原始碼的動作遭 auto-review 拒絕，原因是未核准外傳；未重試或繞過。已完成本機實作，未宣稱有遠端草稿成果。


### 2026-09-21 姓名區與單一垂直捲動

bracketTree、WuxiaBracket、labRuntime、scheduleDuel 共 4 檔 75 測試通過；舊段位／籤號／文字敗者斷言改為姓名區無副列、既有敗印與資料狀態。typecheck、lint、token 檢查（315 檔）、production build、diff --check 通過。本機 HTTP 200，送出無高度限制與不攔截 y 軸的最新版 CSS。CUA 本輪初始化仍失敗，實際滑鼠／觸控捲動及畫面未完成瀏覽器驗收。


### 2026-09-21 敗者斬切動畫

4 檔 76 測試通過（bracketTree、scheduleDuel、WuxiaBracket、labRuntime）。新增敗者專用雙片卡面／刀痕方向、唯一姓名與點擊目標、輪詢不重播、手動重播及改判移除檢查。typecheck、lint、token 檢查（315 檔）、production build、diff --check 通過；本機 HTTP 200 並送出 tt-blade-cut 樣式。CUA 初始化仍因 Windows sandbox error 5 失敗，刀光速度、撕裂視覺與減少動態實機呈現尚未於瀏覽器驗收。


### 2026-09-21 檢視／編輯、報名者與拖曳換位

- 正本 bracket-editor.js/css 與 lunjian-layout.html 修改，已經生成器同步；賽程卡面美術未變。
- bracketEditor 32 項通過：同場／跨場換位、待排入替換、唯一選手與人數、輪空、後輪／正式資料拒絕、模式收合、手機點選替代、儲存／復原、拖曳來源限制與卸載清理。
- scheduleDuel 8 項通過：真正 renderer 的選手卡換位、重繪後拖曳屬性、復原與場次／選手入口，既有冠軍改判／比武交接保留。
- 同輪 bracketTree、WuxiaBracket、labRuntime 69 項通過；typecheck、lint、token 檢查通過。
- CUA getState 仍回傳 trusted Node process exited unexpectedly；未完成真實滑鼠拖曳及手機視覺操作驗收，DOM 測試不代替此項。
- 未接 Hestia 正式報名名單／正式換籤提交，不包含部署。

- Production build 通過，預覽 HTTP 200；本機服務維持運行。


### 2026-09-21 編輯 dialog 紅藍／暖金配色

- 來源 bracket-editor.css 已由生成器同步，無新增套件、動畫或業務規則。
- bracketEditor + labRuntime 55 項通過；typecheck 與 token 檢查通過。
- 以現有 token 和 sRGB color-mix 計算：紅側主要字／底 7.95:1，藍側 8.25:1，金色按鈕深字 7.67:1。
- CUA 再次因 Windows sandbox SetNamedSecurityInfoW error 5 失敗；實際桌機／手機視覺檢查仍未完成，對比計算不替代實機驗收。

- lint、production build、git diff --check 通過；預覽頁 HTTP 200。


## 2026-09-21 運彩完整本機試玩

### 已交付

- React `/sportsbook` 與首頁 dialog：註冊、登入、Discord 模擬／綁定、1,000 點一次性贈點、場次盤／名次盤、單注／串關、注單／帳本與獎品兌換。
- IndexedDB 原子扣點建單與庫存保留、冪等命令、PBKDF2 加鹽密碼、分頁通知、會員／賽事草稿隔離；通知失敗不誤報已提交交易失敗。
- 人氣／固定賠率、確認期間異動重報價、封盤、參賽者排除、秒數邊界、逐局草稿與結算摘要、未進行局退款、冠亞季殿與季軍戰、作廢串關重算。
- lab canonical 運彩入口、選手／場次交接、快照投影與舊編輯器隔離、焦點還原及卸載清理。原賽程美術保留；獎賞依快照賽果顯示。

### 命令與結果

| 檢查 | 結果 |
| --- | --- |
| `pnpm test` | 77 個檔案、769 項通過 |
| 最後 UI 調整後 `pnpm test web/src/features/sportsbook` | 4 個檔案、36 項通過 |
| 串關全作廢測試補強後 `pnpm test web/src/features/sportsbook/engine.test.ts` | 26 項通過 |
| `pnpm typecheck` | 通過 |
| `pnpm lint` | 通過 |
| `pnpm lint:custom` | 326 個檔案，零違規 |
| `pnpm build` | 通過，包含 `/sportsbook` 靜態路由 |
| `to-theatron.py` | 已生成，前置素材 SHA 核對通過 |
| HTTP `127.0.0.1:3000/sportsbook` | 200，含論劍運彩與本機試玩標示 |
| HTTP 首頁 | 200，含 `data-sports-center` 入口 |

### 尚未完成的實機驗收

CUA 本輪初始化仍失敗（trusted Node／Windows sandbox 執行環境），無法取得或操作實際頁面。沒有以其他瀏覽器自動化繞過，也沒有將 jsdom、HTTP 200 或 fake-indexeddb 當成實機驗收。

待驗：375／390／768／900／960／1024／1440px 版面、手機底部注單、原生 dialog 焦點圈限、3D 與運彩同屏、實際多分頁同步及背景節流。程式測試已涵蓋交易併發、DOM 交接、焦點還原與監聽清理；實際畫面與觸控仍需補驗。真實 Hestia、Discord OAuth、正式權限與獎品發放不在本版範圍。

操作重現步驟見 [SPORTSBOOK_DEMO.md](SPORTSBOOK_DEMO.md)。本機服務維持 127.0.0.1:3000，未部署正式環境。


## 2026-09-21 匿名入口與每場一票

- 新增頁首與登入 dialog 匿名入口，免填帳密。IndexedDB 序列交易確保同一來源瀏覽器只有一個匿名會員、首次 1,000 點一次。
- 改投在同一交易刪除本人同屆同場其他盤口的票，再寫新票；保留其他會員、其他場次與其他屆。名次按各名次一票；封盤拒絕改投。介面顯示「已投」與目前選擇。
- `pnpm test web/src/features/sportsbook`：4 檔案、39 項通過；typecheck、lint、token 檢查（326 檔）及 production build 通過。HTTP `/sportsbook` 200 且包含匿名試玩按鈕。
- CUA 重試仍回傳 trusted Node process exited unexpectedly，未完成實際瀏覽器點擊／視覺驗收；沒有以 HTTP 或 DOM 測試代替。


## 2026-09-21 台灣運彩串關機制改編

來源查核及差異：TW_PARLAY_RULES.md。最多 12 場、過關數複選、包牌組合、固定報價、拒絕變動／只接受較高報價、最低過關數、每組與整票限額、整票精確加總／四捨五入、無效腿 1 倍、部分組合中獎與退款均已實作。新票 tw-v1，舊注單派彩算法及正式 Hestia client 保持相容。

- `pnpm test web/src/features/sportsbook web/src/features/betting web/src/app/scheduleDuel.test.ts web/src/app/LunjianRuntime.test.tsx`：11 檔、105 項通過。
- 最後注單各組明細調整後，sportsbook 5 檔、54 項通過；typecheck、lint、token 檢查（328 檔）與 production build 通過。
- HTTP `/sportsbook` 200，包含串關規則來源及包牌介面；開發服務保留。
- CUA 再次回傳 trusted Node process exited unexpectedly；實際桌機／手機、鍵盤與 3D 同屏仍未完成瀏覽器驗收。

沒有聲稱取得官方定價公式或即時報價。所有報價、點數與獎品仍為本機模擬。舊人氣盤須按「本屆切換固定報價」或逐盤設定，已成立票不受影響；新盤自動採固定報價。

## 2026-09-21 注單即時總賠率
- 運彩 5 個測試檔、55 項測試通過；新增未填本金時跨場相乘、同場玩法替換、複選過關数與包牌分組顯示驗證。
- 即時報價使用既有精確整數算法；扣點、鎖價與結算規則未更動。
- CUA 本次仍因 Windows sandbox helper SetNamedSecurityInfoW error 5 無法啟動；桌機／手機實際畫面尚未完成驗收。

## 2026-09-21 各盤獨立投票及投注
- 運彩測試 5 檔 61 項通過。涵蓋同場多盤票數共存、同盤換票、UI 一次三盤獨立建單、不同勝負分別派彩、單盤作廢、重送去重、封盤／舊價全批回滾、單注限制、多分頁同時扣點。
- CUA 本次再次回報 trusted Node process exited unexpectedly，桌機與手機實機視覺驗收仍未完成。

- 本次 typecheck、lint、token 檢查、production build 通過；本機 /sportsbook HTTP 200。

### 2026-09-21：觀局雅集文案
頁首、入口、彈窗、管理區、來源連結標籤、metadata 已統一更新。首頁從 lab 正本生成；生成前比對素材一致。相關 7 檔 94 項測試通過；文字來源掃描無殘留「運彩」。

## 2026-09-21 注單 UX 流程
- 根因：桌機右側整份長注單使用 top:20px sticky 卻不限內容量，主要操作低於視窗；手機加入選項立即自動展開，遮住後續盤口。
- 修復：精簡摘要與本金留側欄，完整選項／設定按需開 dialog；只有可完整容納的桌機面板才固定。手機改為主動展開。原生 dialog 保留 Escape、焦點還原，確認扣點前列出每個選項。
- 運彩模組 5 檔 63 項通過；新增選盤不展開、dialog 關閉還原焦點、確認前列明細、尺寸改變取消／恢復固定與清理 Observer 的回歸。
- typecheck、lint、token 檢查通過。瀏覽器 CUA 本次仍回報 trusted Node process exited unexpectedly；375/390/768/900/1173/1440 實際捲動、觸控及版型未驗證，不以 JSDOM 的模擬尺寸宣稱實機完成。


## 2026-09-22 報名、角色、活動管理與投注交接

- 匿名入口移除，舊匿名 session 退出但不刪帳本。檢視／管理分開，管理活動表单與報名頁不顯示投注側欄。
- 會員報名：規則確認 → 遊戲 ID／姓名 → 四項角色配置 → 最後確認。草稿不視為完成、不占完成名額；同 ID 大小寫重複、名額不足、發布後修改皆拒絕。
- 管理：空白名單活動、2–64 人上限、報名開關、完成名單選擇及排序、確認發布、自動會員對應、切換對局、既有逐局賽果與結算。發布後禁止換名單或解除自投注限制。
- 首頁：未排賽活動不誤判完賽，報名與管理連結保留 event ID；比武詳情安全顯示實際角色，不注入使用者輸入 HTML。
- 備戰：離開前儲存草稿，帶回同屆同會員；配置 localStorage 按會員與活動隔離。正式活動代號流程仍保留。
- `pnpm test web/src/features/sportsbook web/src/app/labRuntime.test.ts web/src/app/scheduleDuel.test.ts web/src/app/LunjianRuntime.test.tsx web/src/app/loadout`：10 檔 126 項通過。涵蓋會員報名 UI、管理關閉與二次確認發布、角色來回、併發最後名額、自己的比賽／名次下注限制、其他場次投注、封盤、派彩與冪等、原有帳本／串關／兌換回歸。
- `pnpm typecheck`、`pnpm lint`、`pnpm lint:custom`、`pnpm build` 通過。首頁與備戰從 lab 正本重新生成；生成器替換目錄事先核對來源檔 hash 和目標邊界。
- 預覽原程序已停止；重新啟動 Next dev 於 127.0.0.1:3000，首頁、/sportsbook、/loadout 和兩支生成 runtime 均 HTTP 200。
- CUA 再次回報 `trusted Node process exited unexpectedly; kernel reset`。真實桌機／手機視覺、手勢與跨分頁操作尚未完成實機驗收，JSDOM／fake-indexeddb／HTTP 檢查不替代。
- 本輪依使用者選擇完成本機流程；正式登入、裁判授權、Hestia 報名與跨裝置同步仍為下一階段。


## 2026-09-29 UI 回饋與完整報名表
範圍及未完成清單見 [UI_INTERACTION_PLAN.md](UI_INTERACTION_PLAN.md)。本輪完成完整四步報名與 profile 驗證、錯誤焦點、額滿／截止、完成憑據與修改；共用按鈕 44px／150ms 按壓；雅集確認視窗及 pending 防誤操作；備戰保存失敗可見、重試與離頁保存。首頁／備戰均由 lab 正本生成，既有素材 SHA 核對一致。

最終全站回歸 79 檔／816 項通過；pnpm typecheck、lint、lint:custom（333 檔）與 build 均通過。Sportsbook UI 共 17 項，包含額滿及完成憑據焦點。報名四步及確認視窗 axe 基本檢查通過（不包含對比度）。正式裁判停用狀態另跑 DrawPanel／MatchConsole 共 17 項通過。CUA 與 node_repl 因 Windows 沙箱 error 5 皆無法啟動；桌機／手機、視覺動效與實際端到端仍未驗收，不將 HTTP 200 或測試當成實機證據。

### 後續實際瀏覽器證據（2026-09-29）

CUA 仍故障，但隔離 Playwright Chromium 可用。1440／768／375px 共 24 狀態完成會員註冊、草稿重載、四步報名、完成憑據、鍵盤修改長姓名、雙分頁登入同步，頁面實際使用 IndexedDB。axe 包含對比度皆通過、無 pageerror 或整頁水平溢位。修正錯誤色過暗及換步驟焦點留在視窗外；驗收脚本和限制見 UI_INTERACTION_PLAN。截圖保存在 docs/previews/registration-browser。這取代「完全無法瀏覽器驗收」的舊限制，但不能推論其他頁面或 3D 動畫已完成。

同日備戰追加：三尺寸 18 個畫面狀態通過 axe／溢位／44px 按鈕檢查。實際完成流派→等級→保存重載→心法 Escape→JSON 下載→快速添加入倉庫。修復巢狀按鈕、浮層小目標、手機關閉位置，以及兩處 `on` 名稱遮蔽造成按鈕事件失效。生成 runtime 回歸 31 項通過；完整未驗項目見 UI_INTERACTION_PLAN，不能以這 18 個狀態代表全備戰或全站驗收。


2026-09-29：備戰原生 dialog、角色管理／匯入／裝備套裝失效與鍵盤操作修正，三尺寸擴至 45 個狀態。具體證據與尚未完成項目見 UI_INTERACTION_PLAN 最新節；未將局部驗收視為全站完成。

2026-09-29 後續：備戰取消改為真正捨棄草稿，保存失敗阻止返回報名，輸入／選單補 44px；版本 `3074752b67` 三尺寸 48 個狀態通過。報名補驗與備戰往返、quota failure 重試、全鍵盤第二位會員、額滿與截止。相關 4 檔／59 測試、typecheck、lint、token、build 通過；完整證據與未完成範圍見 UI_INTERACTION_PLAN 最新節。

2026-09-29 雅集追加：實際 Chromium 三尺寸 67 狀態走完獨立投票／單注／跨場串關、兩場草稿與封盤結算、兌換取消／核准／發放及缺貨。修正下注錯誤誤歸投票盤口，提示放回注單並聚焦；交易成功移除觸發者時，Modal 關閉回到結果內容。雅集 80 回歸及 typecheck／lint／token／build 通過。來源、截圖與未驗邊界見 UI_INTERACTION_PLAN；全站動畫尚未宣稱完成。


## 2026-09-29 首頁七章與角色詳情
三尺寸 51 個首頁狀態、27 個實際操作狀態通過；包含逐格串行事件、減少動態、BP／條文、勝敗試看、詳情與賽程往返。角色面板關閉鈕原被頁首遮住，已以對話框層級與 sticky 關閉鈕修正；手機頂端及底部命中檢查通過。詳見 UI_INTERACTION_PLAN 最新節與 docs/previews/home-browser、home-controls-browser。3D 的 SwiftShader 診斷不代表硬體裝置視覺驗收；總目標尚未完成。


## 2026-09-29 賽程管理與勝敗動態
三尺寸共 30 編輯狀態通過：8–64 人快捷設定、7 人輪空、無效人數、真實拖曳／選位、比分取消保存刷新、儲存失敗提示。修正過小關閉鈕、錯誤位置／焦點、復原錯誤被成功文字蓋掉；補 150ms 控制回饋。桌機／手機實際 CSS Animation 取樣 250／800／1700ms，勝章／斬切／冠軍效果、離章暫停及減少動態通過；桌機角色遠近比例 1→1.0618→1.1966。相關 89 測試、typecheck、lint、token、build 通過。完整證據、測試限制及未完成範圍见 UI_INTERACTION_PLAN 最新節。

### 2026-09-29 本機參賽交接補驗
報名→關閉／換籤→發布→自己的對局→首頁賽程／角色／比武→嵌入雅集→返回，三尺寸 30 個實際 Chromium 狀態通過。修正籤位按鈕尺寸、手機頁籤寬度、憑據前往對局焦點、自投注在選盤與草稿確認前的限制提示。雅集原 67 狀態重跑通過；6 檔 82 測試及 typecheck／lint／token／build 通過。完整範圍、2D 測試重導與未完成項目見 UI_INTERACTION_PLAN 同日「報名發布與首頁交接驗收」，證據在 docs/previews/participation-handoff-browser。未動 lab 或正式 Hestia。

### 2026-09-29 盤口特殊狀態
三尺寸 39 個 Chromium 狀態（兩分頁實際改價、單注退款、串關部分與全作廢、並行 800 點扣款僅一筆成立、時間門檻鎖定）通過。修正改價提示就近聚焦、設定錯誤焦點與清除、Modal 固定標題、時間門檻唯讀。4 檔／75 測試及 typecheck／lint／token 通過。範圍與截圖見 UI_INTERACTION_PLAN 同日「盤口改價、作廢與並行下注」，不是全站完工。

盤口補強最後 CSS 調整後：production build、修改檔 ESLint 與 token 再驗通過，原預覽服務維持運行。

### 2026-09-29 備戰穿脫、讀檔重試與複製替代流程

本批先盤點直接穿脫的焦點、匯入讀取失敗／重試、延遲讀取、剪貼簿拒絕與手機替代操作，再從 lab/loadout.js 修改並生成；保留已確認美術。

- 穿脫後重新渲染，焦點回到同件裝備的新動作，可連續用鍵盤卸下／裝上。
- 匯入讀檔期間停用套用並顯示讀取中；失敗在預覽內提示及聚焦，可再次選同一檔案。新貼上文字、關閉或重開視窗會使舊讀取結果失效，避免覆蓋新內容。
- 匯出複製失敗及缺報名代號在當前視窗顯示持續回饋；過期非同步結果不干擾另一個視窗。
- 主頁「複製配置」遇剪貼簿拒絕，開啟原生手動複製視窗、聚焦唯讀文字並全選。手機可直接複製，不必尋找桌機右欄。

verify-loadout-browser.mjs 三尺寸 1440／768／375px 各 24 狀態，共 72 狀態通過：axe WCAG A／AA、44px 受測控制、無橫向溢位或 pageerror；以實際鍵盤及 dialog 焦點斷言驗證。剪貼簿拒絕與 File.text 失敗／延遲由隔離 Chromium 注入故障，重試與界面流程使用實際 UI，未操作使用者的資料。實際查看手機匯入錯誤、匯出錯誤與手動複製截圖。結果在 docs/previews/loadout-browser/results.json。

相關 4 檔／67 測試、typecheck、lint、token（333 檔）及 build 通過。來源素材與生成目的地 SHA 核對一致後生成 loadout 版本 366c143e36；首頁版本維持 537368069856。開發服務維持運行。

總目標仍未完成：接續首頁嵌入報名、其餘玩法／賠率政策、完整開場與墨暈／硬體 3D 品質、正式頁面可驗介面及全站清單核對。

### 2026-09-29 首頁嵌入報名與巢狀視窗

先盤點首頁報名 CTA、雅集內我的參賽、巢狀登入取消、表單草稿／完成／刷新及登出，再依 baseline-ui 與賽事設計系統修正，保留現有表單與美術。

實測發現並修正：
- 原生 dialog 的 cancel 經 React 向外傳遞，Escape 會同時關閉登入與外層雅集；Modal 的 onCancel 加 stopPropagation，只關閉最上層，回到原報名動作。SportsbookBridge.test.tsx 補巢狀取消與焦點回歸。
- 首頁全域 main 層級會高於雅集固定標題列，手機表單文字蓋到標題。modalBody 使用 isolation:isolate，將內容層級限制在視窗內；保留 sticky header 與原生 modal，未重寫焦點圈選。

新增 scripts/verify-embedded-registration-browser.mjs：隔離 Chromium、以 UI 建活動及會員、真實 IndexedDB，1440／768／375px 各 9 狀態，共 27 狀態通過。涵蓋首頁 CTA 真實導航到相同 event 的報名表、首頁雅集內規則／註冊、Escape 只關內層、缺欄位聚焦、儲存草稿後關閉／重開續填、角色配置與核對、完成憑據、刷新保留、登出不顯示上一位私人資料。關閉外層後焦點回原入口，輸入 ArrowRight 不切換背景章節。

axe WCAG A／AA 無違規、受測可用按鈕至少 44px、無整頁橫向溢位或 pageerror；elementFromPoint 驗證固定標題不被內容遮擋（修正前同一斷言失敗）。實際檢視手機巢狀登入與核對截圖，结果在 docs/previews/embedded-registration-browser/。測試用 stage=2d 隔離 UI，沒有宣稱 3D／開場品質完成。首次脚本用錯登入視窗名稱，校正後再驗；不列為產品問題。

相關 3 檔／31 測試、typecheck、lint、token（333 檔）及 build 通過；首頁 HTTP 200，服務保留。本批只修改 React／CSS，未改 lab 或執行生成器。

完整 UI 目標仍在進行。後續仍需核對全部玩法逐局结算／賠率政策、完整開場與墨暈運動品質／硬體 3D、正式功能頁可驗狀態，以及全站操作清單最後核對，不以本次 27 狀態代表全站完成。

### 2026-09-29 點燃開場與墨暈時間修正

依專案 animation-systems，先列出點燃前焦點／鍵盤、進站、完整墨幕下換內容、快速連點、中途／初始減少動態與載入失敗備援，再從 lab 正本修改。保留已確認 B 游墨覆蓋＋中央揭幕、角色定格及 3D 場景。

修正：原 tick 將每幀時間限制在 50ms，連墨暈也用這個積分步長，掉幀時原 3.2 秒換頁會被拉長。startCut 記錄自己的 performance.now，tickCut 依實際影格时间推進；視差與 3D 原有積分保持不變。跨過覆蓋時間的大影格必須先 paintInkBloom(1,0)，在全不透明時切換內容，再於下一幀揭幕，避免低幀率跳到半透明才換內容。修正過期的 560ms 註解。

瀏覽器脚本 scripts/verify-opening-motion-browser.mjs：
- 隔離 Chromium 的 requestAnimationFrame 人為限制每次至少相隔 240ms，只模擬稀疏影格；原實作超過 6.5 秒仍未換完，修改後約 3.7 秒完成。這是時間語意測試，不代表硬體 3D FPS。
- 1440／768／375px：Tab 留在點燃入口、Escape 不略過、Enter／Space／點擊分別點燃，燃燒時按鈕停用，結束釋放背景與焦點。截取實際播放中的燃幕、墨暈覆蓋與中央揭幕，沒有用靜態替代圖冒充動畫。
- MutationObserver 在切換章節時讀取實際 canvas alpha：三尺寸皆在 progress 0.46，所有像素 alpha=255。快速連點以最後選擇的獎賞為終點；過場中啟用 reduced-motion，立即解除遮罩並開放七章閱讀。
- 2D 开場及原有 ink canvas 的操作驗收，不將軟體 GPU 結果擴稱硬體 3D 品質通過。

相關 5 檔／76 測試、typecheck、lint、token（333 檔）與 build 通過；生成前核對受管理素材 111 檔 SHA 與來源一致，輸出仍在 web/public，首頁版本 36b9e64bcf27。開發服務持續運行。

原完整目標尚未達成：其餘玩法與管理狀態、全站可用控制清單、正式功能頁可驗介面、硬體 3D 品質仍需繼續核對。

本批最終瀏覽器結果：24 個三尺寸画面採樣、3 個切頁全覆蓋像素紀錄，加稀疏影格／資源失敗／初始減少動態，共 30 筆結果。15 個穩定畫面做 axe WCAG A／AA 與溢位檢查均通過；動畫中段不以 axe 取樣判定瞬間透明度。刻意阻擋 stage3d.js、雙俠圖片與 ink-transitions.js 後，仍可等待點擊、進站、切到規則；初始 reduced-motion 七章實際可見且沒有 inert，無開場遮擋。初始閱讀模式不依 data-on 數量判斷可見性，腳本已改以 checkVisibility 與 inert 檢查，未為符合錯誤的測試假設改動產品。結果和截圖在 docs/previews/opening-motion-browser，最終退出碼 0。


### 2026-09-29 首頁無活動代號的報名入口修復
使用者實際從 `/#register` 進站；先前驗收只涵蓋有 sportsEvent 的連結，未涵蓋一般首頁。無正式 slug 時 renderRegister 把 CTA 導回規則，導致四步表單無法到達。

現在報名章主按鈕為「開啟報名表」，直接開啟專用原生 dialog；有指定活動沿用指定活動，沒有代號則以 registration-open 原子命令沿用最近的報名活動，首次才建立「百業試鋒 · 本機報名」（64 人上限，可由管理者調整）。既有已截止／發布活動不重開，不採用動畫示範選手名單，不在首頁載入時建立活動。併發點擊不重建活動，不贈點。正式 slug 的正式報名入口保持既有 API 路徑。

RegistrationEntry 提供讀取、錯誤與重試；Sportsbook registrationOnly 直接顯示四步表單，收起盤口、管理及賽事切換工具。會員登入／註冊、角色配置、草稿、完成憑據沿用同一 IndexedDB。首頁選定本機活動後把 preview／sportsEvent 寫入 URL，重新整理可續用；獨立 `/sportsbook?entry=registration` 也固定所選 event。關閉還原焦點，修正 sticky 標題上方留白透出捲動文字。

首頁來源由 lab 生成，111 檔受管理素材 SHA 一致；版本 e92ba976b01f。新增 scripts/verify-home-registration-browser.mjs，從空白瀏覽器／無活動代號首頁操作完整報名，在 1440、768、375px 共 27 狀態通過（axe WCAG A／AA、無水平溢位、觸控區、巢狀登入 Escape、錯誤焦點、草稿續填、送出、刷新、登出與獨立備援連結）。使用既有 2D 備援驗 UI，不宣稱硬體 3D 動畫驗收。相關 6 檔 86 測試、typecheck、lint、token（334 檔）、build 通過。服務保持 127.0.0.1:3000。


### 2026-09-29 最新覆蓋：報名章內的展卷表單
依使用者在 #register 指定的位置，取消該章 CTA 的大型報名 dialog，改為 RegistrationScroll 以 React portal 掛在 lab 的 registration-inline。原 3D 擂台／shot 3 不變，移除重複庭院漫畫與舊紙面 CTA 雙卡。桌機左側題字、右側書卷；手機展卷後單欄填寫。這項決策取代上一節的「專用報名 dialog」，其他雅集與登入視窗仍保留。

展卷報名 → 四步表單 → 完成落印。紙面與卷軸以 transform 展開 900ms、內容淡入 400ms；reduced-motion 無動畫。收卷只是隱藏已掛載表單，保留未儲存欄位；刷新僅還原已儲存草稿／報名，登出切換會員不洩漏前一人的資料。缺少 portal host 仍有原生視窗備援，直接開啟連結仍有獨立報名頁。ResizeObserver／事件在卸載清理，表單方向鍵不穿透切章，沒有嵌套 main 或額外垂直捲軸。

驗證：verify-home-registration-browser.mjs 在 1440／768／375 共 27 狀態通過，涵蓋無活動入口、巢狀快速註冊、驗證焦點、保存草稿、未儲存收卷續填、完成、刷新、登出及獨立連結；axe A／AA、44px 按鈕、無水平溢位。verify-registration-scroll-browser.mjs 在 946px 取樣實際展卷動畫及 reduced-motion，確認內層捲軸 0、章節仍處理捲動，截圖位於 docs/previews/registration-scroll-browser。3D SwiftShader 截圖逾時，因此構圖／流程視覺驗收使用 2D 備援，未宣稱硬體 3D 畫質或 FPS 通過。

相關 5 檔 76 測試通過；加入卷軸量測後再跑 bridge／lab 36 測試通過。typecheck、lint、token（336 檔）、build 通過。111 檔受管理素材與來源核對後生成，首頁版本 e7076c3717de。服務保持 127.0.0.1:3000。


### 2026-09-29 最新覆蓋：中央收卷與單行導覽
依使用者再次標註，報名章移除左右分欄與側面文案，初始只有中央收起的紙卷、封籤與展卷入口；點擊後原地展開最大 680px 的四步表單。逐筆「報名」移至封籤，保留完整七章題字控制器、登入與草稿流程。

導覽所有尺寸維持單行：1440px 高 72px；1279px 以下高 64px，章節同排橫向滑動，備戰與活動入口收進更多。手機精簡品牌，會員點數副列隱藏；觀局雅集仍可直接開啟。此決策取代先前 1024px 以下双列規範。

verify-centered-registration-browser.mjs 在 1440／943／375 共 9 狀態驗證：書卷中心與 viewport 中心相差 5px（原章節保留的 scrollbar gutter），品牌／章節／操作同排，無水平溢位、axe A／AA 通過；更多入口可用且橫捲章節仍可切換。375px 完整報名 9 狀態再次通過。相關 bridge／runtime 46 測試通過，最終 lab／題字 44 測試通過；typecheck、lint、token 與 build 通過。畫面證據使用 2D 備援，原 3D 場景未改。lab 素材 111 檔核對後生成，最新版本 2335dc6a524a。


### 2026-09-29 對外畫面與管理操作分離（最新）

- 設計規劃與文案規格集中於 [PUBLIC_PRESENTATION.md](PUBLIC_PRESENTATION.md)，不渲染到訪客畫面。
- 新增靜態 `/home`，品牌回到百業試鋒首頁；報名紙卷只留「報名表」。會員入口先登入，登入後顯示個人總覽；比武觀局帶入同一屆、同一場次。
- `mode=manage` 才提供演出試看、階段切換、賽程編輯、建賽與管理操作。公開頁刪除閱讀方向、試看賽程 CTA、模擬登入與管理切換。這是本機呈現隔離，非後端授權。
- 備戰面板以既有 catalog 精確名稱配圖，武器／心法為主，其餘配置收合；公開選手無資料時不展示 fixture 配裝。模擬配裝僅管理預覽可見。
- lab 生成版本 `f070ffbab50b`；生成前核對 111 個 art/type/vendor 檔案 SHA 與目的路徑；既有會員與賽事資料不重設。
- 7 檔 109 測試、typecheck、lint、token 檢查與 production build 通過。桌機 943px／手機 375px：會員註冊登入、對局選擇、投票與點數紀錄 10 狀態；公開首頁、會員、空賽程、公開／管理備戰 10 狀態；無水平溢位、axe 規則無違規。
- 瀏覽器使用隔離 Playwright 與 2D 場景；沒有操作使用者既有資料。未驗證實機硬體 3D 或正式後端授權。服務維持 127.0.0.1:3000。


### 2026-09-29 首頁最終覆蓋：共用導覽與分層場景

使用者否決獨立文字首頁，改為與內頁共用生成 header/CSS，中央只保留「百業試鋒」「了解賽制」「提筆報名」。lab/home-stage.js 呼叫既有 createScene，山門鏡位 0，背景慢推進；不新增燃幕。雪竹、火盆、雪梅以 6／5／7 層構成前景，題字與 CTA 為 10，手機隱藏火盆。素材逐張查看後選定，取代枯松／石橋；細節只存 PUBLIC_PRESENTATION.md。

桌機 943px／手機 375px 的公開畫面 10 狀態重新通過溢位與 axe 檢查。真實 3D 瀏覽器冒煙：302 mesh、30,733 instance，frame=7，離頁後 sceneFlag 清除且場景 dispose；證據 docs/previews/public-presentation-browser/home-3d.json。此為軟體瀏覽器功能檢查，不代表各硬體 FPS 已驗收。新增 4 項場景生命週期／載入中卸載／2D／reduced-motion 測試通過；此前 109 項功能回歸通過。typecheck、lint、token 與 build 均完成後以終端結果為準。


### 2026-09-29 首頁鏡頭連動與前景確認
lab/home.html 與 home-stage.js 加入同一 RAF 驅動的滑鼠平滑視差；真實 3D camera、題字與各前景依深度連動。左下雪竹，右下雪梅疊火盆（貼右下邊界），依使用者最新指定移除暖燈。前景 z5–7，題字 10，按鈕穩定。設計細節記錄於 PUBLIC_PRESENTATION.md，不輸出到 UI。

已執行 38 項首頁／lab 回歸；typecheck、lint、340 檔 token 檢查與 build 通過。1055／375px 構圖無水平溢位，減少動態不建立 WebGL、鍵盤焦點與 axe 檢查通過。實際 WebGL 的桌機／手機已確認前景與題字位移、離頁清除 transform 並 dispose；腳本 scripts/verify-home-3d-browser.mjs 可重現。最終素材微調截圖 home-final-1055.png／home-final-375.png。這是瀏覽器軟體渲染驗證，不代表所有 GPU 的幀率驗收。服務仍在 127.0.0.1:3000。

最新指標驗證通過：1055px 左右移動時實際 camera.x 由 -0.673 變為 0.609，題字 x 由 8.227px 變為 -7.455px；五個深度圖層均可見且位移不同，卸載清除 transform／GPU。證據 home-3d-1055.json 與同名 PNG。



### 2026-09-29 恢復首頁燒布與題字動態
/home 重新共用既有 stage3d 開場：真實載入 → 等待點燃 → 原布料／雙俠剪影 → 首頁。新增 home-intro 對話框生命週期與 2D 備援，stage3d 支援明確傳入 runtime/canvas，根路由沿用原參數行為。boot 標記從 lab 正本生成，未複製另一套美術。題字改較慢阻尼、小幅平移及透視傾斜，不再套前景的推近縮放。

回歸 4 檔共 51 項通過；typecheck、lint、token（341 檔）與 build 通過。隔離 Chromium 實際檢查 375px 2D 與 1055px 3D：等待點燃、Tab 焦點、Enter 點燃、燃燒完成解除 inert、回到首頁主操作，沒有 pageerror。截圖與結果在 docs/previews/public-presentation-browser/home-opening-{2d,3d}.*、home-entered-{2d,3d}.png。腳本 verify-home-opening-browser.mjs。保留本機服務；未宣稱全硬體 GPU 效能驗收。

開場整合後另修正圖層：canvas 獨立於 main，3D 生效時隱藏 home-scenery 靜態底圖，避免 main 的 stacking context 蓋住 WebGL。瀏覽器開場腳本增加靜態圖 opacity=0 與實際 __JZ3D 場景存在的檢查。


### 2026-09-29 首頁至內頁停頓／動畫重播修正
原因：生成標記的普通 anchor 觸發整頁 navigation，3D 場景／材質重新建立；內頁先 applyGrid(0)，再指定 hash，字形載入及 stage3d 就緒時又再次 applyGrid，使漫畫入場被停止後重播。

修正：HomeRuntime 保留活動參數並用 Next client router、預取根路由。首頁既有 scene/canvas 以一次性交接供 stage3d 採用，跳過 createScene、banner.prepare 及 shader prepare；15 秒未接手即回收並顯示靜態備援。背景分頁／離站也清理。初始章節直接使用 hash；字形與 3D 就緒只更新展示、不重啟前景／漫畫序列。最初進首頁的點燃燒布保留。

驗證：7 檔共 82 測試通過，含場景交接、逾時回收、帶活動參數的兩入口、Ctrl 點擊、字形回呼不重播漫畫、原序幕與串行漫畫。typecheck、lint、token（342 檔）及 build 通過。隔離 Chromium 的兩個 2D 入口約 0.5–0.7 秒確認到達正確章節，sameDocument=true、無再開場。WebGL 路徑驗證 sameScene/sameCanvas=true，無剩餘交接物件與 pageerror；因軟體渲染的實體 click 在 scrollIntoView 超時，3D 冒煙改用原生 DOM click 觸發同一處理器，整段腳本約 38.6 秒，不能當作實際硬體效能驗收。證據 home-navigation.json，腳本 verify-home-navigation-browser.mjs。

### 2026-09-29 返回首頁不重播開場
完成點燃與開場後，以 sessionStorage 的 lunjian:opening-seen:v1 記錄同一分頁已進站；首頁控制器、內頁 boot 與 stage3d 共用判斷。從頁首「論劍」返回首頁或重新整理，不再顯示 loading／點燃燒布；首次進站仍保留原開場。僅真正完成才寫入，卸載中止不算完成，儲存不可用時不阻斷頁面。

驗證：4 檔 55 項測試、typecheck、相關 lint、token（342 檔）與 build 通過。隔離 Chromium 1055px／375px 實際完成 2D 開場，再由賽制及報名入口返回首頁，MutationObserver 確認回程從未出現 data-intro；boot 隱藏、主內容解除 inert、刷新亦不重播。腳本 scripts/verify-home-return-browser.mjs，證據 docs/previews/public-presentation-browser/home-return.json。本次回程瀏覽器測試使用 WebGL 不可用備援，不代表 GPU 效能驗收。

### 2026-09-29 返回首頁墨暈與卸載驗收
9 檔 82 項測試通過，包含 SSR HTML 不逸出容器、DOM 已移除時 runtime 清理／末幀、墨幕覆蓋後才導覽、首幀後才 ready、連點、修飾鍵、reduced-motion、逾時與遲到場景釋放。typecheck、相關 lint、token（345 檔）、build 通過。

隔離 Chromium 1055px／375px 延遲 home-stage 模組 1.6 秒，確認同 document 切換、載入時墨幕 hold、ready 時仍有墨幕、揭幕後僅一個頁首且沒有 #rules 遺留，焦點落於了解賽制、boot 隱藏、沒有 pageerror。桌機另以實際 WebGL 完成同一驗證，scene=3d，已檢視截圖。腳本 scripts/verify-home-ink-browser.mjs；證據 home-ink.json、home-ink-3d.json、home-ink-held-*.png 與 home-ink-done-*.png。3D 軟體渲染曾使 10 秒等待不足，最終採 90 秒驗證窗口；這不是硬體幀率或真機效能驗收。CUA 初始化失敗，使用隔離 Playwright；本機服務繼續保留。

### 2026-09-29 報名卷軸與閱讀確認（最新覆蓋）
卷軸改用 24px 深木色圓軸與獨立端帽，和淺色紙面區分。收起採同一段 1,000ms 動作：下軸向上移動，紙面遮罩同步裁切內容，整卷連續回到中央入口；取代先前文字先淡出、紙面縮放、最後切換入口的分段效果。以隱藏量測副本計算落點，不變更真實表單布局、不重啟內容動畫。動畫結束才收合，1,200ms 保底；保留表單、焦點返回入口，減少動態設定直接完成。

閱讀確認改為原生 checkbox 搭配獨立文字與章節連結。選中使用朱紅邊線、淡紅底及加粗文字；hover 改變底色，focus-within 顯示清楚外框。「賽制」與「讓武原則」分別連至 rules／invitation，點連結不切換勾選。章內表單使用 hash 導覽，閱讀後返回仍保留填寫狀態；移除重複的閱讀連結。

驗證：4 檔共 64 項回歸、typecheck、相關 lint、345 檔 token 檢查與 build 通過。隔離 Chromium 1055px／375px 驗證收卷各阶段、落點誤差小於 2px、鍵盤收卷／焦點返回／重開保留勾選，以及減少動態無動畫；兩尺寸亦確認 checkbox hover、focus、checked 樣式，兩個章節連結不重載頁面且保留勾選。已檢視桌機中途動畫與手機勾選畫面。腳本為 scripts/verify-scroll-close-browser.mjs、scripts/verify-registration-consent-browser.mjs，證據位於 docs/previews/registration-scroll-browser/。CUA 無法初始化，使用隔離 Playwright；未將軟體渲染視為實機 GPU 效能驗收。服務繼續保留。



### 2026-09-29 卷軸外觀還原與收合閃動修正
依使用者最新確認，保留連續捲動，收起外觀恢復原本 64px 淺色圓紙卷與小軸頭，移除上下粗木框；展開軸身亦恢復紙色，維持立體明暗與端帽。收合末段使用相同圓紙卷銜接，題字直接維持完整筆畫，避免隱藏再顯示時重新描字。

修正收合交接：動畫結束及計時備援先隱藏表單再撤掉動畫狀態；入口顯示與焦點改在 React commit 後的 layout effect 同步處理，focus 使用 preventScroll。避免表單尚未隱藏就顯示入口、移焦而重新排版。保留勾選與再次展開。

驗證：37 項回歸、typecheck、相關 lint、345 檔 token 檢查通過。1055／375px 隔離 Chromium 檢查中途及末幀落點、正常速度收合 RAF 狀態、重開草稿及減少動態；正常收卷後未觀察到展開表單再次出現。證據沿用 registration-scroll-browser 與 verify-scroll-close-browser.mjs。本次無 3D 場景改動，瀏覽器以 2D 備援驗證。


### 2026-09-29 報名互動與捲動範圍精簡
依使用者回饋移除同意區整圈紅框與外層焦點框；保留淡色 hover／選中背景，鍵盤焦點只標示核取方塊或目前連結。收卷拉籤取消旋轉與上下位移，fine pointer hover 僅輕微加深朱紅，按壓再加深，鍵盤保留深色焦點框。

原 1055×884 展開表單加留白 scrollHeight 為 1016px。縮減章節上下留白、卷內 padding、表頭與步驟間距後，首步可完整容納於 884px；手機因文字換行仍允許正常閱讀捲动。收合時暫時使用 overflow:hidden，防止 transform 撐出額外捲動區，穩定 gutter 與關閉 scroll anchoring 避免寬度跳動；閱讀模式不套用此限制。

隔離 Chromium 1055／375px 驗證 hover 不位移、整列無外框、鍵盤 checkbox 焦點、兩章節連結與保留勾選。收卷腳本逐幀確認關閉時 overflow:hidden、無表單閃回、重開保留內容，桌機首步 scrollHeight=clientHeight=884，手機內容 970px 可正常捲動。37 項回歸、typecheck 與 345 檔 token 檢查通過。驗證脚本及圖片沿用 registration-scroll-browser；規劃僅存文件。


### 2026-09-29 同一卷身收合與逐筆題字恢復（取代前次交叉淡化）
前次只檢查 DOM 是否閃回，未涵蓋最後 20% 的半透明重影；使用者截圖確認紙面、假卷身與替代字會同時出現。本次刪除 settleWriting／revealLabel 交叉淡化和 React 的替代「報名表」。同一實體上軸在捲合時由 24px 增厚至 64px，維持 opacity=1，下軸和紙面收進其後；合卷入口與上軸共用 registration-roll 樣式，兩側為橢圓卷紙端面，末幀補償端面縮放。

移除禁用 ink-nib 動畫的覆寫。合卷完成顯示原 chapter-titles SVG，由既有筆順重新題寫，減少動態保留靜態文字。入口裝飾獨立於 CTA 文字節點，避免活動狀態更新 textContent 時被刪掉。原勾選、超連結、鍵盤與草稿保留不變。

桌機／手機末段 800／950／999ms 截圖與正常速度 RAF 驗證通過；卷身全程不透明、末幀無替代字或重影，合卷可見、筆畫具有不同開始時間，重開保留勾選，收合無額外 scrollbar。逐幀測試暫停 JS 時鐘以防測試截圖耗時誤觸備援 timer；另有未暫停的正常速度收合驗證。49 項相關回歸、typecheck、相關 lint 與 345 檔 token 檢查通過。證據與腳本沿用 registration-scroll-browser／verify-scroll-close-browser.mjs。

本輪 build 亦通過；最後一次生成後 labRuntime 33 項重跑通過。額外隔離 3D 驗證程序長時間無回應、未產生截圖，已停止該測試與其子瀏覽器，未停止 Next 服務。故本輪視覺驗收限定桌機／手機 2D 場景，3D 實機仍待確認；不得把此流程列為 3D 通過。3D 重現腳本 verify-scroll-3d-browser.mjs 加入時間上限。


2026-09-29：依使用者最新回饋，紙卷左右增加深木色短柄與端帽，收合末段隨同一上軸伸出，保留橢圓紙層及逐筆題字。收起入口預留兩側空間，375px 木柄完整可見且無橫向溢出。37 項回歸、typecheck、相關 lint、345 檔 token 檢查通過；1055／375px 與減少動態的收合、筆畫、焦點及草稿保留驗證通過，已檢視截圖。本次瀏覽器採 2D 備援，未另宣稱 3D 實機通過。


### 2026-09-29 月位、卷軸與頁首修飾驗證

61 項相關測試通過（homeStage／HomeRuntime／markupBoundary／chapterTitles／labRuntime）、typecheck 通過、兩支改動測試檔 eslint 通過、345 檔 token 檢查通過。新增首頁月位 resize 及交接還原回歸，報名保留 26 個真實筆畫且約 2.287 秒完成。

verify-september-polish-browser.mjs 在 1055×884、375×884 通過：比武位於左半部且實際 SVG 容器暖金，導覽／會員／更多為黑體，規則評段人物置中，雪松素材載入成功且無首頁橫向溢出。已檢視兩尺寸畫面，截圖及計算樣式見 docs/previews/september-polish/。場景為 stage=2d 備援。

verify-scroll-close-browser.mjs 桌機／手機及 reduced-motion 通過：800／950／999ms 收合末段、正常速度收合無展開閃回、落點與入口一致、勾選保留、焦點返回、筆順動畫存在；桌機第一步 clientHeight = scrollHeight = 884。較窄畫面內容需要正常捲動，收合不新增溢出。截圖沿用 registration-scroll-browser/。

3D 自動驗證程序無回應，已只停止該測試程序及其瀏覽器子程序，保留 Next 服務；因此月亮的 3D 視覺位置與實機效能仍未完成本輪瀏覽器驗收，不宣稱通過。原 3D 引擎未改；home-stage 僅調整首頁 moon／sky uniform 並在交接前還原。

### 2026-09-30 備戰角色、章節標題與空白賽程驗收
角色流程 7 檔 82 項回歸、typecheck、相关 eslint 與 349 檔 token 檢查通過。verify-saved-role-browser.mjs 在 1055／375px 由 UI 建立隔離活動及會員，從報名進入備戰編輯角色、返回並套入姓名及四項配置；再從首頁卷軸編輯返回，自動展卷到角色步驟，原遊戲 ID 保留，最後確認顯示新角色名。完整圖片及結果見 docs/previews/saved-role-browser/，已檢視手機摘要、選中角色與編輯入口。右側黑影 1.2 倍與落點以 verify-duel-size-browser.mjs 驗證桌機／手機。

章名與空白樹 6 檔 117 項回歸通過，涵蓋單一 H1／章名 H2、未公布資料不洩漏、空樹 disabled 不觸發操作、手機輪次切換、公布後換成真實資料及卸載清理。typecheck、相關 eslint、349 檔 token 檢查通過。

verify-september-polish-browser.mjs 在 1055×884、375×884 通過：暖金比武題字中心與視窗中心誤差小於 2px；規則人物置中，章節標頭與賽程多餘文字移除；桌機空樹含連線和決賽，手機分輪並可到決賽，空席／場次／冠軍無可操作入口，無頁面水平溢出。已檢視桌機比武、讓武、空樹及手機空樹截图。證據見 docs/previews/september-polish/。本次瀏覽器採 stage=2d，沒有重驗 3D 月位與 GPU 效能；不宣稱 3D 通過。Next 預覽服务保持運行。

### 2026-09-30 展卷首開／比武入口／宗旨跨框驗證
相關 5 檔 87 項測試通過；新增延遲兩段資料的展卷回歸後，相關 3 檔 52 項通過。Typecheck、六支 React 檔案 eslint、349 檔 token 檢查通過。

verify-scroll-open-browser.mjs 在隔離瀏覽器 1055／375px、登入／未登入四種首次開啟逐幀驗證：完整表單高度各為 748／799／854／878px，動畫期间高度固定，chapter scrollTop 全程 0，紙面與遮罩反向位移相加誤差 0。入口保持到資料就緒；首焦點為「展卷，留名。」。截圖與逐幀結果存 registration-scroll-browser/open-*。

verify-scroll-close-browser.mjs 1055／375px 與 reduced-motion 再驗通過：收合无展開閃回、無新增捲軸、落點／草稿／焦點正常。verify-duel-player-entry-browser.mjs 在兩尺寸確認人物與姓名四個入口各開正確選手備戰面板、Escape／Enter／返回焦點正常，偽元素提示已移除，兩個下方操作中心與 viewport 中心誤差小於 2px。宗旨已檢視桌機與手機截圖，保留人物跨框且對白在紙框內，無水平頁面溢出。證據位於 september-polish/。本輪採 2D 場景驗證 DOM 與互動，未聲稱 3D GPU 效能驗收。


### 2026-09-30 最新覆蓋：三席書卷印與獨立背景
使用者改為統一中國書卷印風格並區分亞季軍：冠軍大白文方印、亞軍回紋角飾朱文方印、季軍直式朱文長印，全部固定卡片右上，移除蠟印／銀章。章內直排文字依尺寸縮小並保留邊距。刪除大數字與「第 N 名」，底部為名次＋得主；未知顯示待揭曉，已有本機／示範資料分開標示來源，沒有補造人名。三位獨立人物向左移，移除較晚規則對人物位置的舊覆寫。

三張背景各自生成為完整不透明水墨場景：冠軍山門石階 `manga-awards-courtyard`、亞軍臨水庭院 `manga-awards-lakeside`、季軍竹林演武場 `manga-awards-bamboo`。PNG 原稿及 WebP 皆在 lab/art，提示詞摘要見 lab/AWARDS_BACKGROUND_PROMPTS.md；只有格式轉換，沒有程式繪改素材。保留逐格落印及 reduced-motion。

修正 React precedence 樣式在熱更新後殘留的舊銀章／relative 定位：LunjianRuntime 只在本次版本 CSS 就緒後停用舊 lunjian.css，其他 stylesheet 不受影響。隔離瀏覽器 1198／375px 驗證右上定位、文字落在印框內、人物靠左、三張不同圖片正常載入、無水平溢出。畫面證據 docs/previews/september-polish/awards-1198.png 及 award-{1,2,3}-375.png；本轮為 2D 備援，未驗證 GPU 3D。內嵌瀏覽器工具仍因 Windows sandbox lock 失敗，未操作使用者目前頁面。

驗證結果：comicSequence／labRuntime／LunjianRuntime 共 61 項通過；typecheck、修改檔 ESLint、349 檔 token lint 通過。新增舊樣式停用回歸；verify-award-seals-browser.mjs 桌機／手機印章文字邊界、定位及背景檢查通過。


### 2026-09-30 最新覆蓋：獎賞背景改為疏淡水墨
依使用者指出背景細節過密，內建 imagegen 重新生成三张獨立低對比背景：manga-awards-mist-gate（遠山孤門）、manga-awards-mist-lake（霧湖小亭）、manga-awards-mist-bamboo（疏竹山嵐）。使用少量大形狀、大片霧色與淡墨，不使用密集漫畫刻線、建築雕飾、瓦片或石板紋理。連續紙色淡墨鋪滿卡面，沒有透明缺角；三張場景各異，人物左側與印章右上維持既有位置。
PNG 原稿在 lab/art/_src/awards-quiet，WebP 在 lab/art；舊圖保留但卡片不再引用。已從 lab 生成，33 項 labRuntime 通過；1198／375px 的 2D 瀏覽器確認三張載入、印章位置與文字邊界、人物靠左、無水平溢出，並檢視桌機合成畫面與手機卡片。沒有新增互動或修改資料流程。


### 2026-09-30 演武台背景、獎賞章名與備戰返回入口
獎賞三張背景依最新要求重新生成為演武台：山門石台、臨水擂台、竹林練武台。保持淡墨低對比與獨立場景，寬平台面、台身及階梯清楚可見；背景裁切重心 72%，保留人物左側、三級印章右上。新增 art/manga-awards-arena-{gate,lake,bamboo}.webp，PNG 原稿存 art/_src/awards-arena。獎賞章名置中並直接作為 H2／section accessible name，移除「三席，留名。」及「每一席，都由交鋒寫下。」。

備戰頁新增一直可見的「返回比武」連結，桌機與手機均不需開更多選單；首頁／備戰往返保留 sportsEvent、slug、preview、stage、mode、view，返回固定 #duel 並略過重播開幕。品牌及手機選單出口同步；有未寫入配置時先 flushSave，失敗停留並聚焦重試，不把未儲存資料默默丟掉。移除頁首版本／日期的 DOM 與寫入程式，角色與 catalog 格式不變。既有報名交接按鈕 returnTo=register 不改。

已從 lab 分別生成首頁及備戰；labRuntime、loadout/page、chapterTitles 54 項通過。verify-loadout-duel-return-browser.mjs 實際點擊返回並確認同場參數、#duel[data-on]、再進備戰的 URL、無頁面例外及無水平溢出；1198／375px 均通過。獎賞亦於两尺寸檢查與檢視畫面，證據 september-polish/awards-1198、award-*、loadout-return-*。使用隔離 2D 瀏覽器，未宣稱 GPU 3D 實測。

2026-09-30 比武前景：依使用者標記移除 shot 3 的 fg-banner-black 圖層（LAYERS[3] 清空），2D／3D 都不再掛左上旗子素圖，開場燃布不變。正本已生成；34 項 labRuntime 通過，隔離 1198px 2D 瀏覽器確認前景為空且雙俠仍存在，截圖 duel-no-flag.png。此前本輪 typecheck、修改檔 ESLint、token lint 通過。


### 2026-09-30 標題、字形與報名抬頭
分頁標題置中、刪除短句並加朱紅章序方印；旨字改細筆鋒及較小行書偏移。報名卷軸抬頭改朱紅「百業試鋒，赴約名帖」，移除兩行重複註記。隔離 Playwright 1198／375px、2D 模式檢查七枚章序與無水平溢出，rules 標題截圖 chapter-seals-{width}.png 及宗旨 prologue-glyph.png 已目視核對。報名標題焦點回歸通過，未以本輪截圖驗證完整報名流程。labRuntime／chapterTitles／SportsbookBridge 共 53 項通過；typecheck、相關 ESLint、token 檢查 349 檔通過。未驗證 GPU 3D。

左側放大章序印章：1198／375px Playwright 確認寫字期間 opacity 0、全部完成後 opacity 1 且觸發 chapter-seal-land；寬度 46／34px。手機截圖已目視；labRuntime 與 chapterTitles 共 48 項通過。

2026-09-30 漫畫順序修復：comicSequence、chapterTitles、labRuntime 共 67 項通過（新增分層順序及快速捲過回歸）。typecheck、修改測試 ESLint、349 檔 token lint 通過。隔離 2D Playwright 在 1198／375px 檢查宗旨、規則、讓武對白未早於人物及前景，章節內一個 H2、無水平溢出；報名右章寬 30／26px。HTML 四式切換均達 complete、無 JS 例外；初次自動截圖為 2D，交付試樣改用原頁預設場景模式以貼近使用者畫面，GPU 3D 未作本輪自動驗證。

比武 C 定稿：1198／375px 隔離 2D 瀏覽器確認題字中心對齊視窗、完成書寫後顯章，手機截圖已檢視；48 項 labRuntime／chapterTitles 通過。截圖 duel-title-c-final-{width}.png。

2026-09-30 書卷觀局：Sportsbook／Bridge 31 項測試通過，包含預設進階收合、空注單不顯示本金欄、次要導覽入口與既有點數交易回歸；typecheck、相關 ESLint、349 檔 token lint 通過。1198／375px 隔離瀏覽器透過管理頁建立本機 4 人示範、首頁開啟觀局、空態、註冊隔離測試會員、選結果及內層對話框完成檢查，未改使用者瀏覽器資料；截圖 sports-paper、slip-simple、slip-selected 各尺寸存 september-polish。內層 modal 未超出視窗。


## 2026-09-30 觀局雅集書卷與導覽修正

- 六項功能直接列入同一導覽，移除「更多」展開選單；手機自然換行，避免覆蓋報名人數。
- 未開賽提供明標示、不可下注的對局／名次預覽及三步使用說明，不補造選手或賠率。
- 外框改為木軸包覆捲紙，暖色油紙使用輕量 SVG 纖維紋理；標題、上下軸固定，fieldset 內部捲動。
- 驗證：Sportsbook 與 Bridge 31 項測試通過；1198px、375px 隔離瀏覽器檢查導覽六項、無更多、無橫向溢出、卷內捲動與軸固定。視覺截圖 oil-scroll-1198.png／oil-scroll-375.png 位於 docs/previews/september-polish；使用 2D 備援，未宣稱驗證 GPU 3D。


### 2026-09-30 捲軸結構第二次修正
- 依使用者標註重做上下軸：獨立 div 分成木軸、卷紙圓筒與兩個橢圓紙層端面，以 CSS 呈現圓柱明暗與外露軸頭。
- dialog 外框透明，紙面收在兩個卷紙之間，移除包圍木軸的方形紙底；原有油紙紋理及卷內捲動保留。
- 1198／375px 隔離瀏覽器檢查無橫向溢出、上下軸固定；截圖 scroll-cylinder-1198.png／scroll-cylinder-375.png。Bridge 5 項測試、typecheck、ESLint 與 349 檔 token 檢查通過。


### 2026-09-30 卷心、毛筆標題與開合
- 左側木柄延伸到端面卷心前方，右側移除洞口，統一上下軸。
- 觀局雅集以既有 lab/font/王漢宗中行書繁.ttf 擷取四字至 public/fonts/guanju-brush.ttf，48px（手機 32px）朱紅置中，保留可存取的 H2。
- 使用 Web Animations API：上軸固定、下軸隨 560ms 展卷向下，關閉 380ms 逆向收卷；返回、外側點擊與 Escape 共用收合。busy 不關閉、卸載清除動畫、reduced-motion 直接開關。
- 1198／375px 隔離瀏覽器確認字體載入、無橫向溢出、返回與外側關閉、再次開啟；Bridge 5 項、typecheck、ESLint、token 檢查通過。截圖 scroll-brush-1198.png／scroll-brush-375.png。


### 2026-09-30 我的獎品
- 觀局雅集與會員導覽新增「我的獎品」；將原獎品兌換頁底部的個人兌換紀錄移入獨立區。
- 僅顯示登入者申請，包含獎品、申請時間、點數及待審核／已核准／已發放／已取消狀態；保留待審核取消退款的原確認流程。
- 未登入提供登入入口；無紀錄提供前往兌換入口。未更動扣點、庫存或審核規則。
- Sportsbook 28 項測試通過（新增個人資料篩選、取消資格、空紀錄與登入驗證），typecheck、ESLint 通過；1198／375px 七項導覽可用且無橫向溢出。


2026-09-30 比武底部入口簡化：移除兩名選手快捷下注按鈕，只保留「觀局雅集」，點擊仍開啟本場觀局；返回賽程保留。修改 lab 後重新生成；scheduleDuel／labRuntime 45 項通過，瀏覽器確認入口可開啟。


### 2026-09-30 配裝卡片與觀局統一
- 投注入口整合為「投注區」，內部切換對局／名次；對局選手與勝負、比分選項依左右方排列，保留同一注單。
- 首頁與觀局內的備戰配置共用 dossier-demo.json 示範資料；真實公開角色優先。示範裝備屬性與 BP 限制明標示範，不寫入選手資料。
- 配裝視窗統一為窄版紙頁；武學採橫卡、心法採直卡、裝備採圖片抬頭加屬性列，BP 採獨立表格。內層保留原生 dialog 焦點與 Escape／外側關閉。
- 比武摘要顯示主武學、雙武器、稱號與段位，放大文字與間距；移除多餘賠率提示、重複場次及待評定狀態。
- 配裝選擇器改黑體，名稱桌機 18px／手機 17px，分類橫捲、長說明自然換行；桌機奇術兩欄，手機單欄。
- 驗證：Sportsbook、scheduleDuel、labRuntime、loadout/page 共 80 項測試通過；typecheck、指定 ESLint、349 檔 token 檢查通過。Playwright 隔離資料驗證 1198／375px 的內外配置與流派／心法／奇術選擇器，沒有橫向溢出。截圖位於 docs/previews/september-polish/。首頁僅驗證 2D 備援，未重新驗證 3D 舞台。


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

### 2026-09-30 修正報名入口無法前進
- 原因：preview 指定的既有對局快照沒有 registration，入口錯接唯讀參賽資訊。
- RegistrationEntry 對 preview=1 且無 registration 的活動解析既有本機報名活動，必要時沿用 registration-open 建立；不更動原示範對局。正式指定活動及已關閉報名不繞過限制。
- 恢復已讀後「下一步」／未登入「登入／註冊後繼續」。36 項測試通過，新增已讀驗證、進入第二步及原對局不變回歸。桌機 1198／手機 375 的 2D 預覽按鈕可見可用。

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

### 2026-10-12 B 概念的 Canvas 幾何線稿選稿
- 依使用者要求先出選稿：新增 /preview/raven-geometric-study.html，A 稜月、B 斂翼、C 裂環三版。Logo 移除獨立羽毛，保留低首烏鴉與月亮，全部 Canvas 路徑 stroke，沒有貼圖或填色。
- 長讀取條用幾何羽軸／羽枝分段描線、揚動和細光流動；選稿明示模擬載入，尚未替換正式讀取。支援重播、背景暫停、DPR 與 reduced-motion。
- 瀏覽器三版無 JS 錯誤；375px 無橫向溢出，動態進度 13%→23%，reduced-motion 靜態 100%。截圖 raven-study-{A,B,C}.png。

### 2026-10-12 刺青參考逆向分析與選稿
- 使用者提供兔子混合幾何刺青、低多邊形烏鴉與三角動物構圖。設計判讀：先確立動物解剖輪廓，再由骨點／翼根分割；主輪廓、中等骨架、較淡定位線三層；幾何留出負空間，並允許主體局部突破框架。
- 新增 /preview/raven-tattoo-study.html：A 完整切面低首烏鴉與月牙、B 疏線鳥首與月弧中軸、C 展翼放射翼骨與三角框。保持米白淡金、Canvas stroke、沒有填色／貼圖；下方三版均固定已選定的 A 讀取條。
- 這是選稿，未替換正式開場。三版瀏覽器無 JS 錯誤、375px 無橫向溢出，截圖 raven-tattoo-{A,B,C}.png。

### 2026-10-12 移除烏鴉，改抽象元素選稿
- 最新需求不再使用鳥形，新增 /preview/night-symbol-study.html：A 月鋒（月相＋劍）、B 蝕環（月蝕＋軸線）、C 山月（山脊＋弦月）、D 月印（回紋＋月輪）。配色與 A 讀取條保留。
- 全部為 Canvas 線稿；compare=1 可看四款比較，still=1 為靜態 78% 選稿。未替換正式讀取畫面。
- 四款與比較頁瀏覽器無 JS 錯誤，375px 無橫向溢出。截圖 night-symbol-{A,B,C,D,comparison}.png。

### 2026-10-12 仙俠元素選稿
- 新增 /preview/xianxia-symbol-study.html，四組：A 疏梅映月、B 雪落山門、C 月下蓮華、D 飛羽流月。保持米白淡金、Canvas 無填色線稿及已選定的 A 讀取條；正式開場尚未替換。
- 提供 compare=1 比較圖與各款動態描線重播。瀏覽器四款無錯誤、375px 無橫向溢出；比較截圖 xianxia-symbol-comparison.png。

### 2026-10-12 梅、山、月組合
- 依使用者選定三元素新增 /preview/plum-mountain-moon-study.html：A 月抱山、B 梅越山、C 山映月、D 月中境；每款都含梅、山、月，改變主次、尺度與留白。
- 原米白淡金、無填色 Canvas 線稿、A 讀取條保留，尚未替換正式開場。四款與比較頁無 JS 錯誤，375px 無橫向溢出；比較圖 plum-mountain-moon-comparison.png。

### 2026-10-12 D 月中境：梅花重構
- 保留 D 月環、山形、軸線、米白淡金與 A 讀取條，只將梅花改為沿月環下緣的短枝、一朵連續五瓣梅及兩枚線描花苞，減少枝條突出感。
- 更新 /preview/plum-mountain-moon-study.html?design=D，仍為 Canvas 無填色選稿；正式開場未替換。
- 桌面瀏覽器無 JS 錯誤，375px 無橫向溢出，動態進度與減少動態模式檢查通過。截圖：docs/previews/september-polish/plum-mountain-moon-D-refined.png。

### 2026-10-12 D 梅枝四款構圖選稿
- 使用者否定前版月底單花的融合方式；以 D 原月環、山脊、軸線及配色固定，新增 /preview/plum-moon-D-variations.html：D1 探枝入境、D2 梅懸月上、D3 疏影越月、D4 一枝留白。四款共用原 A Canvas 讀取條，未替換正式開場。
- 梅花採疏密不等的五瓣描線、少量花蕊與折枝；以枝勢、位置和留白區別四款。compare=1 可並排並點入單款，手機改單欄。
- 四款瀏覽器無 JS 錯誤；375px 單款和比較页皆無橫向溢出，動態進度 15%、reduced-motion 100%，比較頁點選跳轉正常。截圖 docs/previews/september-polish/plum-D-variations.png。

### 2026-10-12 D3 疏影越月定稿與正式整合
- 使用者確認 D3。正式開場改用 D3 梅枝、山峰、月環 Canvas 線稿；沿用米白淡金及深色背景，長讀取條採已選定 A 幾何羽枝。
- lab/boot-symbol.js 為共享繪製器，首頁及 /home 都接至原生 progress 真實載入值；完成後完整顯示並停止動態，銜接原點燃布幕。隱藏分頁、hidden 開場及卸載停止 RAF，清理 observer/listener；reduced-motion 靜態呈現。
- 從 lab 原始碼與生成器整合，未改試稿；保留既有進站狀態與功能。48 項 labRuntime/stageIntro/homeIntro 測試、typecheck、349 檔 token lint 通過。
- 瀏覽器 1198/375px 2D 確認載入 85%、完成 100%、點燃後進站、無橫向溢出及無 JS 錯誤；3D 確認 data-stage=3d、100% 及 Canvas 圖形且無 JS 錯誤。reduced-motion 保留既有靜態入口。截圖 docs/previews/september-polish/plum-D3-production-{1198,375}.png。
- 補充：/home 共用開場瀏覽器確認載入 100%、Canvas 線稿有實際像素、無 JS 錯誤。

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

### 2026-10-12 報名底部資訊精簡

- Playwright 786×884、375×884：配置卡已移除、單一配置入口、無水平溢出，訪客可開啟配置登入視窗。截圖：`previews/september-polish/registration-compact-786.png`、`registration-compact-375.png`。
- 隔離瀏覽器驗證：未勾同意阻擋繼續；註冊登入後勾選同意可到資料步驟；點回第一步並前往配置，sportsEvent／preview／stage／returnTo=register 保留。登入目前會重新掛載報名，原同意需重新勾選，為既有流程。
- SportsbookBridge、Sportsbook、labRuntime 共 71 tests passed；typecheck、修改 TSX 的 ESLint 及 lint:custom 通過。

- 2026-10-12 同意列實機檢查：786／375px 勾選框與文字中心差均為 0px；點空白處可勾選與取消、點文字可勾選、Space 可切換、賽制連結導覽不改勾選狀態。截圖 `previews/september-polish/consent-aligned-{786,375}.png`。Participation.tsx ESLint 通過。

### 2026-10-12 三身分流程、BP 與管理活動工具

- 依使用者要求由報名者、觀眾、管理者三個 agent 分別實測並交叉驗收。新增正式條文 BP 與大會評段、求籤動畫及拖曳籤位、盤口命名／類型開關、抽獎庫存及頒獎紀錄、會員得獎收件畫面。
- 修復登入後已讀狀態遺失、停用下注類型未套用後續輪次、五人輪空預覽與實際配對差異，以及手機小工具視窗水平溢出。
- 首頁與 /home「更多 → 對局小工具」提供擲骰及交接式猜拳，完全獨立於賽事、先後攻與賽果。
- 最終 16 檔 179 項整合測試、typecheck、修改檔案 ESLint、364 檔 token 檢查通過。三身分桌機／375px 全流程通過；額外 786px 輪空與小工具狀態不變驗證通過。
- 本次為隔離本機完整流程驗收；正式 Hestia 權限、跨裝置與伺服器結算尚未驗證。分組為首輪對局，非多人隊伍賽；時間為實際秒數記錄。完整證據見 [ROLE_FLOW_AUDIT.md](ROLE_FLOW_AUDIT.md)。

### 2026-10-12 本機 mock 提交前驗證

- 全案 91 個檔案、904 項 Vitest 測試通過；以 LUNJIAN_SOURCE_ROOT=sources/lunjian/lab 驗證無需外部 scrollcraft 來源。
- production build、typecheck、全案 ESLint 與 364 檔 token 檢查通過。修復章節題字測試仍使用舊「報名表」名稱，改驗證目前「報名」18 筆畫。
- 來源與生成物隨倉庫保留；sources/lunjian 包含 367 檔来源及 SHA-256 清單。不刪除原工作區來源、既有瀏覽器資料或本機設計暫存。
- 三身分桌機／手機流程證據沿用 ROLE_FLOW_AUDIT；此次只有測試與移轉保存調整，未重跑所有瀏覽器場景。正式後端／跨裝置仍依 REALTIME_INTEGRATION 待辦。

### 2026-10-12 獎賞說明與操作列重構

- 獎賞下方窄版說明卡改為與頒獎席同寬的資訊列；桌機／平板左侧兩段說明、右側獨立操作區，使用細線與向右箭頭，移除行內中點分隔。600px 以下上下排列，兩個入口各保留 44px 以上觸控區。
- 保留原前三名卡片、獎項待公布文案及活動／配裝的 data 屬性與動態連結。正本為 lab/lunjian-layout.html，生成前確認 art/type/vendor 無目的地獨有或不同檔案，再執行 to-theatron.py。
- 1198／786／375px 瀏覽器驗證資訊列與頒獎席等寬對齊、手機堆疊、鍵盤焦點、動態 href、長文字及無橫向溢出；786px 另檢查一般動態場景。無 pageerror，截圖與幾何紀錄在 docs/previews/awards-footer/。
- labRuntime、LunjianRuntime、activityDisplay 共 53 測試通過；typecheck、364 檔 token 檢查通過。同步倉庫內 lab 快照與 manifest。

### 2026-10-12 獎賞移除多餘入口

- 依最新標註移除獎賞區的「我的參賽與角色設定／我的武學配置」入口，以及其箭頭、分隔和操作欄 CSS。兩段說明改為等寬緊湊文字列，寬螢幕左右排、手機自動換行；不保留空操作欄。
- 1198／786／375px 瀏覽器確認無獎賞操作連結、兩段文字與頒獎席等寬且無溢出／pageerror；高度為 58／58／87px。證據 docs/previews/awards-note/，labRuntime 34 測試通過。
- 經來源與目的資產核對後生成，並同步來源快照。
