# 會員註冊與賽事報名

2026-10-14：依使用者定案，註冊與報名分開。

- `/t/[slug]/signup` 僅收名稱、Discord @使用者名稱、密碼。
- `/t/[slug]/enroll` 先核對會員，再選擇已保存武庫並確認，最後填參賽資料。
- 論劍段位、常用武學皆為下拉選單；常用武學讀取既有武庫 catalog。積分不再出現在表單或摘要；修改舊報名時保留歷史積分資料。
- 可出賽時段為日期、開始及結束時間，可增加／移除最多 20 組。拒絕不完整、倒序與同日重疊時段。跨日分兩組，時段以網站所在地台灣時間解讀。
- 時段以 `YYYY-MM-DD HH:mm–HH:mm` 逐行保存，修改時還原成原生 date/time 控制項。舊文字資料保持可見，使用者可明確移除。
- 報名與會員修改共用 RegistrationFields、MartialSelect、AvailabilityFields。
- 武庫仍保存在目前瀏覽器，報名保存的是確認時的配置快照。更改候選方案後需再次確認，不會默默覆寫已確認配置。
- 武庫前往會員的返回網址帶 loadoutRole；會員頁預覽新方案並要求確認與儲存。
- 比武選手配置彈窗在 #main 外，獨立使用成套主題語意色。原本固定米色底配深色主題淺文字的衝突已移除。

## 驗收

執行 SignupForm、AvailabilityFields、MyPlayer、RegistrationBridge、TournamentHome 測試，TypeScript、ESLint 與 Next production build。瀏覽器檢查比武彈窗 Light／Dark 及 390px 寬度。

## 發布

前端須與新增 Member Auth RPC 的後端同批上線。正式部署前先確認舊報名綁定安排；不能僅憑公開遊戲 ID 自動認領既有報名。隔離預覽不等於正式部署。


## 2026-10-15 入口與實際流程驗收

未登入只顯示「先登入，再報名」及註冊／登入入口，不暴露報名表。新版註冊、選擇武庫、配置器返回與確認、段位／武學下拉、兩組日期時間、報名保存、會員讀回及登出已在隔離資料庫完成實際瀏覽器驗收。46 項前端測試、ESLint、token 檢查通過。原生日期／時間 input 即時同步，增減列不遺失其他列；常用武學清單非同步載入後維持原選項；390px 明暗模式無水平溢位，時間含分鐘完整可見。

使用者確認正式資料庫的 7 筆未綁定報名皆為真實資料，須核對後綁定新帳號。保留所有舊報名與比賽資料，不按名字、Discord 自填名稱或遊戲 ID 自動綁定。頁面提示既有參賽者註冊後聯絡主辦核對，不重複報名。目前未收到任何經核對的新帳號對應，尚未執行綁定。上線前後需明確告知：舊遊戲 ID 登入停止，新帳號需完成核對綁定才可修改原報名。

## 2026-10-15 正式上線

使用者同意新版立即上線，表示不需要舊資料，以資料庫為準。本次沒有執行舊資料配對、匯入或刪除；不把舊資料綁定列為上線前置條件。

正式服務已切換至 `.next-member-enrollment-release` 與已驗收會員後端。前後端及 Discord 閘道健康檢查均為 ready。正式 `/t/2026-baiye-shifeng/enroll` 與首頁報名區均顯示先登入／註冊引導，註冊頁只有名稱、Discord 使用者名稱及密碼。正式環境僅唯讀驗證，沒有建立測試帳號或測試報名。部署後資料庫仍為 7 筆報名及 7 筆選手，均未自動綁定。

部署備份及服務狀態見 `ops/releases/member-enrollment-20261015.json`。前端 46 項測試及正式編譯通過；完整填寫與保存流程已在隔離資料庫驗證。


## 2026-10-15 Discord 驗證與完整會員流程

此節取代上方舊註冊入口說明。首次 Discord 授權自動建立會員，取得名稱、使用者名稱與經驗證的數字 ID；不要求另設站內密碼。舊密碼帳號入口收合保留。自行填寫的 Discord 名稱或數字 ID 不授予管理權。

- 報名入口直接授權並回到報名；已報名會員自動恢復活動登入。觀眾不用報名即可查看注單。
- 登入保留目的頁（報名、指定對戰、注單或管理賽事），僅允許站內已知路徑。未指定目的頁時管理員進 `/judge`，會員進會員專區。
- 正式管理員名單由後端環境變數 `PLATFORM_DISCORD_ADMIN_IDS` 維護，以逗號分隔數字 ID。只有資料庫中完成 Discord OAuth 的身分可匹配；停權、刪除或未登記操作仍拒絕。無須改 schema，既有角色授權保持有效。
- 注單登入前保存的只是未送出草稿，所有成立、餘額、結果以後端資料庫為準。登入後仍須確認下注，連線中斷重試沿用同一冪等鍵，避免重複扣款。
- 已於獨立測試資料庫驗證四人報名、評段、抽籤、開盤、下注、封盤、四場 BO3、晉級、結束賽事及注單結算；未寫入正式賽事或正式注單。另驗證普通會員無管理權、冒填 ID 不提權、移除名單及停權立即拒絕。
- Discord 真實帳號首次授權需由帳號持有人操作；自動測試以模擬 Discord provider 驗證 OAuth 與身分授權，不能當作真實帳號已完成授權的證據。

發布時前後端需同批部署，更新管理員環境變數並重啟；保留上一版 binary/config，健康檢查失敗回復。此變更不刪除、不認領既有報名資料。

### Discord 流程正式發布驗收

2026-10-15：已發布 `.next-discord-userflow-release` 與對應後端；服務健康檢查 ready。後端管理員環境名單已設定，只匹配經 Discord 授權驗證的身分。正式註冊頁、登入回程、Discord 302 跳轉及 OAuth 錯誤返回入口已驗證。58 項前端測試、7 個後端套件測試、TypeScript、ESLint、語意 token 與 production build 通過。隔離資料庫完成四人、四場 BO3、開封盤、晉級、完賽、注單派彩與冪等重送驗證；正式資料未因驗收寫入。真實 Discord 帳號授權由帳號持有人完成。

服務備份與狀態記錄：`ops/releases/discord-userflow-20261015.json`。公開入口：`/t/2026-baiye-shifeng/signup`、`/judge`。既有 `/login` 保留單一 route 以支援 Discord bot 舊連結，沒有同名 page 衝突。

### 2026-10-15 管理權限改以資料庫為唯一來源

此節取代上方 PLATFORM_DISCORD_ADMIN_IDS 授權方式。指定 Discord 帳號已完成 OAuth，已綁定資料庫 `admin` 角色並留下同交易稽核紀錄。伺服器只依 `user_roles`、`role_permissions`、有效期間、軟刪除與停權狀態決定管理權；環境名單授權程式已移除。無 schema 變更，新增管理員不需重新部署。網站上的角色管理介面／RPC 尚未實作，現階段由受控維護操作授予及撤銷。

結構與維護界線見 `hestia/docs/ADMIN_AUTHORITY.md`；發布及備份見 `ops/releases/db-authority-20261015.json`。


## 2026-10-15 會員入口與武庫操作精簡（本次修正）

此節取代舊「既有帳號」入口：註冊上方直接輸入 Email、帳號與密碼，成功即登入並返回原目的頁；登入為帳號與密碼。兩頁下方都提供 Discord 快速註冊／登入。Email 寫入既有 platform.users.email，不另加 schema，不依 Email 自動連結帳號。管理權仍只由經 Discord 驗證的身分及資料庫授權決定。

會員報名武庫為響應式兩欄：左側配置入口與四格預覽，右側個人段位、論劍段位及自己的 BP。未配置顯示線框；武庫保存返回後顯示所選方案，明確確認才套用參賽配置。開賽後個人武庫仍可編輯，參賽快照不可修改。BP 未配對或讀取失敗不補造數值。

武庫主工作區放寬至最多 1800px，頂部改三步驟列及可鍵盤操作、有無障礙名稱的匯入／匯出圖示。奇術選單與已選槽位共用古籍書冊外觀，保留完整名稱。手機工具列分行，44px 步驟與圖示維持可點擊；桌機三欄、手機分區既有流程保留。江湖雅戲入口改成置中卡片，移除重複介紹。

72 項相關前端回歸、TypeScript、ESLint、token 檢查通過。後端 identity、transport、server 測試通過；隔離資料庫實測 Email 保存、註冊自動登入、原始密碼、重複帳號拒絕及不授管理權。identitypg 的 Docker 測試套件在本機沙箱無法啟動，已用隔離服務與真實資料庫補驗本次註冊路徑。瀏覽器確認武庫選擇返回會員、375px 無水平溢位、Light／Dark 書冊與工具列。Discord 外部授權本輪未重跑；正式賽事、注單及管理員資料未改動。

## 2026-10-17 — Confirmed database loadout and member overview
- CharacterConfig.snapshot_json is a versioned, validated equipped-item display snapshot in the existing character JSONB. No schema migration. Includes selected style, two weapons, six gear slots, martial skills, minds and arts, with complete displayed base/affix values. Excludes unequipped warehouse items and private registration notes. Legacy summary-only rows remain readable; missing numeric details are never fabricated.
- Register and UpdateRegistration persist the same snapshot; phase guards still reject changes after competition starts. GetBracket and GetMatch explicitly project each stored player's confirmed character. ListPlayers does not expose unpublished loadouts. The frontend public projection passes the payload through to the shared cards; a valid saved snapshot needs no browser storage or catalog substitution.
- Member armory uses the confirmed snapshot when saved/locked. Returning to edit or choosing a new draft still requires explicit confirmation. Public formal dossier does not fall back to demo data.
- MemberProfile returns the existing users.avatar_url; account overview shows avatar/name/handle/account type/enrollment/Discord state (and game ID/rank when enrolled). Initials fallback handles missing or failed images. Removed repeated overview links; administrator entry now resides in the sidebar. Header logout retained.
- Verification: 10 related frontend test files / 95 tests passed, core tournament/signup/identity and transport tests passed, PostgreSQL storage tests passed. Separate API→PostgreSQL→own/public match/bracket roundtrip passed for two isolated players, including invalid snapshot rejection, private-note exclusion and post-start locking. No production registrations were written.
- Browser verification: actual database-backed public player popup for both isolated players, Light/Dark desktop and 390px single-column mobile; member armory reads the same snapshot without a local library. Overview verified desktop/mobile, Light/Dark; formal administrator avatar, sidebar management entry and logout are visible. No browser errors on formal member page.
- ESLint and semantic token checks (442 files), production TypeScript/build passed. Deployed .next-confirmed-dossier-release plus the matching backend with rollback backups; all services healthy. Production bracket is currently unpublished, so full player-popup verification used the isolated database, not production fixtures. Older summary-only registrations require the player to confirm their loadout again before the match starts to save complete numeric details.


## 2026-10-17 — 開賽前後參賽配置狀態
- 會員武庫分開顯示「個人武庫」與本屆參賽配置。私人編輯入口始終開放；開賽前顯示可更換／待確認，按「確認更新參賽配置」才寫入。開賽後顯示鎖定提示與鎖頭，移除方案選單與確認按鈕。
- 實測發現成功更新後，即時狀態同步會重新消費 loadoutRole，造成已保存卻回到待確認。修正為每次掛載只接受一次交接；確認成功後清除交接參數，重新整理維持已確認顯示。失敗不清除交接、不顯示成功。
- 隔離賽事 lock-flow-mvcc58jr：原參賽 101.5，個人武庫 88.8，選擇後未確認時後端維持 101.5；確認後保存 88.8。報名截止後再次確認成功，後端讀回 phase SIGNUP_CLOSED。經評段／抽籤／確認賽程進 IN_PROGRESS，畫面自動移除更換操作。
- 開賽後 UpdateRegistration 更換請求被拒絕且快照不變。私人武庫經編輯視窗改為 66.6，保存返回後參賽仍 88.8；個人編輯不受鎖定影響。正式資料未修改。
- 前端 5 個相關測試檔共 38 項通過（其中鎖定選單預期修正後重跑該檔通過），後端 TestCompetitionLoadoutLocksAtStart 通過；ESLint、443 檔 token 檢查與正式建置通過。
- 已發布 .next-loadout-lock-release，服務健康。桌機開賽前／後與 390px Light/Dark 實機驗證，無水平溢出。
