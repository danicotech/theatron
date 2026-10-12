# Theatron — Codex 工作指引

## 開始工作

- 使用繁體中文溝通。先檢查 `git status --short`，保留使用者既有修改。
- 先讀 [DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) 的現況，再按 [SKILL_MAP.md](docs/SKILL_MAP.md) 選最小技能集合。
- 開發命令一律在 `theatron/` 執行，使用 pnpm；啟動與後端限制見 [DEV_SERVER.md](docs/DEV_SERVER.md)。
- 修改 `web/` 前也讀 [web/AGENTS.md](web/AGENTS.md)，依其要求查閱安裝版本的 Next.js 本地文件。
- README 的「地基階段」是舊摘要。以當前路由、原始碼及可重現的執行結果判斷現況；存在檔案不等於已完成端到端串接。

## 修改入口：先分辨原始碼與生成物

| 工作 | 修改來源 | 生成／整合位置 |
| --- | --- | --- |
| 論劍首頁七格、文案、版面、導覽 | `../scrollcraft/builds/lunjian/lab/lunjian-layout.html` 及其同目錄腳本 | `web/src/app/lunjianMarkup.ts`、`web/public/lunjian/` |
| 燃布材質、點燃前雙俠投影 | lab `jz/js/cloth.js`、`art/curtain-figures.webp` | 首頁生成器同步單一覆寫 `web/public/jz/js/cloth.js` 並改寫素材相對路徑；其餘 jz 模組仍凍結 |
| 備戰方案版面與互動 | `../scrollcraft/builds/lunjian/lab/loadout.html`、`loadout.js`、`build-note.js` | `web/src/app/loadout/loadoutMarkup.ts`、`web/public/loadout/` |
| 配裝資料與素材 | `../scrollcraft/builds/lunjian/loadout/data/`、`assets/` | `web/public/loadout/data/`、`assets/` |
| React 掛載、路由、metadata | `web/src/app/`、`web/src/features/chrome/` | 由 Next.js 編譯 |
| 報名、賽程、投注、讓武與裁判功能 | `web/src/features/` 對應模組 | `web/src/app/t/[slug]/`、`web/src/app/judge/` |
| 共用展示元件 | `packages/ui/src/` | `/kitchen-sink` 驗證 |
| API 型別 | 兄弟專案 `../hestia/proto/` | `web/src/lib/api/gen/`，以 `pnpm gen:api` 生成 |

修改 lab 後只執行受影響的生成器，命令見開發服務文件；不要手改生成物。生成器會替換部分素材目錄，執行前確認目的地仍在 `theatron/web/public/` 且沒有只存在生成物中的待保留修改。

首頁現在採七格定格導覽，輪播入口、導覽與鍵盤共用切格流程；靜態閱讀才是長文捲動。不要因為套用 scroll skill 就恢復滾輪切格。沿用 [MERGE.md](../scrollcraft/builds/lunjian/MERGE.md) 第二輪以後的決策。

首頁與 `/loadout` 自帶頁首；維護 `SiteChrome.tsx` 的 `OWN_CHROME` 規則，避免全站導覽擋住頁面按鈕。舊 `features/landing/` 劇場與 `features/world3d/` 仍存在，先追蹤實際 import 再修改，不能把它們當成目前首頁。

## 設計與業務邊界

- 賽事功能與共用元件遵循 [.claude/skills/tournament-design-system/SKILL.md](.claude/skills/tournament-design-system/SKILL.md)。CSS、版面、主題分別加讀 `tokens.md`、`responsive.md`、`theming.md`；交付畫面前讀 `slop-review.md`。
- 首頁／配裝頁保留已整合的 lab 視覺。通用技能提供手法與驗收，不覆蓋既定美術方向；不要把舊劇場整套重新掛回首頁。
- 共用元件只用語意 token；保留 display、body、mono 三種字體角色。主題可以覆寫 display 字體，目前 `web/src/theme/lunjian.json` 使用 `Noto Serif TC`，不要依基礎字體範例把它重設。
- `packages/ui` 只收展示 props，不 fetch、不 import API 型別、不承擔賽事規則。業務邏輯放 `web/src/features/`。
- API 契約只使用生成 client。金額保持 `bigint` 或字串，顯示統一經 `packages/ui/src/format/money.ts`；不要經過 `Number`。
- 手機賽程採分輪檢視，投注單採底部 sheet；保留鍵盤操作、焦點、觸控與 reduced-motion 的可用狀態。
- 動畫沿用正在使用的引擎。只有實際需要時才增加依賴；新建 React 2D/3D 混合依既定 R3F 方向，既有匯入的 3D 模組不為套技能而重寫。
- `/loadout` 的方案保存在瀏覽器 localStorage，可匯出 JSON；已實作以 `?arts=` 帶文字前往報名表並預填，但這不等於已送出報名或把整包方案存到後端。

## 每次迭代

1. 把使用者需求整理成：目標頁／使用者／主操作／要改的內容／保留條件／驗收方式。可推知的細節直接採合理預設。
2. 讀對應 skill 原文，指出這次使用的技能，再從正確來源修改。
3. 改一個明確範圍，必要時生成並檢查 diff；不要為單一需求整站重構。
4. 驗證與變更相稱：文件核對連結及命令；程式跑相關測試、typecheck、lint 與 token 檢查；畫面還要開瀏覽器檢查桌機、手機及關鍵狀態。
5. 區分本次造成的問題與既有問題；沒有執行的檢查要標示未驗證。只有文件修改不必跑完整 build／測試。
6. 更新規劃文件的已完成、待辦與決策。回報修改位置、可預覽網址、驗證與限制。

## UI／UX 修復後的維護約束

- 開場以使用者最新要求為準：[序幕設計](docs/OPENING_DESIGN.md)。保留 KAGE 式載入、全畫面點燃及幕後雙俠，不再加入「直接進入」或 Escape 略過；reduced-motion 維持靜態閱讀。2D 備援也等待點擊，不能載完自動放行。
- 讀取畫面的 KAGE 參考是工作區 `../kage-original-index.html` 的 `#pre`：小型置中圖記、疏排文字與細線百分比，不是 lab `_merge/kage-body.html` 的大型序幕題字。
- 雙俠必須在「尚未點燃」時就以背光黑影呈現固定雙劍對峙姿勢，人物不自行移動；保留布幕飄動及燃燒效果。燃燒後的背景圖片不能代替幕後投影；`banner.prepare()` 必須等待投影素材，再顯示點燃提示。
- 最新結果見 [UI_UX_VERIFICATION.md](docs/UI_UX_VERIFICATION.md)。規則正文不得再由場景計時器隱藏；小於 1024px 的首頁導覽保持雙列。
- 首頁活動狀態只經 `activityDisplay.ts` 與生成 Tournament client 更新；未設定、loading、error 不得使用 signup fixture 代替。全站賽事 fixture 必須 `?preview=1` 且持續標示；使用者另核准對決局部 before／live／after 動畫試看，須全程明標示範，不能改寫真實活動展示狀態。
- 所有活動 CTA 使用同一展示狀態；新增入口也要納入 `data-activity-cta`，備戰入口納入 `data-loadout`。
- `mountStage3D()`、`mountLoadout()` 可以重複呼叫；新增全域事件／timer／非同步作業需納入 mount 的清理。不要依賴 module 再次自動執行。
- 配裝交接一律稱準備報名；沒有活動代號不能默默套用示範 slug。保留 localStorage v3 與 JSON 格式。
- lab 改動後先生成，再跑 `labRuntime.test.ts`；修改活動狀態同時跑 `activityDisplay.test.ts` 與 `LunjianRuntime.test.tsx`。

- 首頁章序固定為「宗旨 → 規則說明 → 讓武 → 報名 → 比武 → 賽程 → 獎賞」。保留原錨點；`prologue` 為百業試鋒宗旨全文，`rules` 為五節完整規則，`invitation` 為六類 36 項正式讓武全文。章序與鏡位分離：章節索引用於導覽，`data-shot`／`S.shot` 用於既有 2D 場景、前景與 3D 鏡位，不能直接拿章序 seek。

- 首三頁採可捲動漫畫分鏡，原始宗旨與五節規則保留在 details，靜態閱讀與 reduced-motion 自動展開全文；上下／PageUp／PageDown 閱讀正文、左右鍵切章。內容以使用者 2026-09-20 提供之全文及補齊的 36 項正式讓武條文為準，結構見 [BAIYE_CONTENT.md](docs/BAIYE_CONTENT.md)。六類 `details.handicap-group` 一般模式預設收合，分類錨點定位並展開；靜態閱讀與 reduced-motion 全展開。36 項閱讀正文不得逐一加動畫，不得自行改寫費用、執行方式、例句、退款或可重複／可拒絕條款。

- 漫畫使用獨立場景／透明人物／透明前景／HTML 對白，詳見 [MANGA_DESIGN.md](docs/MANGA_DESIGN.md)。Anime.js 3.2.2 timeline 與 IntersectionObserver 都須在切章及卸載清理；人物進場一次即定格。首章宗旨的人物素材與敘事保留；使用者最新的左至右閱讀、框線及交替進場要求取代舊「首章構圖不變」約束。各章修正與未完成之實機視覺驗收見設計文件。章節使用 ink-transitions.js 的三版暈墨（2800／3200／3600ms），B 為使用者選定的融合版：游墨流動覆蓋 + A 中央向外揭幕；切章須在完整覆蓋下準備入場，揭幕後不得重新把元素隱藏。試映頁 /lunjian/motion-study.html 與整站共用引擎；不得退回 B 原本的斜向揭露。

- 漫畫入場必須由單一佇列串行執行，前格 Anime.js complete 後才播下一個可見格；不允許 Observer 每批自行 stagger。桌機左上 → 右上 → 下方、手機上至下，DOM 順序與視覺一致。frame 左右交替位移 44px（手機 24px）並淡入 900ms，完整分層 timeline 1500ms；揭幕期間最多首格進場。快捲略過、鍵盤焦點及靜態閱讀優先確保內容可見。回歸包含 comicSequence.test.ts 與實際 vendor Anime.js completion。

- 混合 3D 與漫畫限報名 `register`／shot 3 擂台、對決 `duel`／shot 3 擂台、獎賞 `rewards`／shot 4 正殿：局部漫畫和紙面 UI 留出原場景景深；4 秒入鏡幅度依序 0.16／0.20／0.18，指標增益 0.35，沿用 11 秒 dolly。入鏡幅度依章節 ID 決定，同時追蹤 `S.shown`／`S.shot`，共用 shot 的報名 → 對決仍須重新入鏡。維持 2D 備援、reduced-motion 與第一頁原開幕；不可用整頁不透明紙面遮住這三章的 3D。規格見 [MANGA_DESIGN.md](docs/MANGA_DESIGN.md)，程式回歸不能代替實際瀏覽器視覺驗收。


- 對決恢復原黑影 `player-attacker-right.webp`／`player-defender-left.webp` 與中央透明 `vs-arena-ink.webp`（原 `vs-ink.png` 保留），布幕前雙俠維持定格；比武章依最新要求只保留 fine pointer 的 XY 距離連續縮放，取消人物反光、背框與 VS 地面光圈。局部 before／live／after 示範依序 0:0／1:1／2:1，after 使用透明 `duel-victor`／`duel-defeated`；來源見 [DUEL_AFTERMATH_PROMPTS.md](../scrollcraft/builds/lunjian/lab/DUEL_AFTERMATH_PROMPTS.md)。按「返回賽事資訊」清除局部示範；離章再返回保留本次選擇及示範標示，不寫入 localStorage，重新 mount 時清空，示範不能改寫真實 CTA、選手或賽果。
- 獎賞以 shot 4 正殿為背景，三席漫畫桌機冠軍左主格、亞軍右上、季軍右下，手機 1／2／3；每格 timeline 900ms 處加入原 420ms 落印，禁止舊全組蓋印與逐格佇列並行。殿軍及最終前四名規則保留，未公布的獎品、獎金與得主不得補造。CUA 工具仍故障，程式回歸不代表桌機／手機實機視覺驗收完成。

- 規則／讓武採共用淡墨世界與透明格間，文字保留紙色底；勿恢復巨大白板＋深藍背景及格內重複庭院。紙色場景必須排除 data-intro，並移除手機章節底部舊深色漸層。評段與三席頒獎各用指定的獨立人物，不重複同一對立繪。
- 首頁生成器輸出 LUNJIAN_REVISION；page 的 CSS 與 LunjianRuntime／stage3d 載入版本一致，版本更新重新掛載並清理舊動畫。不得手改生成版本字串，也不得為更新主程式而重複宣告共享 INK 依賴。


## 2026-09-21 比武互動與七章逐筆題字

- 「對決」章改稱「比武」，既有 `#duel` 錨點與 shot 3 不變。以 lab `shots/_th-3d-duel.png` 為滿版構圖依據：兩側大黑影、中央 VS、腳下基本資料與底部試看控制；不再把雙俠縮進 folio 框。
- 比武角色是可 Tab 的原生按鈕，腳下資料也能開備戰方案。未知選手顯示待評定／待公開，面板不能偷偷套用 `loadoutFor(0)`。局部試看才使用泛稱俠客及明標示範的武器／裝備／武學／心法／奇術；真實選手仍待後端資料。
- `#psheet` 必須獨立於 `#vs`，否則舞台入口會被 hidden 祖先遮住。保持焦點圈限、背景 inert、Escape／關閉後還原觸發者；對話框打開時不得穿透切章。事件使用 lifetime signal 並在卸載關閉面板。
- 比武人物只依 fine pointer 與各人物的 XY 距離連續縮放；游標尚未進入人物 hitbox 也有漸進反應，不能用 hover 命中或左右半屏切換代替距離。縮放原點固定腳底，資料文字不跟著縮放；移除人物亮度／反光、背框與 VS 地面光圈。鍵盤保留清楚的靜態焦點及 Enter／Space 開啟詳情，觸控維持點擊；reduced-motion／閱讀模式停用人物縮放，布幕後黑影仍定格。
- 完成比賽有 dominant／crushed／narrow／draw 四種人物試看，比分 2:0／0:2／2:1／1:1。draw 僅姿態示範，不代表正式 BO3 可平手；試看不改活動 CTA、階段、真實玩家或儲存資料。
- 七章 `[data-chapter-title]` 由 `chapter-titles.js` 以真實 `strokeSVG` 筆順書寫。原 h1/h2 保留；不要用整字遮罩冒充逐筆。控制器 `enter/setStatic/clear/destroy` 可重入且不新增 timer。墨幕／序幕期間 CSS 暫停筆畫，揭幕後自動續寫；閱讀及 reduced-motion 顯示完整文字。
- 字料來源、固定版本與逐檔 SHA 見 lab `chapter-glyphs-source.json`，整合見 [CHAPTER_TITLES.md](../scrollcraft/builds/lunjian/lab/CHAPTER_TITLES.md)。生成器同步控制器、版本化字料與模組 URL；不得手修生成物。相關回歸為 duelPreview／duelInteraction／chapterTitles。


## 2026-09-21 最新約束：舞台中央 VS 與頁首整理

- VS 與勝敗標記獨立於人物腳下資料，定格模式置於 viewport 的 `50svh` 中線，比分在標記下方；不能因資料列、示範提示或賽果內容變長而改變 VS 中心。靜態閱讀改用章內場景座標，保留正常文件閱讀。
- 移除整個 `status-bar`、`scene-note` 與 `duel-summary`，同步清理依賴這些節點的初始化與章節更新。靜態閱讀及僅限 `?preview=1` 的全站階段切換收進重構後頁首「更多」，全站示範標示仍須持續可見。
- 桌機頁首分為品牌、七章導覽、備戰／活動 CTA／更多三區；小於 1024px 採雙列，上列品牌與操作，下列可橫捲七章。保留 `aria-current`、目前項目自動露出、44px 觸控目標與活動 CTA 的統一展示來源。
- 本輪取代先前比武背框閃光與地面反光要求；既有選手詳情、七章逐筆題字、四種賽後姿態與示範界線保留。程式驗證結果以 [UI_UX_VERIFICATION.md](docs/UI_UX_VERIFICATION.md) 最新段落為準；CUA 本輪仍因 Windows sandbox kernel 啟動 Failed 5 故障，未完成實機視覺驗收。


## 2026-09-21 賽程樹、場次交接與透明 VS

- 首頁賽程使用 lab `bracket-tree.js`／`bracket-tree.css`：桌機左右會合中央決賽，手機小於 768px 分輪閱讀，季軍戰獨立。選手名稱完整換行；場次按鈕有比分、段位、籤號及勝者。正式資料不能自行猜未確認的晉級路線。
- 點賽程場次進入現有 `#duel`，`?match=` 保存選定場次；禁止再打開舊 `#vs` 視窗代替擂台。維持返回／前進、墨幕後聚焦人物，以及返回賽程焦點。未定席位或未知勝者不得製造選手、比分、裝備或勝敗姿態。
- React 以既有生成 `getBracket`／`listRanks`／`getTournament` 投影成 `tournamentDisplay.ts`，經 `updateTournament` 傳入 lab；卸載清除輪詢及請求，不能在 lab 手寫後端契約。正式公開 Player 尚無裝備內容，詳情應明確顯示待提供。
- 正式投注使用 `/t/[slug]/m/[matchId]?player=[publicId]#markets`；MarketBoard 只能高亮對應 p1／p2 的勝負盤。選角色或開連結不能自動投票、加入或提交注單；既有正式投注流程負責驗證。
- `arena-ticket.js`／`.css` 僅用於明標示範資料的本地操作：選方、輸入本金、檢查、產生示範注單；不呼叫 API、不寫儲存、不扣代幣。金額保持 bigint；手機採 bottom sheet，保留 Escape、焦點與清理。
- VS 改用 `art/vs-arena-ink.webp` 透明骨白墨字，保留原 3D 場景、兩側黑影與 viewport 50svh 中心；不可把參考圖的整張山水紙底鋪滿畫面。素材來源見 lab `VS_ARENA_PROMPT.md`。
- 宗旨第三幅 `.frame-stage` 左上松枝已依標註移除，保留人物、對白與庭院。


- 2026-09-21 賽程改為武俠雙名帖：左路墨色、右路紙色，每位選手有姓名字印／段位／籤號／比分；中央「問鼎」印記不能被长姓名擠壓。字印是姓名首字裝飾，不是門派或頭像。維持手機分輪與場次交接，來源見 [BRACKET_CARD_DESIGN.md](docs/BRACKET_CARD_DESIGN.md)。


- 中央問鼎印記已依追加要求改為 `.tt-champion` 冠軍卡：只在決賽 done 且 winner 屬於雙方並可找到公開玩家時顯示姓名，其餘「冠軍待定」；點擊進決賽，手機只在決賽輪顯示，輪詢保留焦點。黑墨／白紙圖為 bracket-card-dark.webp／bracket-card-light.webp，資料文字保持 HTML；生成來源與提示詞見 lab/BRACKET_CARD_PROMPTS.md。


## 最新覆蓋：獨立席位晉級樹與裁判共用

使用者最新要求取代前述「每場一個雙人卡按鈕／左黑右白」設計。選手名帖與場次比分是兄弟按鈕，一席一卡，左右同紙面，兩路向中央決賽匯合；勝敗是資料狀態，不是左右色彩。名帖開公開選手面板、比分進比武。React 裁判 MatchList 使用 WuxiaBracket 與生成的 bracketTreeRuntime.js，正本仍在 lab；不要直接改生成 JS 或另寫第二套幾何。BO3 沿用逐回合 FinishRound 及確認，不在樹上直接改整場勝者。完整規格見 docs/BRACKET_CARD_DESIGN.md。


## 最新追加：中央冠軍、黑白方與示範管理

使用者指定冠軍在決賽雙席正中間，比分在下；左黑右白可互換，取代先前同紙面限制。勝者使用大斜章及亮黃流動線，敗者灰紙、暗紅敗印及邊角裂痕，保留黑白方標籤與可讀文字；一般輪詢不重播落印，靜態閱讀與 reduced-motion 停動畫。lab/bracket-editor.js/css 只掛在 preview=1，管理修改按 phase 寫入獨立本機儲存並可復原。首輪換人須交換籤位，改勝者清除失效下游；正式資料不得用本機編輯器寫入。正式已結算賽果的任意更正仍無後端 API，不能宣稱已實作正式改判。


- 賽程 RWD 以容器寬度與輪數決定：可讀卡寬 112–144px，完整樹放不下時切同一份資料的分輪模式，CSS 由 data-view 同步，不能以 transform 縮小文字。決賽双席水平接中央冠軍兩側，比分獨立置於下方，不再以折線繞過比分。ResizeObserver 切換需保留目前輪次及鍵盤焦點。


- 最新覆蓋（紅藍方）：賽程改為紅藍卡面，移除可見方別標籤；落敗保留原色退墨，不再轉灰白紙，姓名比分維持可讀。勝者使用金色勝章與亮黃線。編輯器用 red-left／blue-left，讀取舊 white-left 對應 blue-left、black-left 對應 red-left，不清除儲存賽果。aria-label 保留方別資訊。陣營色使用 accent-side-red／accent-side-blue 語意 slot。


- 示範資料室只在 preview=1：2–64 整數人數、8/16/32/64 快捷鍵、比賽前／中／完成及自動／完整樹／分輪檢視。人數與進度各自保存 commands；原始 phase key 維持相容，不得切人數覆蓋原配置。輪空只在首輪且 0:0 直接晉級，後輪待定席位不能當輪空。冠軍魁印／框線展開只在確認或更換冠軍／主動重播時播放，尊重 reduced-motion 與靜態閱讀。


- 最新精簡：選手姓名區只顯示完整姓名，不輸出段位、籤號與文字勝敗副列；比分／勝敗印章仍保留。賽程 tt-viewport 不限制高度、不建立垂直內捲軸，只允許超寬完整樹橫向捲動，上下由章節／頁面處理。


- 敗者斬切效果：右上至左下刀光、鋸齒切口的兩片紅／藍退墨卡面錯開；裝飾層 aria-hidden／pointer-events:none，保留唯一姓名、比分與按鈕。只使用 transform／opacity；輪詢不重播，改判勝者移除，閱讀／reduced-motion 靜態呈現，非目前章節暫停。


- 最新賽程操作：已核准美術維持不變，工具列只有檢視／編輯兩模式；人數／報名者／比分控制限編輯顯示。報名者拖曳或點選到首輪，已排入者交換、待排入者替換，保留被替換者與復原命令；下游按晉級重新計算，禁止後輪直接換人或填入輪空空席。保持原有 profile 儲存相容，registry 以 phase 分開保存。只限 preview 本機，不能宣稱已讀取正式報名名單或提交賽果。


## 2026-09-21 運彩本機試玩

本機運彩位於 `web/src/features/sportsbook/` 與 `/sportsbook`，規格／操作見 [SPORTSBOOK_DEMO.md](docs/SPORTSBOOK_DEMO.md)。本輪使用者授權新增獨立 IndexedDB 資料層，取代 preview=1 比武的舊無扣點 arena-ticket 入口；正式生成 API、Hestia 與 `/judge` 契約保持獨立。所有本機交易只能經 database.execute 單一 IDB 交易，禁止先扣餘額後另寫注單，禁止改用記憶體 fallback 宣稱成功。金額與千分賠率保持 bigint；會員首次贈點、結算、取消退款均須冪等。

試玩賽事是名單／籤位快照，使用 sportsEvent URL 綁定首頁；原 bracket-editor 不能改寫此快照。保留既有賽程美術。結算結果不可復原改帳本，另開一屆重測。首頁 runtime 仍修改 lab 正本並生成；React bridge 的監聽與非同步更新必須卸載清理。不得把 Discord 模擬、管理按鈕或點數兌換說成正式認證與實際履約。


### 本機串關規則版本

最新 UI 使用 `ticket` 命令與 `tickets.ts`：12 場、過關數組合、同玩法包牌、固定成交賠率、整票精確加總四捨五入。新票 `rules=tw-v1`；舊 `bet` 票繼續原千分捨去，不得直接遷移派彩。官方來源與本機差異見 docs/TW_PARLAY_RULES.md；不要宣稱人氣公式是官方開盤模型，不要為此修改正式 Hestia 算法或生成 API。

### 最新覆蓋：同場各盤獨立投票及投注
本機運彩投票改為每會員每盤一票，改票不得刪其他盤口的票。預設各盤單獨投注；`ticket.independent=true` 在單一 IDB 交易內建立多張独立 tw-v1 單注，任一失敗全部回滾，各自結算與退款。跨場串關模式仍禁止同場相關玩法直接相乘。不得把多盤獨立單注保存成等待全部盤口才結算的一張組合票。既有帳本及注單不遷移。

### 注單可達性
觀局雅集側欄只放摘要與主要操作，完整明細及進階設定使用原生 Modal。不得恢復超過視窗高度仍 top-sticky 的長注單；以 ResizeObserver 檢查可完整顯示才固定，嵌入 modal 維持正常文件流。手機選盤不自動展開注單，使用者主動開啟。保持確認前列明細與最後确认才扣點。


## 2026-09-22 本機參賽完整流程
使用者指定先完成同一瀏覽器流程，後端留待下一階段。觀局雅集移除匿名入口，只有檢視／管理模式；會員帳號仍用於報名與投注。`Participation.tsx` 提供閱讀確認、報名身分、四項角色配置、最後確認；`activity-create/update/enroll/publish-roster` 在既有 IndexedDB 原子交易内執行。關閉報名後發布選定籤位，自動生成對局、盤口與不可解除的會員選手對應，發布後鎖定名單。lab 首頁接 registration 公開狀態和 character，備戰方案回傳同會員、同活動草稿；不得把遊戲 ID 與完整報名名單投影到首頁。正式 `/t/`、`/judge/` 與生成 API 未改，管理模式不是權限控制。詳見 SPORTSBOOK_DEMO 與 UI_UX_VERIFICATION。


### 最新覆蓋：中央收卷／導覽單行
2026-09-29 使用者明確指定：報名不用左右分欄，初始收起的書卷置中，點擊後原地展開。所有尺寸 nav 只能一行，取代先前小於 1024px 雙列規範；窄螢幕同排橫捲七章，次要操作進更多。正本 lab/lunjian-layout.html，生成版本 2335dc6a524a；驗收見 Theatron docs/UI_UX_VERIFICATION.md 最新段落。


### 對外文案／管理模式（2026-09-29 最新）
畫面規劃、設計理由及驗收只放 docs/PUBLIC_PRESENTATION.md 等 Markdown，禁止當作訪客文案輸出。試看／模擬／示範編輯入口統一限 mode=manage，公開畫面保持精簡；本機模式不等於正式授權。備戰面板採既有圖庫精確名稱配圖，未知或示範配置不可冒充公開選手配置。首頁 /home 由 lab/home.html 生成。

## 2026-10-12 正式即時同步原則（新環境待接）

- 使用者要求所有正式賽事已提交變更即時同步給有權查看的人。新增或修改賽事寫入時，同步定義事件、接收者、權限、版本、重連快照與跨裝置驗收，不只刷新操作方。
- 已有 Hestia 後端將在另一環境開發；本輪只保留接入空間與文件。依 [REALTIME_INTEGRATION.md](docs/REALTIME_INTEGRATION.md) 接續，不能擅自用本機 State 廣播、虛構遠端玩家或假 API 代替。
- 現有 WatchTournament 為生成的 ConnectRPC server streaming，優先沿用；房間及私人更新需在後端 proto 確認後生成，不手改 gen/。公開流不能帶未揭曉出拳、未公開 BP、私人注單或聯絡資料。
- 小工具目標為裁判指定兩人或玩家邀請對手，各自準備與提交，後端決勝並同步揭曉。它永遠不自動更動先後攻、BP、籤位或賽果。現有 MatchTools 仍是單機示範，不能宣稱已跨裝置。

## 2026-10-12 原始碼隨倉庫移轉

本機完整 mock 提交時新增 sources/lunjian/ 來源快照與 manifest。原工作區仍編輯外部 lab；缺少外部目錄的獨立 clone 改以倉庫內快照為來源，不並行維護兩套。一般啟動／build 使用已提交的生成物，不需要先生成。

測試以 scripts/lab-source.ts 尋找來源，可指定 LUNJIAN_SOURCE_ROOT 強制使用快照。生成命令、路徑安全檢查及更新方式見 [來源说明](sources/lunjian/README.md)。
