# 論劍 Color Token 規劃

2026-10-15：使用者指定朱紅主色。此文件覆蓋先前「青藍操作色」與「夜藍功能介面」的決策；油紙 Light 背景保留。只調整 DOM 介面，不重新染色既有 3D 布景、角色插畫與紅藍陣營。

## 唯一來源與層級

`web/src/theme/lunjian.json` 是介面色值與別名的唯一來源，`lunjianExtraCss()` 驗證後輸出兩種模式；元件只引用語意 token。不要在 CSS 寫色碼，也不要為單頁複製一套主色。

| 角色／token | Light | Dark | 用途 |
| --- | --- | --- | --- |
| 品牌 `accent-brand` | #9c342c | #e98974 | 朱紅標誌、品牌印記 |
| 主操作 `accent-action-primary` | 引用品牌 | 引用品牌 | 主要按鈕、選中、焦點、作用中導覽 |
| 主操作懸停 `accent-action-hover` | #7f271f | #f5ac99 | 保留朱紅色相，提供可見回饋 |
| 主操作前景 `text-on-action` | #fffaf0 | #201815 | 與主操作／懸停底色成對使用 |
| 輔色 `accent-secondary` | #6b541e | #d8bd76 | 枯金，金額、獎勵、冠軍資訊；不當預設主按鈕 |
| 對照色 `accent-contrast` | #16596b | #8bc9cc | 青色，確實需要區別的資訊；不當一般互動色 |
| 成功 `state-status-win` | #236247 | #9acda8 | 完成、可用、成功；保留文字／圖示 |
| 警示／危險 `state-status-live` | #9b2b42 | #f3a0ad | 莓紅，錯誤、警示、危險操作；以標籤、框線及確認流程與品牌操作區分 |
| 畫布 `surface-auth-canvas` | #e6d7b8 | #141619 | 油紙／中性墨底 |
| 卡片／彈窗 `surface-auth-paper` | #fffaf0 | #1d2024 | 主要閱讀面 |
| 欄位／選單 `surface-auth-field` | #f3eddf | #272c31 | 輸入、原生選單、內層背景 |
| 正文 `text-auth-ink` | #292724 | #f5eee2 | 暖墨／紙白文字 |
| 次要文字 `text-auth-muted` | #5b554a | #c0b9ad | 提示、說明、停用內容 |
| 欄位邊界 `border-auth` | #918574 | #858780 | 可辨識控制項與分隔 |

`accent-brand-on-paper` 為固定淺色裝備圖卡提供深朱紅文字，避免 Dark 亮朱紅落在淺色圖卡上。`accent-auth-action` 為舊版相容別名，指向 `accent-action-primary`；新樣式使用後者。`accent-status-money` 指向輔色；`state-auth-ready` 指向成功色。這些別名不得重新指定獨立色值。

## 使用規則

- 主要按鈕使用 primary + on-action；hover 使用 hover + 同一 on-action。禁止拿 field、paper 或 text-primary 充當按鈕前景。
- 次要按鈕保持中性底與正文色；不要每顆按鈕都填滿朱紅。選中狀態以朱紅與勾號、底線或字重共同表示。
- 深色模式仍是朱紅品牌，以較亮色階維持可讀性；不轉成青藍主色。
- 停用狀態使用次要文字、欄位底與虛線，不能整體降低透明度導致文字模糊。
- 金額／賽果／危險操作各用專屬語意。危險操作不能只靠紅色辨識，需保留明確動作名稱及必要確認。
- `accent-side-red`／`accent-side-blue` 是陣營，不是品牌；裝備藍／紫品質、劍光與插畫色不受主操作規則覆蓋。
- 原生選單跟隨 `color-scheme`，明確指定文字與背景；圖片上的文字需獨立前景與穩定遮罩。

## 驗證

一般文字及操作文字至少 4.5:1，欄位邊界至少 3:1。`contrast.test.ts` 會解析 token 別名，檢查主色、懸停、對照色、狀態與三層背景的對比，並防止循環或缺失別名。

本次 71 項主題／導覽／登入報名相關回歸通過。瀏覽器驗收與發佈結果記錄於 DEVELOPMENT_PLAN.md。本文件的數值與純色色票測試不代表圖片每個像素或尚未進入的賽事階段均已驗收。


## 全站落實（2026-10-15）

共用 Button 以 variant="primary" 明確表達主要操作；default 是中性次要動作，money／danger 保持獨立。會員、報名、後台與首頁操作使用同一 primary／hover／on-action 配對。InkLink、ChapterHead、SealStamp 與 SealButton 的品牌裝飾不再借用 state-live。會員頁不固定 color-scheme，原生欄位隨全站模式切換。

最新驗證共 158 項測試通過，正式版本 .next-site-color-system-release；逐區域實機、元件檢查與限制見 [SITE_COLOR_TOKEN_AUDIT.md](SITE_COLOR_TOKEN_AUDIT.md)。
