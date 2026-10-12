# Theatron 技能對應

## 選用原則

技能庫是工作流程來源，不是每次全面改版的指令。先確定頁面與問題，再讀最小範圍的 `SKILL.md`。使用者當次需求優先，保留既有美術方向與生成流程。

目前專案已內附三個 MengTo 技能副本與賽事設計系統。已內附的技能優先讀專案版本；其他技能從此工作區的 `Skills-main/agent-skills/` 按需讀取。以下連結相對於本文件，不必安裝或複製整個技能庫。

## 工作對應表

| 需求／觸發條件 | 要讀的技能 | 對應內容與實作限制 |
| --- | --- | --- |
| 需求規劃、新區塊規格、迭代 brief | [design-first-ui-prompting](../.claude/skills/design-first-ui-prompting/SKILL.md) | 目標、層級、主操作、內容、限制與驗收；字體及配色沿用現況 |
| 賽程、報名、投注、讓武、裁判介面或共用元件 | [tournament-design-system](../.claude/skills/tournament-design-system/SKILL.md) | 語意 token、資料／展示邊界、行動版分輪與 sheet、主題覆寫 |
| 按鈕、面板、切格、狀態轉換的動效 | [animation-systems](../.claude/skills/animation-systems/SKILL.md) | 時長、easing、閱讀順序、transform／opacity、減少動態；保留現用引擎 |
| 使用者明確要求捲動敘事或閱讀模式動態 | [cinematic-scroll-storytelling](../.claude/skills/cinematic-scroll-storytelling/SKILL.md) | 僅取相關節奏與可用性原則；目前首頁採定格導覽，不能自動換成 Lenis／ScrollTrigger |
| 新增或修改畫面的品質門檻 | [no-ai-design-slop](../../Skills-main/agent-skills/ui/no-ai-design-slop/SKILL.md) | 保留論劍風格，檢查主次、字體、狀態與裝飾用途；只處理本次範圍 |
| 使用者要求正式設計診斷 | [audit-ai-design-slop](../../Skills-main/agent-skills/ui/audit-ai-design-slop/SKILL.md) | 以真實畫面與位置列問題、影響及最小修正；只要求診斷時不直接全面改版 |
| 卡頓、CPU／GPU 過高、離屏動畫、返回頁面後變慢 | [optimize-web-animations](../../Skills-main/agent-skills/codex/optimize-web-animations/SKILL.md) | 先測再改；檢查 Runtime、RAF、事件監聽、observer 及 WebGL 資源清理 |
| 既有 3D 場景、相機、材質問題 | [threejs](../../Skills-main/agent-skills/web-design/threejs/SKILL.md) | 先由 importmap 與 `stage3d.js` 追到真正模組；維持 2D fallback、DPR 限制與 dispose |

2026-09-20 使用者追加 UI／UX 審查需求後，已執行 audit-ai-design-slop，結果見 [UI_UX_AUDIT.md](UI_UX_AUDIT.md)。效能分析與 3D 修改仍只是按需路由。

## 元件與畫面的預設組合

- 首頁內容或導覽：design-first-ui-prompting；有動效改動再加 animation-systems。從 lab 修改並生成。
- 配裝、倉庫、方案文案：design-first-ui-prompting + no-ai-design-slop；保留本機儲存語意與現有匯出流程。
- 賽程、報名、投注、裁判：tournament-design-system + design-first-ui-prompting；只在動態互動需要時增加 animation-systems。
- 共用元件、主題：tournament-design-system 的 tokens／theming／responsive，加 `/kitchen-sink` 實際驗證。
- 效能修正：optimize-web-animations；3D 根因確認後才補 threejs。

## 不自動採用

- `build-awwwards-quality-sites` 或其他整套風格技能：不能推翻已定的論劍視覺。
- `build-threejs-scroll-worlds`、遊戲開發技能：賽事平台與配裝工具並不因此變成遊戲專案。
- `tailwindcss`：目前主要使用 CSS Modules 與 lab CSS，不為套技能換框架。
- `performance-profiling`：技能庫這份主要針對 Apple Instruments，不是本 Windows 網頁的效能入口。
- GSAP、Lenis、動畫元件庫：技能範例不是新增套件的授權或必要性證明。

## 維護

新需求不吻合上表時，先讀 `../../Skills-main/README.md`，用 `rg --files ../../Skills-main/agent-skills -g SKILL.md`（從本文件目錄）查找，再讀候選技能內容確認適用性。不要只根據名稱套用。

換電腦或單獨複製 Theatron 後，外部 `Skills-main` 與 `scrollcraft` 可能不存在；先檢查路徑並說明缺少的來源，不能改寫生成物來假裝來源仍可用。這些連結是明確的讀取路由，不代表外部技能已全域安裝。

## 本次已套用

2026-09-20 序幕追加需求：animation-systems 用於載入、點燃、揭幕、清理與 reduced-motion；design-first-ui-prompting 用於主動作與橫直構圖；系統 imagegen skill 使用內建工具生成並接入雙俠素材，完整提示詞及路徑見 [OPENING_DESIGN.md](OPENING_DESIGN.md)。新要求取消前輪的可見略過控制。

2026-09-20 全面 UI／UX 修復：design-first-ui-prompting 用於主操作與內容順序；animation-systems 用於持續閱讀、略過與 reduced-motion；no-ai-design-slop 用於去除重複標記與空容器；tournament-design-system 用於語意顏色、響應式及 API／展示邊界。原始審查與 [修復驗收](UI_UX_VERIFICATION.md) 分開保留，避免把歷史問題當成目前仍未修復。

2026-09-20 章序與讓武：design-first-ui-prompting 用於規則 → 條件 → 報名的閱讀順序，no-ai-design-slop 用於正文層級及桌機／手機可讀性檢查；沿用 lab 美術和鏡位。


2026-09-20 漫畫分層與暈墨：使用者指定 [animated-component-libraries](C:/Users/User/.agents/skills/animated-component-libraries/SKILL.md) 與 [animejs](C:/Users/User/.agents/skills/animejs/SKILL.md)，取用模組化分層、逐格揭露與 timeline 清理，沿用 lab 的 Anime.js 3.2.2，不另裝 Motion。內建 imagegen 生成 12 張原稿（包含獨立 alpha 人物／前景）；提示詞與素材對應見 [MANGA_DESIGN.md](MANGA_DESIGN.md)。


2026-09-20 動效自查：繼續使用 animejs／animated-component-libraries 的分層與生命週期原則。imagegen 新增兩張透明手部／物件特寫；Canvas 2D 自建三種水痕研究，不新增動畫框架。程式與色版檢查已做，瀏覽器工具故障導致本輪視覺驗收未完成，詳見驗證文件。

2026-09-20 逐格入場：沿用 animejs 的 timeline complete 及 animated-component-libraries 的分層／清理原則；採單一閱讀順序佇列，不再以短 stagger 冒充逐格播放。

2026-09-20 混合場景／正式讓武：延續上述 animejs 與 animated-component-libraries，使用既有 3D camera path，沒有另裝動畫框架。tournament-design-system 的 tokens／responsive／slop-review 用於局部紙面 UI、手機直排及 36 項條文閱讀；原始宗旨構圖保留。

2026-09-20 漫畫與場景融合：延續 animejs 的串行與清理原則、tournament-design-system 的閱讀底與層級；imagegen 生成六張獨立透明角色，分別對應勝敗、前三名及裁判，提示詞與素材表見 MANGA_DESIGN.md。

2026-09-21 比武還原與逐筆題字：延續 animejs／animated-component-libraries 的生命週期與分層原則；既有 strokeSVG 以真實 Hanzi Writer 筆順生成，無新框架。imagegen 追加輾壓／慘輸／平手四張透明人物；tournament-design-system 用於基本資料與獨立詳情面板。


2026-09-21 左右賽程樹與比武投注：tournament-design-system 用於桌機晉級樹、手機分輪、投注 sheet、語意 token 與 API／展示邊界；design-first-ui-prompting 用於賽程 → 場次 → 選手 → 投注的主操作。沿用既有 Anime.js 與墨幕，不新增動畫套件。imagegen 生成透明 VS，提示詞與 alpha 驗證見 lab VS_ARENA_PROMPT.md。


2026-09-21 武俠名帖賽程：tournament-design-system 對應左右樹、手機分輪、語意 token 和未知資料邊界；design-first-ui-prompting 將使用者季後賽圖轉為雙名帖／中央決賽的閱讀結構。使用姓名字印與 CSS 紙墨表面，不新增圖片或動畫框架。


2026-09-21 實際卡面生成：內建 imagegen 生成黑墨／白紙兩張無字背景，採雙 pass（圖片素材與 HTML 動態文字分離），保留 PNG 原稿、WebP 僅轉格式。中央冠軍沿用既有透明素材；API 賽果決定文字，不由圖片或局部示範推斷冠軍。


- 獨立席位晉級樹與裁判共用：沿用 tournament-design-system 的語意 token、手機分輪與判勝確認。玩家圖與中央冠軍沿用已有素材；此次不生成新圖片、不新增動畫框架。


- 中央冠軍／黑白卡面／示範管理：tournament-design-system 的 token、焦點、手機與判勝確認；animejs 的結果序列與生命週期原則延續既有系統，簡單落印／敗退／SVG 流動以 CSS keyframes 實現，沒有新增套件。


- 本輪使用者指定 superdesign、baseline-ui：已讀 SKILL.md 及 Superdesign 最新遠端指引、建立 .superdesign/init 六份上下文並檢查 CLI 登入；遠端帶原始碼的草稿呼叫遭自動審核拒絕，未繞過。baseline-ui 用於既有原生 dialog、44px 控制項、安全區、附近錯誤、比分等寬數字、transform/opacity 冠軍動畫與 reduced-motion。沿用使用者先前授權的直接實作及既有 CSS 引擎，不換成新動畫框架。


2026-09-21 運彩試玩：套用專案 tournament-design-system 與本機 baseline-ui，沿用紅／藍／金語意色、44px 操作目標、原生 dialog 與手機底部注單。沒有新增動畫框架；資料模型、原子交易與結算测试獨立於美術生成。
