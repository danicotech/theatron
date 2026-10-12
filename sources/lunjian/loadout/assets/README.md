# 燕雲十六聲　武學／心法／兵器素材

來源：`https://yysls-assistant.cn`（工具站）的前端 bundle 與它的 CDN `cos.yysls-assistant.cn`。

**素材著作權屬網易。** 這裡只是把公開 CDN 上的檔案取回本地，
對外發布前請自行確認授權 —— 這份說明不處理那件事。

## 有什麼

| 目錄 | 內容 | 數量 |
|---|---|---|
| `mind/` | 心法卡（`XF_*.png`） | 49 |
| `martial/` | 武學（`{流派}_{招}.png`）與流派（`{流派}.png`） | 20 ＋ 11 |
| `arsenal/` | 兵器譜四家：裂石、鳴金、破竹、牽絲 | 4 |
| `equipment/loadout/` | 裝備與武器圖示（配裝用的方形） | 10 |
| `equipment/cards/` | 卡片版。**防具六個部位的圖只有這裡有**，`loadout/` 只放武器 | 18 |

`manifest.json` 是總表：每一筆帶 key、中文名、圖檔路徑，
武學另有 `weaponKey`／`weapon`（長槍、劍、大刀、刀、雙刀、扇、傘、繩鏢、拳、鼓），
流派另有 `martials`、`requiredMindKeys`、`optionalMindKeys`。

聯絡表：`sheet-mind.png`、`sheet-martial.png`、`sheet-build.png`。

## 怎麼拿到的

工具站是 Vue SPA，畫面上的東西是前端 bundle 裡一份資料表算出來的。
所以不是爬畫面，是**直接抽那份表** —— 一次就齊，而且帶著畫面上看不到的欄位。
CDN 網址由 `cos-image` 模組組出來：`https://cos.yysls-assistant.cn/{目錄}/{key}.png`。

`extract.py` 抽名單、`fetch.py` 下載圖、`tier.py` 量卡面底色。
數值表另外一支：`../tools/fetch-table.py`，它抽的是 entry bundle 裡的
`table.json`（詞條上限、套裝效果、部位基礎屬性），見 `../README.md`。

## 沒有什麼 —— 心法的品階

**這個來源沒有心法的品階。** 你說等級比較重要，但三條路都不通：

1. 資料表有 `quality` 欄位，但 50 筆全是 `0`。
   bundle 裡確實有 `quality:1/2/3`，那些是週商店的道具，不是心法。
2. 卡面沒有星等 —— 放大看過下緣，只有名字，沒有星。
3. 卡面底色分成三群（金 12、紫 20、藍 17），但**不保證對應遊戲裡的虹／金／紫／藍**。
   反證：你截圖裡 `威猛歌` 與 `燎原星火` 都標「虹」，這裡量出來卻都是藍。

底色還是留在 `cardTint` 欄位，因為它和另一件事高度相關：
**12 張金卡有 11 張是某個流派的必備心法**。所以它更像「這張卡重不重要」，
不像「這張卡幾星」。要真的品階，得換一個有標的來源，或由選手在報名表自填。

## 缺的兩筆

- `XF_DJWS`：CDN 回 404（mind/、equipment/cards/、martial/、bg/ 都試過），資料裡的 img 與 cardTint 也是 null。現在那張圖是 `tools/make-missing-card.py` **畫的，不是抓的** —— 構圖、底色、藥丸尺寸、肩線位置全部是從 `XF_CCX` 逐列量出來的，圖案畫卷軸（「卷」在名字裡），不是臨摹官方插畫。manifest 裡留了 `imgNote` 標明來源。
- `POZHU_ZUN`（破竹樽）：資料表裡沒有武學，只有四個必備心法。
