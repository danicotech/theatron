# Theatron 本機開發服務

## 啟動

以下命令在 `theatron/` 目錄執行。

```powershell
pnpm --filter @theatron/web dev --hostname 127.0.0.1 --port 3000
```

開啟 [論劍首頁](http://127.0.0.1:3000/)。伺服器需保持程序運行；這不是開機自動啟動服務。停止時在啟動它的終端按 `Ctrl+C`。若 port 被占用，先確認是否已經是本專案的服務並重用，不要直接終止未知程序。

專案要求 Node.js >= 22。本輪環境為 Node.js 24.12.0、pnpm 10.16.1，已有 node_modules，無須重新安裝。初次建立環境才執行 `pnpm install --frozen-lockfile`；生成 API 不是單純啟動預覽的必要步驟。

## 預覽入口

| 網址 | 用途 |
| --- | --- |
| [首頁](http://127.0.0.1:3000/) | 目前論劍七格，預設含現有場景與開場行為 |
| [3D 混合場景](http://127.0.0.1:3000/?stage=3d#register) | 報名、對決及獎賞保留原場景與局部漫畫 UI |
| [正式讓武](http://127.0.0.1:3000/#invitation) | 六類 36 項限制，分類連結可展開全文 |
| [2D 預覽](http://127.0.0.1:3000/?stage=2d&intro=0) | 版面檢查，減少 3D 干擾 |
| [三版墨韻試映](http://127.0.0.1:3000/lunjian/motion-study.html) | A／B／C 重播、暫停、拖曳與整站試用 |
| [靜態閱讀](http://127.0.0.1:3000/?view=reading) | 長文閱讀模式 |
| [備戰方案](http://127.0.0.1:3000/loadout) | localStorage 配裝、倉庫與 JSON 匯出 |
| [元件展示](http://127.0.0.1:3000/kitchen-sink) | 展示元件、主題及尺寸 |
| [裁判登入](http://127.0.0.1:3000/judge/login) | 可檢查登入畫面，實際登入需要後端 |

localStorage 依來源隔離。固定使用同一 hostname 與 port；`localhost:3000` 與 `127.0.0.1:3000` 的既存配裝不互通。換來源前可在原來源匯出 JSON。

## Hestia 後端

`web/next.config.ts` 在 `HESTIA_URL` 有值時，才把 `/api/*` 轉送到該 Hestia 位址。`web/src/lib/api/client.ts` 預設使用同源 `/api`；不要僅為本機開發改成跨來源呼叫。

本輪啟動程序未設定 `HESTIA_URL`、`NEXT_PUBLIC_PLATFORM_API_URL`，`web/` 也沒有環境設定檔；工作區未見兄弟專案 `hestia/`。目前確認的是前端服務，不是完整後端環境。

後續需要真實登入、報名、賽程資料或投注時：先取得並驗證可用的 Hestia 開發服務，在 `web/.env.local` 設定 `HESTIA_URL` 為該服務 origin，再重啟 Next。不要編造位址、帳號、活動 slug 或憑證。不要把環境檔提交。

## 從 lab 同步頁面

先檢查 [MERGE.md](../../scrollcraft/builds/lunjian/MERGE.md) 與原始／生成檔的未提交修改。以下命令從 `theatron/` 執行，僅在對應原始檔變更後使用：

```powershell
# 首頁
python ../scrollcraft/builds/lunjian/lab/tools/to-theatron.py

# 備戰方案
python ../scrollcraft/builds/lunjian/lab/tools/loadout-to-theatron.py
```

腳本以自身位置解析來源與輸出位置，會替換其管理的素材子目錄；執行前核對目的地位於本專案 `web/public/`。本輪未改頁面，未執行生成器。

## 檢查命令

```powershell
pnpm typecheck
pnpm lint
pnpm lint:custom
pnpm test
pnpm build
```

按實際變更選擇檢查，記錄退出狀態。視覺與互動需要瀏覽器驗證，不能用 HTTP 200 或單元測試代替；沒有後端時也不能把載入頁面算成業務成功。

## 本輪啟動紀錄 — 2026-09-20

- Next.js 16.3.4（Turbopack）啟動成功，監聽 `127.0.0.1:3000`。
- HTTP 200：`/`、`/loadout`、`/kitchen-sink`、`/judge/login`。
- HTTP 200：`/lunjian/lunjian.css`、`/lunjian/lunjian.js`、`/loadout/loadout.js`。
- 瀏覽器已開啟首頁並讀取「論劍｜月下論劍」與七項導覽。
- 本次只新增工作指引與規劃文件，未改產品程式碼，未執行完整測試／production build；未驗證後端與所有互動。

這是有日期的啟動紀錄，後續工作要重新確認服務是否仍在線。


## 賽程與比武交接預覽

- [完整示範樹](http://127.0.0.1:3000/?preview=1&phase=live&stage=3d#schedule)：點場次進入比武；點角色查看裝備示範，模擬下注可產生本地示範注單。
- [目前比武](http://127.0.0.1:3000/?stage=3d#duel)：透明 VS 疊加原場景。未配置活動時不使用虛構玩家當正式資料。
- `?match=` 保留指定場次；正式盤口連結帶 `?player=...#markets`，選定角色不會自動投注。


### 示範管理

在 `/?preview=1&phase=finished&stage=3d#schedule` 按「編輯」，點場次／名帖／冠軍即可編輯。可交換首輪玩家、設定比分及本場勝者；後輪按前場結果晉級。管理列有紅藍方互換、效果重播、復原與還原。此功能僅改本機示範，localStorage key 為 lunjian.bracket-editor.v1.[phase]。正式資料請走 /judge/[slug]；已結算結果任意更正尚無後端契約。


編輯模式的「報名者」支援搜尋／新增。拖曳姓名至首輪，或點選姓名後用「目標首輪籤位 → 放入籤位」完成同一操作；已排入者會互換。按「檢視」收起工具恢復原有選手／比武入口。所有變更仍為瀏覽器內示範。


## 運彩本機試玩

[運彩中心](http://127.0.0.1:3000/sportsbook) 可獨立使用；首頁新增「運彩試玩」及會員點數。`?preview=1` 的比武投注改接 IndexedDB 試玩中心，取代上述舊「不扣點注單」說明；只有本機模擬點數會變動。完整使用流程見 [SPORTSBOOK_DEMO.md](SPORTSBOOK_DEMO.md)。正式 API 仍需 Hestia。


2026-09-21 運彩交付確認：既有 Next 服務仍監聽 127.0.0.1:3000；首頁與 `/sportsbook` HTTP 200。production build 通過但未取代或關閉開發程序。瀏覽器面板已排入 `/sportsbook` 開啟請求；這不是實機操作驗證。


## 2026-09-22 本機完整流程預覽

預覽原服務已停止，已以隱藏 Node 程序重新啟動 Next dev（127.0.0.1:3000）。`/`、`/sportsbook`、`/loadout`、`/lunjian/lunjian.js`、`/loadout/loadout.js` 均 HTTP 200，服務保持運行。從 `/sportsbook?mode=manage` →「另開一屆試玩」→「開放會員報名（空白名單）」開始；參賽入口會帶活動 ID。操作見 SPORTSBOOK_DEMO。此為本機資料流程，不需 Hestia。

## 2026-10-12 環境移轉：已有後端，待串接

使用者已確認 Hestia 後端存在，將換環境後再開發；上文「工作區未見」僅表示目前 checkout 沒有後端，不表示需要重建。

切換後從 [即時同步交接規格](REALTIME_INTEGRATION.md) 開始：核對既有 WatchTournament 契約、同源登入及首個 heartbeat，接續房間／私人更新契約與前端。web/src/features/realtime/、match-tools/ 已預留說明；目前沒有啟動 WebSocket、SSE 或 ConnectRPC 訂閱服務，原本輪詢與本機試玩行為維持。

## 獨立 clone 的前端原始碼

首頁／配置頁的生成物及 [lab 來源快照](../sources/lunjian/README.md) 已隨倉庫保存。單獨 clone 可以跑 pnpm dev、pnpm test、pnpm build，不依賴兄弟 scrollcraft。來源解析可用 LUNJIAN_SOURCE_ROOT 指定；正式 API 生成仍需 Hestia。

目前 scripts/verify-*-browser.mjs 的歷史驗收腳本含原開發機 Playwright 路徑，換機需要先調整為可用的安裝路徑；這不影響前端啟動與 Vitest 測試。
