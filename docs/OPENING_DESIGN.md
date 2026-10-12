# 論劍序幕：KAGE 式載入與幕後雙俠

日期：2026-09-20。依使用者最新指示，取代前輪「直接進入」方案。

## 現行行為

1. 依 [KAGE 原始讀取畫面](../../kage-original-index.html) 的 `#pre` 重做：近黑底、44px 朱紅圓相與山門圖記、疏排「月下論劍」、置中 420px／74vw 細線進度、線下狀態與百分比。圖記繪入後輕微呼吸，完成後以 0.8 秒淡出。
2. 依 module、renderer、材質、geometry、題字、近景、雙俠素材、shader 與首幀完成事件更新加權進度；不是下載位元組百分比，不以隨機計時假裝載入。
3. 完成後顯示「點擊畫面，點燃布幕」。全畫面原生 button 支援滑鼠、觸控、Enter、Space；Tab 留在序幕內，背景內容 inert。沒有直接進入與 Escape 略過。
4. 原布幕燃燒 3.5 秒；雙俠畫面保留 0.8 秒、淡出 0.9 秒，再接回山門與原題字。燃燒使用真實經過時間，布料物理仍限制積分步長，背景分頁回來不會慢慢補幀。
5. 點燃前即有雙俠背光投影，人物維持靜止的雙劍對峙姿勢，透過降低布幕透光量呈現黑影。燃燒後另顯示 curtainScene 中的橫直雙俠背景圖片；兩者用途不同。
6. 3D 模組或圖片失敗時，回到同樣等待點擊的 2D 布幕。2D 圖片 decode 失敗或超時也可開場；主腳本監測舞台模組整支缺失並提供備援。
7. reduced-motion 仍直接提供完整靜態閱讀，不播放燃幕。原七章直接網址與內部 QA 的 `?intro=0` 保留，沒有新增可見略過入口。

## 修改來源與素材

- [版面與開場狀態](../../scrollcraft/builds/lunjian/lab/lunjian-layout.html)
- [3D 開場整合](../../scrollcraft/builds/lunjian/lab/stage3d.js)
- [橫式雙俠 PNG](../../scrollcraft/builds/lunjian/lab/art/intro-duel.png)，1536 × 1024。
- [直式雙俠 PNG](../../scrollcraft/builds/lunjian/lab/art/intro-duel-mobile.png)，1024 × 1536。
- 生成後位於 `web/public/lunjian/art/`；素材在工作區內，不依賴 Codex 私有目錄。
- 僅執行首頁 `to-theatron.py`；沒有直接修改輸出檔。布幕 `lab/jz/js/cloth.js` 現在是明確維護的單一 jz 覆寫，其餘凍結模組不重拷。

## 生成紀錄

工具：內建 `image_gen`，沒有使用 API／CLI fallback。橫式為全新生成，直式以橫式檔案為 reference 編修。原始輸出保留於 Codex generated_images，複製到上列正本路徑。

橫式最終提示詞：

```text
Use case: stylized-concept. Create a production web scene background asset, landscape 1536x1024. Cinematic Chinese wuxia shadow duel: exactly two full-body BLACK SILHOUETTE swordsmen facing each other, one on the far left facing right and one on the far right facing left, equal visual weight. Long flowing traditional robes, tied long hair, one holding a straight jian sword low toward center, the other carrying a sheathed sword with poised martial stance. Entire figures and swords inside frame; each character occupies roughly outer third, broad empty middle. Dark charcoal ink silhouette faces without facial detail, extremely restrained cool silver rim light. Pale desaturated smoky grey-blue mist behind their bodies allows silhouettes to read; darker ink-blue outer edges and bottom. Horizontal ground haze, subtle worn silk grain. Mood of tense quiet confrontation, premium historical wuxia cinema, painterly ink realism. No words, no logo, no buildings, no moon, no fire, no borders, no additional people. This picture will sit BEHIND a black cloth that burns away, so strong readable silhouettes and clear separation matter. Not a UI mockup, just the background art. Save the image asset.
```

直式最終提示詞：

```text
Create a PORTRAIT mobile version of this exact wuxia artwork, 1024x1536 vertical canvas. Preserve both black silhouetted Chinese swordsmen, their costumes, inward-facing opposition and smoky silver-blue ink atmosphere. Recompose them closer together, facing each other with swords in the lower two thirds. Both full bodies and heads fully visible, equal scale, powerful tall silhouettes approximately 55% canvas height. Keep both figures entirely inside the central 70% width with safe side margins for a narrow phone crop. Tall smoky negative space above, dark ground below. Fill the entire portrait frame with a continuous misty background, no letterbox or frame. No added people, no text, no logos, no moon or buildings, no fire. Match original image style; do not just place landscape picture inside portrait canvas. This is a background revealed by a burning cloth on a phone.
```

## 可重現驗收

| 範圍 | 實際結果 |
| --- | --- |
| 桌機 1280 × 720 | 載入畫面與階段數字可讀；點擊後可見燃洞、幕後雙俠，完成後回首頁 |
| 手機 390 × 844 | 載入與提示可讀；直式雙俠充滿畫面，兩人面向彼此；無文件橫向溢出 |
| 鍵盤 | 真瀏覽器 Tab 留在點燃按鈕；Space、Enter 均可點燃；完成焦點回山門導覽 |
| 2D | `/?stage=2d` 真瀏覽器確認等待點擊、揭露直式素材、完成後回首頁 |
| 資源失敗 | VM 實際執行生成 runtime，動態 import 失敗回 2D；整支舞台腳本缺失的備援亦通過 |
| reduced-motion | runtime 回歸確認完整靜態閱讀，沒有 data-intro |
| 時間與清理 | 3D 測試確認旗面外仍點燃、重複點擊只啟動一次、真實時間完成、圖片釋放、非同步完成前離頁會 dispose |

本輪執行 `pnpm test web/src/app/stageIntro.test.ts web/src/app/labRuntime.test.ts web/src/app/page.test.tsx web/src/app/LunjianRuntime.test.tsx`：4 檔 24 項通過。`pnpm typecheck`、`pnpm lint`、`pnpm lint:custom`、`pnpm build` 通過；新增測試後另以 ESLint 檢查兩個修改測試檔。實際瀏覽器沒有觀察到主控台 error／warn。

本輪沒有重跑所有業務測試；沒有實體手機／全 GPU 相容性與 FPS 量測。前輪全站尺寸矩陣與業務驗證見 [UI_UX_VERIFICATION.md](UI_UX_VERIFICATION.md)，不將歷史結果當本輪重新執行。

預覽：http://127.0.0.1:3000/。保持本機服務，不包含正式部署或 Hestia 報名提交。

## 讀取樣式第二次調整

使用者再次指定要參考 KAGE 的日式讀取畫面，因此這次直接讀取工作區 `kage-original-index.html` 的 preloader CSS 與標記（96–111、895–910 行），取代前版大題字、序印、四周邊框及頁角標籤。保留論劍繁體中文名稱及既有語意配色；沿用真實資源階段進度，不新增動畫框架，也不修改燃幕、黑影素材和場景載入流程。

已實際檢查 1280 × 720 桌機與 390 × 844 手機讀取畫面；手機沒有橫向溢出。載入完成後 Enter 可點燃，沒有直接進入按鈕。相關 3 個測試檔 19 項通過，typecheck、lint、token 檢查與 production build 通過。token 檢查同時修正前輪 3D 測試 fixture 的寫死色值，改用既有 `--surface-base`，並重跑該檔 2 項測試通過。

## 點燃前幕後交鋒修正

使用者以 707 × 912 畫面指出：等待點燃時只有空布，沒有期待的雙人交鋒。根因是先前只接入燃燒後才露出的雙俠背景，而且 lab 既有的人影材質未被首頁生成器同步。

- 沿用既有透明「雙劍相交」素材，複製至 [art/curtain-figures.webp](../../scrollcraft/builds/lunjian/lab/art/curtain-figures.webp) 作為執行期來源；本輪沒有重新生成圖片。
- [布幕正本](../../scrollcraft/builds/lunjian/lab/jz/js/cloth.js) 以 alpha 遮擋背光、柔化影緣、獨立腳部支點與位移呈現幕後交鋒。劍尖跨中線處分配給各自人物；投影按視窗比例縮放。
- `Banner.prepare()` 等圖片載入；失敗由 stage3d 回 2D，離頁後才載入的 texture 會回收。2D 以同一素材的兩個遮罩與 CSS 動畫呈現黑影；reduced-motion 沿用靜態閱讀。
- `to-theatron.py` 同步布幕模組並改寫到 `/lunjian/art/`，沒有直接修補 public。`stageIntro.test.ts` 新增素材等待、失敗回退與生成物／lab 一致性回歸。
- 實際檢查 1280 × 720、使用者同尺寸 707 × 912、390 × 844 的 3D 點燃前投影；手機確認兩人頭部與交鋒處可見、無橫向溢出，Enter 點燃後仍可進站。另檢查手機 2D 雙影及動畫。沒有觀察到 shader error 或資源載入警告。
- 本輪相關 3 檔共 22 項測試、typecheck、lint、token 檢查與 production build 通過。未做全 GPU 相容性／FPS 量測；交鋒採剪影投影動態，不是新增骨架戰鬥引擎。

## 人物靜止調整

依使用者最新要求，取消上述人物進退與傾斜動畫。3D 投影不再使用人物時間參數，2D 遮罩固定位置；保留背光、布料物理與點燃流程。

本次驗證：3 檔共 22 項相關測試、typecheck、lint、token 檢查通過；瀏覽器確認剪影仍可見且無 console error。未重跑 production build。

## 2026-09-29 開場與過場驗收追加
三尺寸鍵盤／觸控點燃及減少動態流程以隔離 Chromium 重新檢查；墨暈改用實際經過時間，掉幀時仍先全覆蓋才切內容。美術與 3D 原引擎保持不變。來源 lab/lunjian-layout.html，生成版本 36b9e64bcf27，詳細證據及限制見 UI_INTERACTION_PLAN 的同日章節。


### 2026-09-29 恢復首頁燒布與題字動態
/home 重新共用既有 stage3d 開場：真實載入 → 等待點燃 → 原布料／雙俠剪影 → 首頁。新增 home-intro 對話框生命週期與 2D 備援，stage3d 支援明確傳入 runtime/canvas，根路由沿用原參數行為。boot 標記從 lab 正本生成，未複製另一套美術。題字改較慢阻尼、小幅平移及透視傾斜，不再套前景的推近縮放。

回歸 4 檔共 51 項通過；typecheck、lint、token（341 檔）與 build 通過。隔離 Chromium 實際檢查 375px 2D 與 1055px 3D：等待點燃、Tab 焦點、Enter 點燃、燃燒完成解除 inert、回到首頁主操作，沒有 pageerror。截圖與結果在 docs/previews/public-presentation-browser/home-opening-{2d,3d}.*、home-entered-{2d,3d}.png。腳本 verify-home-opening-browser.mjs。保留本機服務；未宣稱全硬體 GPU 效能驗收。

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
