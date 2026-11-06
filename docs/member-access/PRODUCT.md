# 論劍全站導覽與會員卷軸｜產品邊界

本文件記錄全站共用導覽與字體，以及 `/t/[slug]/login`、`/t/[slug]/signup`、`/t/[slug]/me` 的會員介面。導覽與字體適用根路徑、`/home`、會員頁與功能頁；中式裝裱卷軸用於會員頁；首頁原七章 UI 內容面板及行動導覽抽屜共用油紙與墨色。原 3D 世界、首頁場景、渲染引擎及既有互動保留，紙面只承接前景內容，場景仍從面板四周可見。

## 使用者與任務

參賽者以本屆遊戲 ID 進站，查看報名資料與角色配置；新參賽者填寫遊戲 ID、確認規則後報名。角色與參賽資料可留空，供裁判評段參考。必填資料與規則確認需清楚區分。

## 身分與流程

目前沿用遊戲 ID 識別，沒有密碼驗證。登入頁直接揭露此限制；不得加入不存在的密碼欄位、第三方登入或安全承諾。後端登入與報名契約保持既有行為。

報名完成後嘗試建立登入狀態。成功時前往「我的報名」；若登入未完成，明確告知報名已保存，引導使用相同遊戲 ID 登入，避免重複報名。錯誤、等待、報名截止與完成狀態保留原有功能。

## 全站導覽

品牌固定前往 `/home`；原七章標籤、順序及目的地一致：宗旨 `/#prologue`、規則說明 `/#rules`、讓武 `/#invitation`、報名 `/#register`、比武 `/#duel`、賽程 `/#schedule`、獎賞 `/#rewards`。會員專區捷徑維持可見。同一寬度下，各頁品牌、每個章節及會員捷徑應占用相同位置，不受舊頁樣式推移。

桌面呈現完整七章。1024px 以下由左側漢堡按鈕開啟向右滑入的左側抽屜，品牌置中、會員捷徑置右；不再以橫向捲動承載章節。抽屜支援進場、退場、懸停、按下及釋放回饋。Escape、背景遮罩、關閉按鈕與連結操作均可關閉；原生 dialog 提供焦點限制，關閉時按情境恢復焦點，展開時鎖住背景捲動。減少動態效果設定下立即開關。

根路徑與 `/home` 的產生式原始舞台使用相同控制器、幾何與動態樣式。`/loadout`、`/sportsbook` 使用全站標頭，正文與各自工具列預留固定標頭高度。

## 首頁內容與操作回饋

原七章保留原有內容、章節順序、角色插畫與 3D 場景；正文、說明、賽程與比武資訊面板使用共用油紙、墨色及集中 Noto h1–h3。首頁導入 `sources/lunjian/lab/paper-theme.css` 的可維護覆寫，由 generator 附加至產生結果，不直接另建首頁或替換場景引擎。

全站連結、按鈕與展開控制項透過 `web/src/app/interaction.css` 提供懸停、按下、釋放回復與鍵盤焦點回饋；停用項不接受按下／懸停回饋，減少動態設定停用過渡與縮放。比武人物剪影按鈕保留透明輪廓，以專屬 drop-shadow 回饋，避免通用效果形成矩形色塊。

## 會員介面與資料編輯

登入、註冊、等待／未登入狀態及已登入三個工作區使用中式裝裱卷軸：沿用茶褐、淺紙、墨色的既有色盤，增加裝裱邊與深木卷軸。每頁保留單一主標、可見表單標籤及原生控制項。所有文字使用 Google Noto TC；正文與數字為 Noto Sans TC，標題及品牌為 Noto Serif TC，h1 至 h3 集中管理。

登入及註冊的細框文字章改為 MemberSeal SVG 劍形朱印，桌面 52px、手機 44px；印章為純裝飾，語意由相鄰主標提供。登入移除「查看報名資料與角色配置。」引言，保留欄位必要的身分識別說明；註冊引言維持原文。

工作區以 overview／registration／character 切換個人總覽、我的報名與角色配置。桌面為側欄，手機為工作區展開選單，與全站抽屜分別服務不同任務。我的報名只編輯個人資料（personalOnly），角色配置只編輯角色欄位（characterOnly）。後端仍採完整記錄更新：儲存個人資料時保留角色資料；儲存角色配置時保留其他個人資料。儲存完成重新載入並顯示「已儲存，資料已更新。」；報名截止或連線未就緒時維持禁止編輯。

## 方法、來源與驗證狀態

本次依現行程式與已確認方向合併更新文件。參考 Taste Skill、Impeccable 與 Awesome DESIGN.md 的既有設計流程；參考檔未宣稱全域安裝。Impeccable launcher 不可用，採用參考文件與實作直接整理。

來源（相對於 theatron 專案根目錄）：`web/src/features/chrome/SiteNav.tsx`、`SiteChrome.tsx`、`site-navigation.css`、`navigationRuntime.ts`，`web/src/app/typography.css`、`interaction.css`、`layout.tsx`，`web/src/features/member/MemberPaper.module.css`、`MemberScroll.module.css`、`MemberSeal.tsx`、`MemberAccess.tsx` 及樣式、`MemberShell.tsx` 及樣式，以及既有 signup 功能、`web/src/theme/lunjian.json`、`packages/ui/src/tokens/semantic.css`。產生式舞台來源為 `sources/lunjian/lab/lunjian-layout.html`；首頁紙面覆寫位於同目錄 `paper-theme.css`，由 generator 附加。

材質重用既有 `/lunjian/art/bracket-card-light.webp` 水墨紙面圖，不複製素材、不新增點陣圖生成。卷軸桿使用 CSS 幾何；新表面移除手繪山形裝飾及 feTurbulence 顆粒紋理，導覽箭頭使用 SVG 幾何。

2026-10-13 本輪驗證：56 項回歸、32 項瀏覽器檢查（375／572／1074px）及 8 項修正後複驗通過；axe 零違規、runtime 零錯誤。實際 Codex 瀏覽器已確認 Three r170 canvas 可見，作為原 3D 世界仍在的證據；headless 3D 渲染檢查逾時，不能記為通過。`.next-paper-site-release` 已部署；公開網站登入、SVG、章末導覽及抽屜驗收通過。公開 /home 亦確認原 Three r170 3D canvas 正常可見。三項服務 ready，未執行實體重開機。



## 2026-10-13 主頁透明與玻璃導覽（最新覆蓋）

/home 主標及雙按鈕不再使用油紙底板；保留原 3D 山門、月亮、前景、雪景與 Noto 字體。僅主頁 nav 使用 38% 深色半透明玻璃與 14px 背景模糊，手機原左側油紙抽屜保留。七章內容與會員油紙不受影響。
已確認 lab 梅花總數 240（176 紅瓣、64 白花），但凍結 public 模組原為 0。生成器只把來源數量套到原 public 模組，產生 particles-plum.js，保留凍結雪粒子參數；layout importmap 使用新資產 URL。原 particles.js 不覆寫。
60 項既有回歸、token/ESLint/build 通過；375／572／1440px 導覽、焦點、CTA、透明樣式、reduced-motion 及會員入口驗收通過，axe/runtime 零錯誤。預覽與公開實際瀏覽器均目視確認立體紅瓣／白花。已部署 .next-home-glass-release，三項服務 ready，未實體重開機。驗收見 ops/releases/home-glass-20261013.json。


## 2026-10-13 導覽 CSS＋GSAP 互動

使用者指定華麗互動及每個導覽控制項的完整滑鼠事件。新增 navigationMotion.ts，由既有 navigationRuntime.ts 掛載，GSAP 控制抽屜 520ms 展開、260ms 關閉、45ms 項目錯開進場與 pointer/focus 狀態；CSS 負責漢堡旋轉細框、光線鋪展、箭頭位移、按壓及釋放回彈。涵蓋品牌、章節、會員／報名、開關與更多功能，所有公開同系統導覽共用。
使用 AbortController 清理事件、reset/killTweensOf 與 context.revert 清理動畫；取消按壓／移出／失焦恢復，reduced-motion 與執行期間設定切換即時處理。修正旧項目 blur 不能取消新項目的按壓。保留原生 dialog、Escape、焦點還原及鎖捲動。
16 項回歸、ESLint、token、TypeScript/build 通過；375／833／1440px 預覽與公開站所有可見導覽 hover／按壓／移出、快速三次開關、減少動態及首頁／七章／會員頁驗收通過，axe/runtime 零錯誤。已部署 .next-nav-motion-release，三項服務 ready。3D 背景、48 個梅花與玻璃主頁未修改。


## 2026-10-13 七章毛筆題字恢復

依使用者最新指定，宗旨、規則說明、讓武、報名、比武、賽程、獎賞改回原有 SVG 逐筆書寫及落印動畫。移除 web/src/app/typography.css 隱藏筆畫與偽元素文字替代的覆蓋，原 lab 引擎及字形資料無修改。七章題字為最新 Noto 字體統一規則的例外；其餘內文、表單及 h1–h3 設計系統維持。保留油紙區塊、原 3D 場景、48 個梅花與 GSAP 導覽。
48 項章節／lab 回歸、token 檢查、TypeScript／正式 build 通過。375／833px 本機及公開七章逐筆寫完、切章重播、無橫向溢出、reduced-motion 與靜態閱讀通過；1440px 本機規則與獎賞題字通過。這次未重跑 axe，也未重啟電腦。已部署 .next-brush-title-release，前台、後端與 Discord 閘道健康檢查 ready。


## 2026-10-13 全站閱讀與入口美術調整

依最新五項要求：全站 scrollbar-width:none 與 WebKit 捲軸隱藏，保留 overflow／原生滾輪／鍵盤。導覽寬度達 900px 時只顯示完整七章與會員入口，窄螢幕才顯示漢堡；開抽屜後放大視窗會關閉並把焦點放回可见品牌。登入書卷 1120px 上限、視窗對應高度，較窄標題欄與較寬表單、56px 操作區；手機單欄與 540px 卷面上限。會員印章改雙框直式論劍 SVG 字印。
首頁依 Taste 保留式重設與本地 KAGE 參考，採大比例 Noto 題字（桌機最高 144px）及主次按鈕（桌機高 64px、手機高 56px），主報名明亮實底、次了解賽制底線，原山門與 3D 場景未改。漫畫對白以 surface-dialogue 白色 token 與銳角邊框／偏移陰影統一，原序列的 caption 改為左右 24／48px、560ms 橫向淡入；保留順序、清理與 reduced-motion／靜態閱讀。
44 項回歸、ESLint、token、TypeScript/build 通過。320–1520px 視覺檢查；本機及公開站導覽斷點、抽屜 Escape／焦點／放大視窗、登入必填、三章真實橫向淡入、滾輪及 PageDown、減少動態與入口路由驗收通過，登入 axe AA 無違規。實際 Codex 瀏覽器為 reduced-motion，確認靜態備援；本輪未另重測 3D 性能及實體重開機。部署 .next-ui-refinement-release，三項服務 ready。


## 2026-10-13 報名整理、原版場景與明暗模式

依使用者要求精簡正式報名：移除賽事名稱展示及冗長說明，新增前往登入入口，桌機雙欄／手機單欄，四項角色配置與規則版本契約不變。沒有重新命名後端活動。比武移除紙面幾何覆蓋，恢復滿版雙俠、中央 VS 及腳下資料；賽程保留原紅藍名帖與分輪邏輯，改用 72% 紙色及 12% 紋理的半透明遮罩。
右上角新增明暗切換，localStorage 保存並同步同源分頁；首次繪製前恢復色盤。主導覽、抽屜、會員、表單、卡片與舊備戰主要表面共用語意色彩。太陽／月亮交換，尊重 reduced-motion；原 3D 與 48 個梅花配置未改。會員入口改高對比實底，漢堡改正方框等長雙線，取消傾斜菱形。
71 項相關回歸、ESLint、token、TypeScript／build 通過；同版預覽與公開站 51 項檢查涵蓋 320／375／900／1280／1440px、模式保存與分頁同步、導覽邊界、抽屜 Escape／焦點／resize、表單必填、比武及賽程幾何。淺／深色報名頁 axe AA 無違規，runtime 無錯誤。場景測試採顯式 2D 備援，本輪未重測實際 3D 性能或重開機。部署 .next-interface-ready-release，三項服務 ready。
