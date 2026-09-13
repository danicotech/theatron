# Design Tokens(三層架構)

方向:**深夜賽事轉播台**,自 2026-09-13 起套上《百業試鋒》的世界 —— 版面與動態語法以 `references/kage-optimise`(MengTo/kage)為準:固定全幅環境層、超大左對齊顯示標題、直排 CJK 顯示字、細小字距的技術標籤、章節編號與髮絲線、大量留白、近景去背素材在章節切換時淡出模糊。不是 SaaS 儀表板,不是遊戲官網。

## 為什麼分三層

因為每個活動之後要能換一套外觀,而**元件一行都不能改**。
做法是:元件只認語意,不認顏色。換主題 = 換第一層到第二層的對應關係。

```
第 1 層  原始值        --plum-900: #17101F
                       ↓ 主題在這裡切換
第 2 層  語意 slot     --surface-base: var(--plum-900)
                       ↓ 元件只能碰這一層
第 3 層  元件變數      --bracket-node-bg: var(--surface-raised)   (只在需要偏離時才建)
```

**鐵律:元件禁止引用第 1 層,禁止寫死 hex。** 違反這條,主題功能就死了。

---

## 第 1 層:原始值(預設主題「arena-night」)

```css
[data-theme="arena-night"] {
  --plum-900: #17101F;  --plum-800: #241A30;  --plum-700: #2F2340;
  --plum-500: #4A3A5E;  --plum-300: #A292B5;  --plum-050: #F0E8F5;
  --amber-400: #FFC145;
  --mint-400:  #3DE0A8;
  --rose-400:  #FF4D6D;
}
```

## 第 2 層:語意 slot(元件唯一能用的)

```css
:root {
  /* 表面 */
  --surface-base:    var(--plum-900);   /* 頁面底 */
  --surface-raised:  var(--plum-800);   /* 卡片、節點 */
  --surface-overlay: var(--plum-700);   /* hover、彈層 */
  --border-subtle:   var(--plum-500);

  /* 文字 */
  --text-primary:   var(--plum-050);
  --text-secondary: var(--plum-300);

  /* 語意 —— 職責唯一,不可挪用 */
  --accent-money:  var(--amber-400);  /* 代幣、賠率、金額、冠軍路徑 */
  --state-win:     var(--mint-400);   /* 勝利、中獎 */
  --state-live:    var(--rose-400);   /* 進行中、落敗、危險操作 */
}
```

金色永遠代表錢,薄荷永遠代表贏,玫瑰永遠代表「現在正在發生」或「輸」。
使用者掃一眼就該懂,不需要圖例。**換主題可以換色值,不能換職責。**

## 字體

```css
--font-display: 'Archivo', 'Noto Sans TC', system-ui, sans-serif;  /* 800/900 */
--font-body:    'Noto Sans TC', system-ui, sans-serif;             /* 400/500/700 */
--font-mono:    'IBM Plex Mono', ui-monospace, monospace;          /* 500/600 */
```

**禁用清單**(各家 AI 設計的預設落點):
Inter、Geist、DM Sans、Roboto、Arial、Space Grotesk、Poppins、Montserrat、
Instrument Serif、Fraunces、Playfair Display。

**數字一律 mono。** 賠率、代幣、倒數、票數、比分:

```css
font-family: var(--font-mono);
font-variant-numeric: tabular-nums;
```

`--font-mono` **不開放主題自訂**。賠率欄位對齊是功能,不是風格。

## 間距與圓角

```css
--space-1: 4px;  --space-2: 8px;   --space-3: 12px;
--space-4: 16px; --space-6: 24px;  --space-8: 32px;

--radius-card: 10px;  --radius-control: 6px;  --radius-pill: 999px;
```

**間距與字級不開放主題自訂。** 一旦可調,每個活動的版面都會壞掉。

## 電影式版面(2026-09-13 起)

```css
--pad: clamp(20px, 3.4vw, 56px);   /* 頁邊距,隨視窗寬度走 */
--nav-h: 72px;                     /* 固定導覽列高度;頁面自己留這麼多頂部空間 */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--motion-reveal: 900ms;            /* 標題逐字出場、區塊上浮 */
--text-3xl: clamp(30px, 4vw, 60px);   /* 章節標題 */
--text-4xl: clamp(40px, 7.4vw, 124px); /* 首頁與結尾的顯示字 */
```

這六個是版面語法的一部分,不是主題可換的值。顯示字體在 `baiye-shifeng` 主題下是 **Noto Serif TC**(狂草標題與告示紙是這個世界的字);主題資料在 `theatron/web/src/theme/baiye-shifeng.json`。

出場動態(逐字 reveal、近景層淡出模糊、視差)只在首頁的章節體驗用;功能頁仍然只有上面那三種動態。

**不要什麼都圓角** —— 表格、分隔線、賠率欄位保持直角,那是賠率表的語言。
邊框一律 `1px solid var(--border-subtle)`,不用陰影堆疊層次。

## 動態

只有三種:hover 顏色轉換(150ms)、進行中脈動(1.6s)、抽籤落位(500ms)。

**不要所有東西都 fade-up + stagger** —— 那是最好認的 AI 動態簽名。
一律包 `@media (prefers-reduced-motion: no-preference)`。

## 簽名元素

| 元素 | 說明 |
|---|---|
| 晉級樹連接線 | 迴路走線,分出勝負後點亮成 `--accent-money`,冠軍路徑是貫穿的光 |
| 投注單 | 票根樣式,齒孔虛線分隔 |
| 階段軌道 | 頁首橫向進度軌,當前階段圓點帶光暈 |
| 背景 | 極淡垂直條紋,像記分板的 LED 網格 |

這四個是記憶點。**其他地方保持安靜。一個頁面只能有一個高音。**
