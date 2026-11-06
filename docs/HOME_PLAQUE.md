# B1 純 CSS 木牌

採用使用者最新要求：木底＋宣紙、無印章、真實繁中字體；整體向右下傾斜，非整牌平移。

## 最終實作
- 木紋、厚度、紙邊、四角釘點全部使用靜態 CSS，按鈕不含 img 或 background url。不載入生成圖片。
- 文字採現有 display role：Noto Serif TC 800。官網字庫本已載入該字重；data-type-display 納入全站 typography 規則。
- 固定淺色宣紙使用 surface-notice / text-on-notice，與深淺主題無關；報名採既有 accent-brand-on-paper。無新字體下載。
- hit area 固定；face 包含木、紙與字。hover／focus 以左上 15% 20% 為支點 rotateX(-6deg) rotateY(5deg) rotateZ(2.5deg)，220ms；active 稍加深。reduced-motion 不旋轉，按下有底線回饋。
- 排除全站 ink-wave，無額外 RAF、Canvas 或 JS 動畫。
- scene-navigation 改為不透明紙色／墨色底，backdrop-filter:none；章節與首頁保持一致。

## 驗證
- 55 項首頁／lab／導航測試及 59 項主題對比測試通過，純 CSS 最終變更後重跑 lab＋contrast 94 項通過。
- token 檢查 497 檔通過；theme scoped ESLint、正式 build／TypeScript 通過。
- 瀏覽器桌機 1043×844、手機 375×844：無橫向溢出，手機按鈕 164.5×64px；標籤為 Noto Serif TC，墨色 rgb(41,39,36)，朱紅 rgb(156,52,44)，紙色 rgb(229,223,209)，導覽模糊 none。
- 手機賽制入口進入 #prologue；鍵盤 focus 已確認 face 使用旋轉矩陣、hit area transform:none，沒有 ink-wave 注入。
- 實體低階手機尚未量測。沒有新增持續動畫。

來源：design/lunjian/lab/home.html，由原生成器產生 home.css／homeMarkup.ts。其他範圍為 color-mode.css、scene-navigation.css、theme/lunjian.json／lunjian.ts。

字體參考：https://googlefonts.github.io/chinese/ 及 https://github.com/notofonts/noto-cjk/blob/main/Serif/README.md 。採 Google / Adobe 思源宋體繁中，延續現有 display 字體角色。

圖像生成工具曾產出無字木紙材質試稿，提示為「front-facing weathered walnut plaque, blank ivory rice-paper, four small iron nails, no text, no stamp, transparent background」。依最新要求已改 CSS；該稿不作為正式按鈕資產。
`n發布完成：.next-css-plaque-20261026-release，服務 ready，正式頁無 console error；實測按鈕無背景圖片 URL，nav 模糊 none。
# 細節木紙底材與獨立文字

依使用者最新提供圖片，純 CSS 無法等效重現纖維、撕邊與非規則木紋；改用無字透明底材，文字保留 Noto Serif TC 800，無印章。最新要求取代上一版純 CSS 材質。

- 原圖 2038×771，保留於 design/lunjian/assets/notice-detail-master.png；透明留白裁切後轉 WebP，不放大原圖。
- 520×159：31,322 bytes；1040×319：125,360 bytes；1560×478：307,988 bytes。quality 94，透明邊緣保留。
- img srcset + sizes 隨螢幕密度／縮放選用；兩顆同 URL 共用快取。桌機 CSS 寬260px，最大素材覆蓋至6倍密度需求；有限點陣圖片不保證無限縮放。
- object-fit:contain 保持素材比例，手機點擊範圍仍164.5×64px，文字為可選取的 HTML。木、紙、字仍共用右下傾斜 face，hit area 固定，reduced-motion 保留。
- 沒有新增常駐 RAF／Canvas／即時噪聲濾鏡。導覽維持無毛玻璃。
- 生成器新增明確複製三種尺寸，不覆寫其他 art 素材庫。

驗證：52 項 labRuntime／HomeRuntime／homeStage 測試通過，497 檔 token 檢查與正式 build／TypeScript 通過。本機1138×884、375×844，底材完整載入、無水平溢出，真實字體確認，桌機 DPR1 選520版本。高DPR實體裝置未驗收；srcset三尺寸皆由同一原圖產生。截圖 plaque-detail-desktop.png、plaque-detail-mobile.png。

版本：.next-plaque-detail-20261026-release。

