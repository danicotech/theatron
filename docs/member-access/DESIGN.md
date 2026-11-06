---
name: 論劍全站導覽與會員卷軸
description: 保留 3D 世界，首頁內容共用油紙墨色，會員卷軸使用劍形朱印與 Noto TC
colors:
  surface-auth-canvas: "#b7a58c"
  surface-auth-paper: "#ede0c5"
  surface-auth-field: "#f7eddb"
  text-auth-ink: "#322c24"
  text-auth-muted: "#675846"
  border-auth: "#9b886c"
  accent-auth-action: "#654a35"
  state-auth-ready: "#3e603e"
  state-live: "#b8241c"
typography:
  display:
    fontFamily: "Noto Serif TC, serif"
    fontSize: "clamp(32px, 4.5vw, 48px)"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.08em"
  headline:
    fontFamily: "Noto Serif TC, serif"
    fontSize: "clamp(26px, 3vw, 32px)"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.08em"
  title:
    fontFamily: "Noto Serif TC, serif"
    fontSize: "clamp(20px, 2.2vw, 24px)"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.08em"
  body:
    fontFamily: "Noto Sans TC, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Noto Sans TC, sans-serif"
    fontSize: "13px"
    fontWeight: 700
  game-id:
    fontFamily: "Noto Sans TC, sans-serif"
    fontSize: "16px"
rounded:
  control: "0"
  roller: "4px"
spacing:
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-6: "24px"
  space-8: "32px"
  heading-gap: "0.6em"
components:
  button-primary:
    backgroundColor: "{colors.accent-auth-action}"
    textColor: "{colors.surface-auth-field}"
    rounded: "{rounded.control}"
    padding: "8px 24px"
  button-primary-hover:
    backgroundColor: "{colors.text-auth-ink}"
  input:
    backgroundColor: "{colors.surface-auth-field}"
    textColor: "{colors.text-auth-ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  paper:
    backgroundColor: "{colors.surface-auth-paper}"
    textColor: "{colors.text-auth-ink}"
    padding: "56px 40px"
  navigation:
    height: "72px"
  navigation-mobile:
    height: "64px"
  navigation-drawer:
    backgroundColor: "{colors.surface-auth-paper}"
    textColor: "{colors.text-auth-ink}"
    width: "min(380px, calc(100vw - 32px))"
  member-seal:
    width: "52px"
    height: "52px"
  member-seal-mobile:
    width: "44px"
    height: "44px"
  alert:
    textColor: "{colors.text-auth-ink}"
    padding: "12px"
---

# Design System: 論劍全站導覽與會員卷軸

## Overview

**Creative North Star: "茶案上的中式卷軸"**

延續茶褐環境、淺紙表面與墨色文字，將會員紙面整理為具裝裱邊、深木卷軸桿與題款的中式卷軸。材質安靜，表單與狀態仍以清楚、可讀、可操作為先；使用現有水墨紙面資產，不新增山形插畫或程式噪聲。

全站共用原論劍的品牌、七章及會員入口位置，手機以左側抽屜承接章節。全站字體與 h1–h3 集中管理；會員卷軸適用登入、註冊及已登入工作區，等待與未登入狀態容器亦套用同一卷軸。原 3D 世界、首頁場景與渲染引擎保留；原七章的前景 UI 內容面板改用同一油紙、墨色與 Noto h1–h3，場景持續從面板四周可見。紙面覆寫與引擎分開維護。

**Key Characteristics:**

- 全站導覽在相同視窗寬度保持相同幾何與逐項位置。
- Google Noto TC 統一文字，宋體標題與黑體正文分工。
- 首頁七章在原 3D 世界前呈現油紙面板；會員表面保留裝裱與木軸，入口題款使用劍形朱印。
- 動態用於導覽開關與操作回饋，尊重減少動態設定。

## Colors

### Primary

茶墨行動色（`accent-auth-action`）用於提交、選取及會員焦點；懸停提交按鈕使用墨黑正文色。

### Neutral

茶褐畫布承接會員全頁；油紙承接會員內容、首頁七章內容面板與行動抽屜；淡紙欄位區分輸入及資訊表面。墨黑承載正文，淡墨承載輔助文字，茶線界定欄位與裝裱。木桿沿用既有 `surface-wood`，不建立第二套木色。

就緒狀態沿用 `state-auth-ready`，錯誤及印章沿用 `state-live`。顏色不能單獨承擔狀態意義。既有 palette 與 sidecar 展示色階保持原值。

**The Scoped Paper Rule.** 會員由 MemberPaper 映射 auth 色，原首頁由 lab 的 paper-theme.css 將相同色系映射至前景內容面板與文字。3D 世界、場景與引擎保留；紙面不覆蓋整個場景。抽屜使用相同紙色，其他頁標頭繼承頁面語意色。

## Typography

所有文字從 Google Fonts 樣式表載入 Noto Sans TC／Noto Serif TC。正文、表單、數字與原本等寬角色使用 Noto Sans TC；h1–h3、品牌及標記為 display 的題款使用 Noto Serif TC。程式碼、pre 與 mono 數字角色使用 tabular-nums。舊 Arial、書法字體與 IBM Plex Mono 不再作為新字體系統的獨立角色。

frontmatter 的 display／headline／title 分別對應 h1／h2／h3；字級、粗細、行高、字距與標題下間距由 `web/src/app/typography.css` 統一。局部樣式即使仍含舊字級，也不構成另一套規範。主標在小螢幕到桌面連續縮放，取消登入與工作區分別指定的桌面／手機標題尺度。正文與控制項保留內容所需字級，輸入欄位保持 16px。

**The One Heading Rule.** 登入、註冊與會員工作區各保留唯一 h1；分頁內容、表單、狀態與完成訊息使用適當下層語意。原章節書法圖形標題改以相同字體的可讀文字呈現。

## Layout

全站固定標頭由 `site-navigation.css` 管理；高度見 navigation 與 navigation-mobile。桌面（1024px 起）內容上限 1440px，左右至少 32px 並考量安全區；三欄為 160px／彈性中央／160px。品牌置左、七章置中、會員入口置右，每章至少 44px 寬高，避免舊舞台樣式造成逐項偏移。

1023px 以下左右至少 16px，三欄改為 100px／彈性中央／100px；漢堡按鈕置左、品牌置中、會員捷徑置右，七章在抽屜內直列。抽屜滿高 100dvh，可獨立垂直捲動，內文左右 24px、章節至少 56px 高。全站內容依標頭高度及安全區留白；`/loadout`、`/sportsbook` 的正文與工具列亦預留相同高度。

會員外層至少 100svh。登入紙面上限 960px，兩欄 0.8fr／1.2fr，欄距 48px、內距見 paper，上緣間距 40px；註冊單欄上限 820px。767px 以下登入改為單欄、上限 560px、內距 32px／20px；380px 以下為 28px／12px。桌面登入題款直書，手機橫書；註冊主標保持橫書。

會員工作區上限 1200px、內距 40px，側欄 200px；1023px 以下側欄 176px、內距 32px；767px 以下單欄、內距 24px，工作區選單使用展開按鈕；380px 以下內距 16px。此選單與全站抽屜互不混用。文字可換行、內容欄 min-width 為 0，表單控制項最小高度 48px。

首頁七章的覆寫以 `sources/lunjian/lab/paper-theme.css` 為可維護來源，由 generator 附加。七章章節容器保持透明，油紙只用於漫畫內容、報名、獎賞、賽程、對戰資訊與首頁文字面板。比武插畫與資訊分開排列，資訊位於圖像下方，窄螢幕縮小面板留白；不另起一套首頁或移除原場景。

## Elevation & Depth

卷軸靠裝裱邊、雙木桿與紙張陰影呈現厚度，表單欄位保持平面。共用卷軸樣式提供紙面外陰影及內陰影；入口與工作區容器另有既有紙面陰影，實際合成以載入順序及 computed style 為準。sidecar 分別記錄來源，避免將一個陰影誤稱為全站唯一陰影。抽屜有向右的投影，遮罩區分前景與不可操作背景。

紙面及抽屜使用既有 `/lunjian/art/bracket-card-light.webp` 水墨紙面圖；來源為專案既有主題素材，本次僅引用路徑，沒有複製或新生成點陣圖。新表面不再引用 `oiled-paper-grain.svg`／feTurbulence 顆粒，也不使用手繪山形裝飾。

## Shapes

控制項、紙面及章節連結維持直角。卷軸桌面裝裱側邊 20px、上下 12px，木桿寬 16px、超出上下 24px；手機裝裱側邊 10px、上下 8px，木桿寬 12px、超出上下 18px。木桿以 CSS 漸層、端頭與輕微圓角塑造，不需額外圖片。

欄位及分隔使用細線；章節目前位置與懸停使用底線，鍵盤焦點使用外框。漢堡與關閉圖形由線段構成，箭頭使用 SVG 幾何，不以 Unicode 符號冒充圖示。

## Components

### 全站導覽

保留品牌 `/home`；七章依序為宗旨 `/#prologue`、規則說明 `/#rules`、讓武 `/#invitation`、報名 `/#register`、比武 `/#duel`、賽程 `/#schedule`、獎賞 `/#rewards`。會員捷徑維持既有賽事會員目的地。相同寬度的品牌、每個章節與會員入口保持一致座標；原始舞台及 React 頁面共用控制器。

抽屜從左側進場（380ms），向左退場（230ms），控制器在 240ms 結束關閉流程。懸停底線／背景及圖示位移為 180ms；按下時下移 1px、縮至 .97，70ms 回饋，釋放回復。進場採 `cubic-bezier(0.22, 1, 0.36, 1)`，退場採 `cubic-bezier(0.4, 0, 1, 1)`。減少動態模式停用動畫與過渡並立即關閉。

原生 dialog 以 showModal 開啟，初始焦點置於關閉按鈕，提供原生焦點限制。Escape、外部遮罩、關閉與連結操作觸發關閉；一般關閉恢復漢堡按鈕焦點，連結離開不額外強制恢復。開啟時保存並鎖住 body overflow，完成關閉時還原；跨越桌面斷點或卸載時清除開啟狀態、事件及計時器。

### 首頁油紙內容面板

原七章沿用既有內容、位置與操作邏輯；面板使用現有水墨紙面圖、淺紙底、墨色文字及茶線。舞台與場景容器保持透明，讓既有動態世界在面板外仍然可見。元件樣式調整集中在 lab 的 paper-theme.css，產生器附加這份覆寫。

### 會員卷軸與工作區

卷軸承接靜態內容，非可點擊卡片。題款、裝裱與木桿共用 MemberScroll，內容排列仍由入口／工作區容器負責。登入及註冊以 MemberSeal 的 SVG 劍形朱印取代細框文字章；實心紅印與鏤空劍形幾何，桌面 52px、767px 以下 44px，靜態旋轉 -3deg。印色由既有 state-live 與 surface-wood 混合，不新增色盤。SVG 使用 aria-hidden、focusable=false，不攔截指標事件；意義由相鄰主標提供。登入刪除「查看報名資料與角色配置。」引言，註冊引言維持。會員側欄用 aria-current 指示位置，目前項為茶墨實底與淡紙文字；手機展開選單切換後收合。

### 表單、按鈕與狀態

保留可見標籤、原生輸入與提交中／停用行為。提交按鈕為茶墨實底，登入全寬；全站操作回饋由 interaction.css 管理：懸停為輕墨色覆層，按下縮至 .975 並加深回饋，釋放回復；一般過渡 180ms，按下 70ms。焦點為 2px currentColor 外框、外距 4px。停用項保留禁止操作游標並排除懸停／按下回饋；reduced motion 停用過渡與按下縮放。特定導覽控制器保留其進退場與按下幾何。登入／註冊頁籤以 aria-current 與底線標記位置，最小高度 48px。

資料檢視窄螢幕將標籤與值上下排列。personalOnly 與 characterOnly 分別呈現欄位，完整記錄更新時保留其他資料；成功使用 role=status，錯誤使用 role=alert、淡紅底與細紅線。註冊已成功但登入失敗時，保留已儲存訊息與登入入口。

比武人物剪影按鈕覆寫通用懸停／按下 box-shadow；懸停使用沿透明輪廓的 drop-shadow，避免在角色四周出現矩形背景。此例外只調整回饋輪廓，保留鍵盤焦點與可操作性。

## Do's and Don'ts

### Do:

- Do 從共用導覽、typography.css、interaction.css 更新幾何、標題與操作回饋；首頁面板在 lab 的 paper-theme.css 維護。
- Do 檢查同一視窗寬度各頁每一個導覽項的位置，而不只檢查外框。
- Do 保留 Google Noto TC、唯一主標、可見標籤、焦點與狀態語意。
- Do 引用既有水墨紙面圖並使用 CSS 裝裱幾何；小螢幕保持內容與控制項可操作。

### Don't:

- Don't 恢復手機章節橫向捲動或登入頁專用品牌列。
- Don't 用紙面覆蓋或替換原 3D 世界、首頁場景及引擎；不要改寫既有 paper 色盤／展示色階。
- Don't 加回 feTurbulence 顆粒、手繪山形裝飾或 Unicode 導覽箭頭。
- Don't 在各頁複製獨立字體、h1–h3 尺度或抽屜控制器。
- Don't 加入不存在的密碼驗證承諾。





## 2026-10-13 主頁透明與玻璃導覽（最新覆蓋）

/home 主標及雙按鈕不再使用油紙底板；保留原 3D 山門、月亮、前景、雪景與 Noto 字體。僅主頁 nav 使用 38% 深色半透明玻璃與 14px 背景模糊，手機原左側油紙抽屜保留。七章內容與會員油紙不受影響。
已確認 lab 梅花總數 240（176 紅瓣、64 白花），但凍結 public 模組原為 0。生成器只把來源數量套到原 public 模組，產生 particles-plum.js，保留凍結雪粒子參數；layout importmap 使用新資產 URL。原 particles.js 不覆寫。
60 項既有回歸、token/ESLint/build 通過；375／572／1440px 導覽、焦點、CTA、透明樣式、reduced-motion 及會員入口驗收通過，axe/runtime 零錯誤。預覽與公開實際瀏覽器均目視確認立體紅瓣／白花。已部署 .next-home-glass-release，三項服務 ready，未實體重開機。驗收見 ops/releases/home-glass-20261013.json。


2026-10-13 梅花減量：依使用者要求由總數 240 減為 48（36 紅瓣、12 白花），減少 80%。保留雪景、3D 場景及玻璃導覽；資產版本 ?v=48 避免沿用舊快取。已建置並部署 .next-home-sparse-release，公開資產與 importmap 檢查通過、三項服務 ready。本輪未重跑先前 UI 回歸測試。


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
