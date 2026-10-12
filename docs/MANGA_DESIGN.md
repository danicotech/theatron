# 百業試鋒：水墨漫畫改版

## 2026-09-21 最新約束：距離縮放、中央 VS 與精簡頁首

本節取代下方歷史版本的比武背框閃光、人物反光、VS 地面光圈及腳邊 VS 定位。以使用者的 1173×912 比武截圖定位問題，該截圖不是改完後的驗收證據。既有滿版擂台、選手詳情、七章逐筆題字與四種賽後姿態繼續保留。

### 人物互動與標記位置

- 取消人物亮度／反光、背框與 VS 下方地面光圈。人物只在 fine pointer 下，依游標與左右人物各自的 XY 距離連續縮放；游標尚未進入人物 hitbox 時也應有平滑反應，不能以 hover 開關或全畫面左右分區代替距離。
- 人物以腳底為縮放原點，不改變站位；人物腳下資料不跟著縮放。沿既有渲染迴圈平滑收斂，不新增 loop；離章、游標離開、開啟詳情、閱讀與 reduced-motion 須清除互動目標。鍵盤焦點及觸控仍能開啟詳情，焦點用靜態標示呈現。
- VS／勝敗標記脫離腳下資料區，定格模式固定在 viewport 的 `50svh` 中線；1173×912 的基準中心為 y=456px。比分放在標記下方，切換未公布、比賽前／中／後及四種賽果時，資料高度不得推動標記中心。靜態閱讀採章內相對座標，避免 viewport 定位重疊文件內容。

### 頁首與內容減量

移除整個 `status-bar`、`scene-note` 及 `duel-summary`。靜態閱讀入口與只在 `?preview=1` 啟用的全站階段切換收進頁首「更多」；選單內容採正常流排列，避免新增控制後絕對定位互相重疊。全站及比武局部示範仍分別明確標示，不改寫活動 CTA 或真實賽果。

桌機（≥1024px）採品牌／七章導覽／操作三區，操作保留備戰、活動 CTA、更多。小於 1024px 保留雙列，上列品牌與操作，下列橫向章節導覽；目前章節自動露出，功能字 14px、觸控目標至少 44px、左右留白至少 16px。頁首高度與內容避讓共用 `--nav-h`；閱讀模式、過場覆蓋與更多選單亦須對齊，不能留下舊雙列高度的硬編碼衝突。

本輪程式驗證待跑。CUA 仍受 Windows sandbox kernel 啟動 Failed 5 故障阻擋，桌機／手機、2D／3D 與動畫觀感未完成實機驗收；歷史測試數及舊截圖不能代替本輪結果。待驗清單與結果記於 [UI_UX_VERIFICATION.md](UI_UX_VERIFICATION.md)。

## 最新追加：場景融合與獨立角色

使用者截圖指出白色漫畫大板和藍黑 3D 雪景割裂。規則與讓武在定格閱讀時改用 surface-paper 作共同底色，既有 3D 世界灰階、20% 不透明度，保留運鏡作整頁共同淡墨景深；2D 備援同樣降彩度與不透明度。取消這两章的 scene-shade、暗角及手機底部深色漸層，並排除開場 data-intro。漫画頁與格間底透明、框線保持 3px，透明人物跨在同一景深前；格內重複庭院隱藏，文字底仍為不透明紙色。宗旨與對決的夜色保留。靜態閱讀提供紙面底，不依賴 3D。

新增六張獨立透明人物，使用內建 image_gen，PNG 原稿與 WebP 保留，已檢視 alpha、人物姿態與腳底：

| 素材 | 用途 | 尺寸 |
| --- | --- | --- |
| duel-victor | 對決結束：負傷扶劍險勝 | 1024×1536 |
| duel-defeated | 對決結束：伏地落敗、落劍在前 | 1536×1024 |
| manga-champion | 冠軍主格：墨袍抱劍 | 1024×1536 |
| manga-runnerup | 亞軍：白袍女俠、面向主格 | 1024×1536 |
| manga-third | 季軍：短袍槍客、低姿 | 1024×1536 |
| manga-judge | 規則評段格：持卷裁判 | 1024×1536 |

素材不代表真實參賽者。頒獎三格使用不同人物及不同裁切；評段改持卷人像，原裁判落筆特寫留在讓武章，減少同物件在相鄰章重複。提示詞見 [賽後](../../scrollcraft/builds/lunjian/lab/DUEL_AFTERMATH_PROMPTS.md)、[前三名](../../scrollcraft/builds/lunjian/lab/CHARACTER_ASSETS.md)、[裁判](../../scrollcraft/builds/lunjian/lab/JUDGE_ASSET_PROMPT.md)。

生成器輸出內容雜湊 LUNJIAN_REVISION，CSS、主 runtime 及 stage3d 共用版本；React 依版本重新掛載，避免 Fast Refresh 將新標記與舊腳本混合。共用墨字依賴仍只載一次。實機視覺驗收仍受 CUA 啟動故障阻擋，詳見驗證紀錄。

## 2026-09-20 最新約束：閱讀方向、擂台對決與三席獎賞

本節依使用者最新要求，取代下方歷史版本的「桌機右至左」「首章構圖不變」及報名 shot 6。首章宗旨的人物素材與敘事保留，框線、閱讀方向及入場方式採此新版；開場幕後雙俠仍靜止。全站維持 B 游墨覆蓋 + A 中央向外展漫畫的融合過場。

### 逐格閱讀與進場

桌機由左上 → 右上 → 下方閱讀，DOM 順序需符合視覺順序；手機依相同敘事順序由上往下。每個 frame 左右交替進場：桌機位移 44px、手機 24px，同時淡入 900ms。場景、人物、前景與對白仍獨立分層；完整 timeline 為 1500ms，前格 complete 後才播放下一個可見格，不以短 stagger 同時啟動多格。人物進場後定格，沒有持續漂浮或呼吸動畫。

墨幕揭露期間最多播放首格；後格等待墨幕退出。快速捲過、鍵盤焦點、靜態閱讀及 reduced-motion 優先確保內容可見。切章／卸載停止本次 timeline、Observer 與監聽。36 項正式讓武正文不逐項動畫，也不等待漫畫才解鎖。

### 3D 舞台與對決狀態

| 章節 | 鏡位 | 畫面 | 4 秒入鏡幅度 |
| --- | ---: | --- | ---: |
| 報名 `#register` | shot 3 | 原擂台場地＋局部漫畫與報名 UI；不再使用 shot 6 門樓 | 0.16 |
| 對決 `#duel` | shot 3 | 原兩名黑影、中央 VS 與對戰資訊，留出 3D 擂台 | 0.20 |
| 獎賞 `#rewards` | shot 4 | 原正殿背景＋冠／亞／季三席漫畫與落印 | 0.18 |

相機仍沿用 11 秒 dolly、指標增益 0.35。入鏡依章節 ID 決定，同時追蹤 `S.shown` 與 `S.shot`：報名與對決共用 shot 3，切章仍須各自重啟入鏡；不能只以鏡位是否改變判定。第一章序幕保留原入場幅度，不修改凍結的 jz 相機模組。2D 備援與靜態閱讀仍可完整閱讀。

對決使用既有透明 `art/player-attacker-right.webp`（左側朝右）、`art/player-defender-left.webp`（右側朝左）及 `art/vs-ink.png`；不以新的白衣／黑衣漫畫人物取代原黑影。原先人物定格規格已由本文 2026-09-21 最新約束取代：僅比武章允許 fine pointer 的距離縮放，布幕前雙俠仍靜止。

局部動畫試看提供 before／live／after，比分依序為 0:0／1:1／2:1，整段清楚標記「示範」。after 使用獨立透明 `duel-victor`／`duel-defeated` 素材，來源與生成提示詞見 [DUEL_AFTERMATH_PROMPTS.md](../../scrollcraft/builds/lunjian/lab/DUEL_AFTERMATH_PROMPTS.md)。按「返回賽事資訊」清除局部示範；離章再返回保留本次選擇及示範標示，不寫入 localStorage，重新 mount 時清空；此示範不改寫真實選手、結果或全域活動 CTA。全站賽事 fixture 仍只在 `?preview=1` 啟用。

### 三席漫畫與落印

桌機為冠軍左側主格、亞軍右上、季軍右下；手機依冠／亞／季的 1／2／3 順序單欄排列。每格使用同一逐格佇列，印章在該格 timeline 的 900ms 處開始，以原 420ms 落印動作呈現；不再於章節切入時同時播放全部印章。印章仍是漫畫與名次的輔助識別，不遮住人物和文字。

三席視覺不改變正式規則「最終取前四名」；殿軍仍保留於規則及獎賞說明。未公布的得主、獎金、獎品及領獎方式不補造，動畫示範不當成賽果。

本節只記錄最新實作約束，不新增測試通過宣稱。CUA 瀏覽器工具仍故障，桌機、手機、2D／3D 與逐格實機視覺驗收尚未完成。

## 歷史紀錄：三章混合場景與正式讓武條文

B 游墨覆蓋 + A 中央揭幕維持全站預設，宗旨首章的漫畫構圖不改。依使用者要求，報名、對決、獎賞安排原 3D 背景與運鏡；局部漫畫和紙面 UI 承接資訊，保留背景景深，不再用整張不透明紙面遮住這三章場景。規則、讓武、賽程則以閱讀為主。這是既有舞台與漫畫的整合，不重新掛載舊 React 劇場。

| 章節 | 原鏡位 | 混合呈現 | 4 秒入鏡幅度 |
| --- | ---: | --- | ---: |
| 報名 `#register` | shot 6 | 原報名門樓景深、局部漫畫及活動狀態／報名紙面 UI | 0.16 |
| 對決 `#duel` | shot 3 | 對決場地、雙俠漫畫及對戰資訊 UI | 0.20 |
| 獎賞 `#rewards` | shot 4 | 原場景景深、月下漫畫及獎賞資訊 UI | 0.18 |

三章以 4 秒小幅入鏡，指標位移增益為 0.35，沿用既有 11 秒 dolly 節奏。章節導覽索引與 shot 仍分離，不將章序直接傳給相機。2D 備援保留對應構圖，reduced-motion／靜態閱讀停止裝飾運鏡；漫畫人物仍是單次入場後定格。下節的單一佇列約束繼續適用，不因混合 3D 而讓多格同時進場。

讓武已接入使用者補齊的六類 36 項正式限制，數量依序為 5／8／6／4／6／7。分類錨點為 `handicap-group-weapon`、`skill`、`movement`、`poison`、`victory`、`rule`（後五者亦帶 `handicap-group-` 前綴）。六類原生 details 一般模式預設收合；點擊分類定位並展開，靜態閱讀與 reduced-motion 全展開。條文、BP、例句、退款及可重複等備註依使用者原文保留，不自行補規則；36 項正文不掛入場動畫。完整內容規格見 [BAIYE_CONTENT.md](BAIYE_CONTENT.md)。

驗證邊界：本節是此次實作與維護規格，未宣稱新增的真實瀏覽器視覺驗收已完成。內容回歸已補 `handicapContent.test.ts`；整合後的執行結果與未驗證部分由 [UI_UX_VERIFICATION.md](UI_UX_VERIFICATION.md) 記錄，不沿用歷史視覺通過紀錄。

## 歷史紀錄：確認套用與逐格入場

使用者已確認套用 B 游墨覆蓋 + A 中央揭幕。漫畫格改成真正的串行播放：只有一格能進場，等待該格 Anime.js timeline 的 complete，再播放下一個可見畫格；不再用每批 160ms stagger。桌機右至左再往下、手機上至下，沿用既有 DOM 敘事順序與第一頁構圖。

- 同一格內保留場景 → 人物／前景 → 對白的分層，1500ms 左右完成後定格。
- 轉場覆蓋時準備第一格，中央揭幕期間最多播放第一格；後格等墨幕退出後才接續，不重播第一格。
- Observer 只更新可見集合，不直接啟動動畫；跨 callback、逆序 callback、重複 entry 都不能造成並行或插隊。
- 快速捲過而已離開閱讀區的畫格直接定格，避免等待離屏格造成卡住；捲回已完成畫格不重播。不攔截滾輪、不強制吸附捲動。
- Tab 進入尚未顯示的畫格時優先顯示內容；靜態閱讀與 reduced-motion 不排隊、全部可讀。
- 切章／閱讀／卸載會使舊佇列失效，停止 timeline、disconnect Observer、abort 本次 scroll/focus 監聽並還原樣式。舊回呼不能重啟播放。

實際 Anime.js 以 seek 到 duration−1／duration 驗證後格的等待與接續，另有可控 Observer 回歸。最新執行結果及實機限制見 UI_UX_VERIFICATION.md；本節取代下方歷史版本的 160ms 錯開規格。

## 2026-09-20 自查修正與三版試映（上一輪）

使用者指出只有第一頁構圖正確。本輪保留宗旨的原始 markup 與專屬構圖，重新處理另外六章；下列規格取代下方舊版的 2400ms SVG 墨點方案。

### 自查結果與修改

| 問題 | 修改 |
| --- | --- |
| 新章先顯示，再被入場 timeline 歸零，造成閃現 | 完整墨幕下換章並準備動畫；揭幕完成不再次呼叫入場 |
| 延遲載入素圖可能在揭幕後才出現 | 切章時優先載入並等待 image.decode；等待最多延長 1800ms，失敗不鎖住導覽 |
| 規則與讓武反覆套人物、大劍遮蔽人物和文案 | 改用放下佩劍／裁判落筆特寫，圖片與 caption 分區；BO3 雙俠相向、同一地面 |
| 後四章混用舊彩色劇場／巨大外掛標題 | 報名山門、對決雙俠、賽程筆錄、獎賞月下相逢；各自承接紙面內容，清除舊彩色前景 |
| 各格同時進場，鏡頭幅度過大 | DOM 敘事順序錯開 160ms；背景微推 1.012 → 1，人物 10px、前景 6px，一次進場後定格 |
| 過場像放大的圓，水痕不足 | 以 domain-warped 噪聲場、濃淡色素與半透明濕邊取代 SVG 圓形；共用 Canvas 2D 引擎 |

Caption 延遲 240ms／600ms，背景 1500ms、人物延遲 180ms／1100ms、前景延遲 300ms／1200ms。正文 CTA 不因装飾入場而被隱藏。reduced-motion 與靜態閱讀保持完整內容，切章與卸載清理 timeline／observer／渲染資源。

### 三版供使用者選擇

[墨韻試映](http://127.0.0.1:3000/lunjian/motion-study.html) 可同時／單獨重播、暫停、拖曳。三版共用相同畫面，連結可在整站套用，不寫入 localStorage。

| 版本 | 意圖 | 時間 | 整站網址 |
| --- | --- | --- | --- |
| A 滴墨生花 | 中央落墨、濕邊擴散 | 2800ms | /?ink=bloom#rules |
| B 游墨展卷（融合版） | B 斜向水痕覆蓋 + A 中央暈開揭幕 | 3200ms | /?ink=flow#rules |
| C 煙嵐散墨 | 較寬的薄墨邊、最緩節奏 | 3600ms | /?ink=mist#rules |

使用者已選定 B 的游墨流動，加上 A 的中央向外展漫畫方式。B 現為融合版並已套入全站；A、C 留作比較。46% 時完整覆蓋並換章，51% 起揭露；圖片未解碼時暫停在覆蓋點。每張 raster 最多 140,000 pixels；無 Canvas／模組失敗以紙色淡入淡出維持功能。

正本：lab/ink-transitions.js、lab/motion-study.html、lab/lunjian-layout.html。to-theatron.py 同步新模組與試映頁。重複初始化、慢圖及快速連點由 runtime 測試覆蓋。B 覆蓋場維持游墨，揭露場改為 A 的中央場；新增四個揭幕時間點的 alpha 相等回歸，避免只改文案而效果未融合。

### 新增透明素材

manga-surrender-layer 與 manga-referee-layer，均為 1536 × 1024，PNG 原稿與 WebP 保留 alpha。內建 image_gen 生成；Sharp 僅格式轉換。先前巨大長劍素材保留檔案，但規則／讓武不再掛載。

放下佩劍提示詞：

```text
Production transparent foreground cutout for original Chinese wuxia black-and-white manga webpage. Close-up from slightly above of TWO ADULT HANDS in flowing traditional black hanfu sleeves gently laying a sheathed straight Chinese sword on a low rough wooden table. The wooden tabletop is included as the bottom silhouette, strong diagonal perspective, hands anatomy correct. One sword only. Pure black ink linework and white opaque crosshatched highlights, no colors, calm literary mood. No full person, no face, NO SCENERY or rectangular backdrop, TRUE TRANSPARENT ALPHA around sleeves hands sword and table silhouette. Landscape 1536x1024. Keep all essential hands and sword inside frame. No letters no text no logos no watermark. This asset symbolizes accepting handicap rules by putting down a favored weapon.
```

裁判落筆提示詞：

```text
Production transparent foreground cutout for original Chinese wuxia black-and-white manga webpage. Closeup of an adult referee's hand in a white hanfu sleeve holding a Chinese calligraphy brush above a mostly blank unfurled paper scroll and three small unmarked wooden tally tokens on a low wooden desk. Dramatic diagonal composition from lower left to upper right. Only hand sleeve brush scroll tabletop and tokens, NO PERSON FACE, NO SCENERY. TRUE TRANSPARENT ALPHA around the objects silhouette, opaque white paper and sleeve inside. Pure black-white dry ink brush linework, refined manga crosshatching, traditional Chinese literary still life. Wide 1536x1024. No legible writing, no letters, no logo or watermark. This asset symbolizes referee assessment and pre-match confirmation.
```

### 本輪驗證邊界

37 項回歸、typecheck、lint、token 與 production build 通過，首頁與試映／素材 HTTP 200。另檢視了從實際渲染器輸出的 [六階段墨痕色版](previews/ink-variants.png)：由上到下 A／B／C，由左到右進度 10／20／35／46／65／80%。這是演算法輸出，不是瀏覽器截圖。

瀏覽器工具多次發生 trusted Node／Windows sandbox 初始化故障，本輪無法重新進行桌機手機的實際操作與逐章畫面驗收。前版通過的寬度紀錄不能充作本輪視覺合格證明。待工具恢復後必須覆核七章、2D／3D、375–1440px、慢圖與三版節奏。

## 上一版紀錄：分層漫畫與宣紙落墨

依使用者三張漫畫稿參考與 [YouTube 影片](https://www.youtube.com/watch?v=BYBtlwfSX70) 調整。影片已在瀏覽器查看開頭及 14／28 秒畫面；未下載或挪用影片素材。九個插畫格使用獨立場景、人物、松枝／兵器與 HTML 對白合成，桌機右至左再往下、手機依相同 DOM 敘事順序單欄閱讀。人物進場一次即定格，不循環晃動。第三格人物可跨格，其他人物保持在畫格內；對白層級永遠在前景之上。

動畫使用專案現有 Anime.js 3.2.2，套用 animated-component-libraries 的模組化、分批揭露及 reduced-motion 原則，不新增 Motion 或其他動畫框架。IntersectionObserver 依可視畫格觸發：場景 1200ms、人物延後 240ms／1000ms、前景延後 420ms／1100ms、對白延後 650ms／700ms。切章、靜態閱讀、偏好變更及卸載會取消 timeline、disconnect observer 並還原透明度與 transform。

章節過場從原 560ms 橫掃重構為 2400ms 落墨：1120ms 紙面與濕墨擴散、100ms 停留、1180ms 同源墨點開孔揭露新章。SVG 多點濃墨／濕邊／紙纖維 displacement，沒有整片黑幕水平移動。新章在紙面完全覆蓋後換入；揭露期間再次點選導覽會在本次完成後轉往最新目標。reduced-motion 直接切換並展開全文。

### 素材清單

以下均由內建 image_gen 產生；PNG 原稿與保留 alpha 的 WebP 均在 `../../scrollcraft/builds/lunjian/lab/art/`，由首頁生成器同步到 public。WebP 僅格式壓縮，畫面黑白以 CSS grayscale 呈現。舊三張完整情境圖與新步法／兵器圖保留作後續分鏡素材，不強迫每張都同時載入。

| 檔名（同時有 .png／.webp） | 用途 |
| --- | --- |
| manga-encounter／manga-clash／manga-handicap | 原三張完整情境原稿 |
| manga-eyes | 眼神獨立特寫 |
| manga-footwork | 步法原稿 |
| manga-gate | 山門遠景 |
| manga-tools | 兵器與卷軸原稿 |
| manga-breakout | 白衣人物，1024 × 1536，透明 alpha |
| manga-veteran-layer | 黑衣人物，1024 × 1536，透明 alpha |
| manga-pine-layer | 松枝前景，1536 × 1024，透明 alpha |
| manga-courtyard-layer | 無人物場景，1536 × 1024，白紙底承接透明邊 |
| manga-sword-layer | 長劍物件，1536 × 1024，透明 alpha |

下方保留第一版歷史規格與完整提示詞；動效以本節最新版本為準。

## 追加生成提示詞：黑白素材與獨立動畫層

### 眼神特寫

```text
Use case: illustration-story. Production bitmap for an original Chinese wuxia manhua website. PURE BLACK AND WHITE INK ONLY, no colored accents. Hand-drawn seinen manga crosshatching meets Chinese dry-brush ink, white paper negative space, dynamic cinematic composition. Original adult Chinese hanfu characters, no modern clothes, no franchise characters, no letters, captions, text, speech bubbles, logos or watermarks. Landscape 1536x1024. Extreme horizontal close-up of the determined eyes of a young adult Chinese swordswoman, high tied black hair crossing the forehead, brows intensely focused, diagonal jian sword reflection in foreground. Eyes and nose occupy center, loose hand-drawn speed hatching through corners. A dramatic narrow detail shot but use the whole landscape image. Tension before a duel, no gore.
```

### 踏地步法

```text
Use case: illustration-story. Production bitmap for an original Chinese wuxia manhua website. PURE BLACK AND WHITE INK ONLY, no colored accents. Hand-drawn seinen manga crosshatching meets Chinese dry-brush ink, white paper negative space, dynamic cinematic composition. Original adult Chinese hanfu characters, no modern clothes, no franchise characters, no letters, captions, text, speech bubbles, logos or watermarks. Landscape 1536x1024. Low ground-level action camera showing the footwork of an adult Chinese swordsman in long black hanfu launching diagonally across a stone courtyard, flowing robe, one foot planted and another extended, hand holding a slender jian sword visible at upper right. Figure in profile full-body small enough to include extended sword, dynamic foreshortening. Black brush motion trails along the GROUND, dust in white brush gaps, ink speed lines behind. Freeze-frame illustration, anatomically correct, no gore.
```

### 山門遠景

```text
Use case: illustration-story. Production bitmap for an original Chinese wuxia manhua website. PURE BLACK AND WHITE INK ONLY, no colored accents. Hand-drawn seinen manga crosshatching meets Chinese dry-brush ink, white paper negative space, dynamic cinematic composition. Original adult Chinese hanfu characters, no modern clothes, no franchise characters, no letters, captions, text, speech bubbles, logos or watermarks. Landscape 1536x1024. Very wide establishing view of a remote ancient Chinese martial courtyard and immense mountain gate amid mist, sweeping tiled roofs, lone tiny white-robed novice approaching from lower right and tiny black-robed elder waiting at upper left, stone staircase creates diagonal leading line. Stark black pine branches break into foreground from upper left. Rich architectural brush pen linework, mountains dissolve into nearly white mist, no written signs. Mood of invitation and possibility.
```

### 兵器卷軸

```text
Use case: illustration-story. Production bitmap for an original Chinese wuxia manhua website. PURE BLACK AND WHITE INK ONLY, no colored accents. Hand-drawn seinen manga crosshatching meets Chinese dry-brush ink, white paper negative space, dynamic cinematic composition. Original adult Chinese hanfu characters, no modern clothes, no franchise characters, no letters, captions, text, speech bubbles, logos or watermarks. Landscape 1536x1024. Cinematic still life for a martial challenge: long straight Chinese jian sword diagonally laid across rough wooden table, scabbard, rolled blank paper scroll, several unmarked rectangular wooden tally tokens, inkstone and calligraphy brush. Objects arranged diagonally from lower right to upper left with large white ink-wash gaps, tight crop tactile crosshatched detail. No characters or human hands, no invented lettering or marks on tokens. Strong black-white compositional rhythm, not a product photograph.
```

### 白衣人物透明層

```text
Use case: illustration-story. Asset: transparent foreground character cutout to break across manga panel gutters in a Chinese wuxia website. Original adult Chinese swordswoman, black hair tied in a high ponytail, flowing white hanfu, calm determined expression, standing in three-quarter action-ready stance facing slightly left. Full body from head to feet visible, sleeves and long cloth ribbons fanning out. She holds a single slender Chinese jian sword extended diagonally to upper left, blade completely visible. Anatomy clear, only two hands; weapon naturally held. Beautiful high-contrast black ink manga drawing, fine crosshatching and bold dry brush edges, white robe highlights opaque. One small vermilion ribbon accent. Visually an original manhua character, no modern clothes, no existing franchise character. TRUE TRANSPARENT BACKGROUND ALPHA, no scenery, no floor, no paper rectangle, no cast shadow, no border, no text, no speech bubble, no watermark. Vertical 1024x1536 with comfortable transparent margins around the figure and sword.
```

### 黑衣人物透明層

```text
Production separate animation layer for a Chinese wuxia ink manhua website. One original adult male swordsman wearing long BLACK hanfu, full body, long tied hair, standing in composed guarded stance facing LEFT, slender straight jian sword held diagonally down toward lower left, detailed face and hands, white highlights and crosshatching in black robes. Pure BLACK AND WHITE ink, no red, no color. TRUE TRANSPARENT ALPHA BACKGROUND, absolutely no scenery, no ground, no gray or white rectangle, no cast shadow behind subject. Standalone clean cutout with white opaque garment highlights, ready to composite over white paper mountain scenery. All feet, hair and sword inside frame with 8% margin. Portrait 1024x1536. Dynamic line art, calm character, elegant ink brush marks only attached to robe edge. No text, logo or watermark.
```

### 松枝透明前景

```text
Production FOREGROUND layer for original Chinese wuxia black-white ink manga website. A single elegant gnarled pine branch extending diagonally from upper LEFT toward right center, a few needle clusters and sparse tiny loose ink flecks. PURE BLACK AND WHITE brush pen line art, dry ink texture, no other objects, no scenery, no people, no text, no frame. TRUE TRANSPARENT ALPHA BACKGROUND everywhere around branch, no paper rectangle and no gray backdrop. Wide 1536x1024. Keep central and right lower 70 percent EMPTY TRANSPARENT for dialogue and characters. Natural traditional Chinese ink brush illustration, sparse restrained composition, standalone sprite to float above manga panels.
```

### 無人物場景層

```text
Production BACKGROUND-only separate layer for an original Chinese wuxia ink manhua website. Wide 1536x1024 pure black-and-white ink landscape of an EMPTY ancient Chinese mountain martial courtyard, low perspective stone foreground, distant tiled mountain gate and delicate mist mountains. NO PEOPLE, NO FIGURES, NO ANIMALS, NO WEAPONS, NO TEXT. White paper base, light delicate black brush linework and gray wash, lots of white open space at center and lower half where separately composited characters will stand. Pine silhouettes only distant corners. Quiet literary Chinese ink painting combined with manga architecture detail. This is a background layer, not a final scene with characters.
```

### 長劍透明物件層

```text
Production OBJECT cutout for separate animation layer in a Chinese wuxia black-and-white ink manga website. A SINGLE long straight Chinese jian sword with detailed traditional guard and black tassel, diagonal from lower LEFT hilt to upper RIGHT tip. Pure black and white hand-drawn ink linework and crosshatching, opaque white steel highlights, subtle worn metal, beautiful elegant proportions. TRUE TRANSPARENT ALPHA BACKGROUND, no backdrop, no paper rectangle, no ground, no shadow, no figures, no hands, no scenery, no text. Entire sword and tassel inside frame with 8 percent margin. Wide 1536x1024, one isolated object for overlaying multiple comic panels.
```


使用者要求：減少文字、圖文穿插，以日本漫畫／國漫局勢及墨水動畫呈現。此版取代前一輪正文直接鋪滿首頁的版型。

## 閱讀順序

- 宗旨：月下相遇 → 雙劍交鋒 → 邀請不同程度的人入場。短對白為情境敘事，非選手引言或真實賽果。
- 規則：評段 → 讓武 → BO3；點選同段／差 1／2／3 段，可得到 0／8／16／24 BP 的教學示意。
- 讓武：接受限制的情境圖 → 六類限制 36 項 → 報名。此歷史版本原先僅有分類；本輪已按使用者提供的正式條文補齊名稱、費用及執行方式，詳見本文最新段落。
- 原始宗旨與五節規則保留在原生 details。靜態閱讀與 reduced-motion 自動展開全文。

## 圖像與動畫

以內建 image_gen 生成三張獨立點陣圖，未使用 CLI。PNG 原稿與 WebP 網頁版本均存於 lab/art，生成器同步 public/lunjian/art。

| 用途 | 網頁素材（1536 × 1024） |
| --- | --- |
| 相遇 | [manga-encounter.webp](../../scrollcraft/builds/lunjian/lab/art/manga-encounter.webp) |
| 交鋒 | [manga-clash.webp](../../scrollcraft/builds/lunjian/lab/art/manga-clash.webp) |
| 接受限制 | [manga-handicap.webp](../../scrollcraft/builds/lunjian/lab/art/manga-handicap.webp) |

PNG 名稱相同、副檔名為 .png。僅以 Sharp 重新編碼為 WebP，沒有裁圖、合成或重新繪製；實際載入共約 1.48 MB，原稿約 10.61 MB。文字全部用 HTML 排版，圖片不含生成文字。

人物保持定格，不施加晃動、呼吸、推近等循環動畫。墨跡揭幕 950ms、對白出場 500ms、規則三拍間隔 120ms，BP 回饋 240ms。使用 CSS 與瀏覽器原生動畫，不新增框架。離頁取消未完成的互動動畫；reduced-motion 停止裝飾動畫。

## 生成提示詞

### 相遇

```text
Use case: illustration-story. Asset type: production artwork for an interactive Chinese wuxia tournament manga website, NOT a website mockup. Hand-drawn Chinese ink manhua crossed with stark black-and-white Japanese seinen manga. Confident brush strokes, broken dry-brush edges, crosshatching, white rice-paper negative space, intense cinematic foreshortening, black ink silhouettes and ONE tiny vermilion accent. Wide landscape 1536x1024. No lettering, no calligraphy, no captions, no speech bubbles, no logos, no watermark, no UI. Characters are adult Chinese swordspeople in flowing hanfu, tied long hair, no armor, no modern clothes, no gore. Strong crisp illustrations that remain legible small. Scene: an experienced tall long-haired swordsman in dark flowing robes on the RIGHT, calm firm face and sheathed sword, facing a determined younger adult novice swordswoman in light hanfu on the LEFT holding a plain jian sword. They salute one another at a moonlit martial courtyard. The gap between them forms white negative space, swirling ink around bottom and sides. They face inward toward each other, full body and swords visible. Huge dramatic moon rendered as pale ink circle behind. Main figures centered within middle 70 percent. This is a heroic invitation to challenge, not a fight in progress.
```

### 交鋒

```text
Use case: illustration-story. Asset type: production artwork for an interactive Chinese wuxia tournament manga website, NOT a website mockup. Hand-drawn Chinese ink manhua crossed with stark black-and-white Japanese seinen manga. Confident brush strokes, broken dry-brush edges, crosshatching, white rice-paper negative space, intense cinematic foreshortening, black ink silhouettes and ONE tiny vermilion accent. Wide landscape 1536x1024. No lettering, no calligraphy, no captions, no speech bubbles, no logos, no watermark, no UI. Characters are adult Chinese swordspeople in flowing hanfu, tied long hair, no armor, no modern clothes, no gore. Strong crisp illustrations that remain legible small. Scene: extreme cinematic closeup of two jian swords crossing diagonally at the center, with an adult novice swordswoman's determined eyes and swept hair on the left and adult veteran swordsman's focused eyes on the right in two diagonal manga inset crops. Bright white impact burst at sword intersection, energetic black radiating brush marks. No blood. Strong action still frozen at the instant of a fair contest. Bold diagonals and hand-drawn black-and-white manga linework, clear weapon anatomy. Fill the image; faces in upper half, blades through center.
```

### 接受限制

```text
Use case: illustration-story. Asset type: production artwork for an interactive Chinese wuxia tournament manga website, NOT a website mockup. Hand-drawn Chinese ink manhua crossed with stark black-and-white Japanese seinen manga. Confident brush strokes, broken dry-brush edges, crosshatching, white rice-paper negative space, intense cinematic foreshortening, black ink silhouettes and ONE tiny vermilion accent. Wide landscape 1536x1024. No lettering, no calligraphy, no captions, no speech bubbles, no logos, no watermark, no UI. Characters are adult Chinese swordspeople in flowing hanfu, tied long hair, no armor, no modern clothes, no gore. Strong crisp illustrations that remain legible small. Scene: an adult veteran swordsman in dark flowing hanfu kneeling at an old wooden low table, calmly placing his sheathed sword on the table as if accepting a special challenge, open empty hand extended. On table: brush, blank scroll, simple wooden tally tokens with no marks. Behind him an adult novice swordswoman in white stands resolutely facing him, distant calligraphic pine branches without writing. A restrained dramatic composition with diagonal white paper void, deep black robe folds, purposeful limited tools instead of clutter. Bodies and table fully in frame with broad rough ink margins.
```


## 2026-09-21 最新追加：恢復滿版擂台與四種賽後姿態

本節取代前述對決章的局部 folio 呈現。已找到原版依據 [shots/_th-3d-duel.png](../../scrollcraft/builds/lunjian/lab/shots/_th-3d-duel.png)，對決回到滿版 3D 擂台：左右大幅黑影、中央 VS、人物腳邊的對戰資訊、畫面底部的演出操作。局部紙面漫畫容器不再承載整個對決構圖；既有 3D 背景與運鏡保持可見，人物與操作不得擠在同一小格。

`before`、`live` 與返回正式資訊時使用原 `player-attacker-right.webp`／`player-defender-left.webp` 黑影。`after` 才提供下列四種人物姿態及比分示範，並持續顯示示範標示：

| 示範分類 | 比分 | 左／右人物素材 | 畫面語意 |
| --- | --- | --- | --- |
| `dominant` 輾壓勝利 | 2:0 | duel-dominant／duel-crushed | 勝者毫髮無傷、從容垂劍；敗者垂頭跪倒 |
| `crushed` 慘輸 | 0:2 | duel-crushed／duel-dominant | 對調人物位置，呈現左側落敗 |
| `narrow` 險勝 | 2:1 | duel-victor／duel-defeated | 勝者疲憊扶劍；敗者伏地、落劍在前 |
| `draw` 平手姿態 | 1:1 | duel-draw-left／duel-draw-right | 雙方力竭但仍站立，沒有勝利姿態 |

四分類只用於演出示範，不新增正式賽果狀態。特別是 `draw` 的 1:1 僅用來展示平手人物構圖，不能被當成正式 BO3 結果；實際 BO3 仍為先取得兩勝者勝出。

本輪新增 duel-dominant、duel-crushed、duel-draw-left、duel-draw-right 四張獨立透明素材，加上原 duel-victor、duel-defeated，共六張賽後人物。均使用內建 image_gen 生成，保留 PNG 原稿與 alpha；WebP 僅格式壓縮，沒有以腳本替代繪圖。完整提示詞與素材紀錄見 [DUEL_AFTERMATH_PROMPTS.md](../../scrollcraft/builds/lunjian/lab/DUEL_AFTERMATH_PROMPTS.md) 及 [DRAW_ASSET_PROMPTS.md](../../scrollcraft/builds/lunjian/lab/DRAW_ASSET_PROMPTS.md)。

局部演出不得修改全域活動 CTA、活動資料或 localStorage。離開對決章再返回，保留本次演出階段與結果選擇，示範標示也一併保留；重新 mount 清空本次局部選擇。返回正式賽事資訊時，使用正式活動展示狀態，不將姿態或示範比分當成真實結果。

CUA 瀏覽器工具仍因初始化故障不可用，本輪尚未完成桌機／手機與 2D／3D 的實機視覺驗收。原版截圖只用作構圖依據，不是本輪完成畫面的證據；本節未填入新測試執行結果。


## 2026-09-21 追加：比武資料互動與逐筆章名

導覽章名統一為「比武」，保留 `#duel`。原擂台雙俠之下恢復基本資料，黑影／資料卡皆可點擊或鍵盤開啟獨立的備戰面板；面板包含武器、裝備、武學技能、心法與奇術。未知選手只顯示待公開，局部演出以明標示範的泛稱角色驗證，不宣稱接上真實選手或已提交配置。修正原面板藏在 hidden 的 VS 視窗中造成點擊無法看見的問題，並補上焦點還原、Tab 圈限與背景隔離。

本段先前採用的背框閃光、人物反光與擂台地面光圈已被同日最新要求取代。現行約束為 fine pointer 的 XY 距離連續縮放、腳底原點與固定資料文字；VS 獨立置中、比分在其下，詳見最新設計段落。序幕布後雙俠仍維持不移動。

七章章名以既有 brush.js／ink-title.js 的真實筆畫引擎書寫。補齊六個缺字（宗旨規則說明），每筆獨立遮罩及延遲，沒有使用整字掃描顯影。新 controller 不新增動畫框架、計時器或全域；轉場與序幕覆蓋時暫停筆畫，揭幕後才寫，閱讀模式則直接顯示文字。來源及整合紀錄見 [CHAPTER_TITLES.md](../../scrollcraft/builds/lunjian/lab/CHAPTER_TITLES.md)。正式文字 h1/h2 與七章錨點保留。

最新自動化執行結果另見 UI_UX_VERIFICATION.md；CUA 仍無法啟動，桌機／手機的實機視覺驗收不得據此宣稱通過。


## 2026-09-21 追加：留景的透明 VS 與賽程主畫面

VS 以使用者的黑白書法參考為基礎，生成獨立透明骨白筆畫及少量破墨弧線；保留 3D 山門、月亮、擂台與雙俠。圖記為 `art/vs-arena-ink.webp`，1254×1254、63.29% 全透明，來源與提示詞見 [VS_ARENA_PROMPT.md](../../scrollcraft/builds/lunjian/lab/VS_ARENA_PROMPT.md)。不使用參考的整幅紙底、建築或植物覆蓋原場景。仍在 50svh 中央，慢速 7.2 秒呼吸；閱讀與 reduced-motion 靜止。

宗旨第三格 `.frame-stage` 左上松枝獨立前景層已移除；人物破框、庭院與對白保留。其他漫畫逐格進場順序不變。

賽程以閱讀樹狀圖為主，移除原重複的插畫與小容器；最大 1600px 範圍呈現左右場次匯入中央決賽。手機切換輪次，不將整棵樹縮成小字。點場次進入原滿版擂台，兩個黑影各自對應選手；中央墨字不隨資料區被往下推。

本次實機構圖仍待 CUA 恢復；素材 alpha 與程式測試不可替代瀏覽器的視覺驗收。
