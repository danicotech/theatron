# theatron

活動前端與共用元件庫:賽程樹、投注單、商店、後台、首頁。TypeScript + Next.js。

θέατρον,字面是「觀看的地方」,theatre 的字源。

> **現況:地基階段。** 三層 token、主題注入、前三個元件、`/kitchen-sink` 與生成的 API client 已經進來;
> 賽程樹、投注單、商店、後台、首頁還沒有。
> 視覺規範在 [.claude/skills/tournament-design-system/](.claude/skills/tournament-design-system/),進版控、跟著 repo 走。
> 架構決策的來源是 [hestia/docs/架構規劃書.md](https://github.com/danicotech/hestia/blob/main/docs/架構規劃書.md)。

## 這個 repo 本身就是模板

**一個 repo 一場活動。辦新活動就是開一個新 repo,把這裡複製過去。**

跟 [themis](https://github.com/danicotech/themis) 同一個模型:活動有生命週期,辦完就凍結,不該再跟著別人的重構走。

代價要講清楚:**`packages/ui` 會分岔。** 複製之後兩個 repo 的元件庫就各走各的,在新活動改好的元件不會回饋到舊活動。這對「辦完就結束」是可以接受的;如果之後真的想共用,做法是把 `packages/ui` 發成 npm 套件、各活動用版本相依裝 —— **但不要為了還沒發生的第二場活動先做**,那會讓第一場的每個改動都要先發版。

跨活動的一致性目前靠兩件事撐著:**同一個複製起點**,以及**主題是資料不是程式碼**。

## 目錄

```text
packages/ui/               純展示層。這場活動的元件庫
└── src/
    ├── primitives/        Button, Input, Chip, Sheet, Dialog
    ├── patterns/          OddsRow, MatchCard, BracketTree, BetSlip, PhaseRail
    ├── tokens/            三層 token 的第 1、2 層
    └── theme/             主題注入:把平台來的 JSON 轉成 CSS 變數
web/                       Next.js。這場活動的前端
└── src/
    ├── app/               路由與 SSR
    ├── features/          有業務邏輯,組合 ui/
    │   ├── landing/
    │   ├── bracket/
    │   ├── betting/
    │   └── admin/
    └── lib/               BFF 呼叫、session、生成的 API client
.claude/skills/tournament-design-system/   視覺規範,寫任何 CSS 前先讀
docs/
```

## 兩條硬邊界

**一、`packages/ui` 不 import 任何 API 型別、不呼叫 fetch、不知道賽事規則。它只收 props。**

一旦 `MatchCard` 裡面出現 `if (phase === 'IN_PROGRESS')`,它就綁死在這個活動的當前規則上,複製到下一場活動時第一個要改的就是它。業務邏輯留在 `web/src/features/`。

**二、元件只能用語意 slot,禁止一次性 hex 值。**

```text
第 1 層  原始值      --plum-900: #17101F      ← 主題只換這一層
第 2 層  語意 slot   --surface-base: var(--plum-900)   ← 元件只能碰這層
第 3 層  元件變數    --bracket-node-bg: var(--surface-raised)
```

這不是潔癖,是「換主題」能不能成立的唯一前提。只要有一個元件寫死了 `#241A30`,它在新主題下就是一塊突兀的深紫色補丁。

兩條都值得做成 CI 的 grep 檢查。視覺紀律靠自律撐不過三個月,靠 CI 可以。

## 開發環境

pnpm workspace,`packages/ui` 與 `web` 兩個成員。

```bash
pnpm install     # husky 的 hook 會在 prepare 時自動掛上
pnpm gen:api     # 從 hestia/proto 生成 TS client(見下面「契約」)
pnpm dev         # Next dev server,元件都在 /kitchen-sink
pnpm build       # Next production build
pnpm test        # vitest(元件、金額、契約)
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint,含 packages/ui 的 import 邊界
pnpm lint:custom # token 紀律檢查,見下面
pnpm format      # prettier
pnpm cz          # 互動式產生 commit 訊息
```

**`scripts/check-tokens.mjs` 擋的三件事都是功能的前提,不是風格潔癖:**

| 擋什麼 | 不擋的話會怎樣 |
|---|---|
| 一次性 hex 值 | 換主題時那個元件變成一塊突兀的補丁 |
| 引用第 1 層色階(`--plum-*` 等) | 同上,第 1 層正是主題會抽換的那層 |
| 禁用字體清單 | 字體回到各家 AI 的預設落點 |
| `packages/ui` 出現 `fetch` / API import | 元件庫綁死在這一場活動上 |

`packages/ui/src/tokens/` 是唯一豁免 —— 第 1 層本來就該寫 hex,那是它的工作。

ESLint 管不到 CSS 字串裡的顏色,所以這一段用獨立腳本;`packages/ui` 的 import 邊界則寫在 `eslint.config.mjs`。

## 主題是資料,不是程式碼

```text
tournaments.theme (JSONB)
      ↓  平台隨 /api/state 回傳
      ↓  前端注入一段 <style>,覆寫第 1 層
      ↓  語意 slot 自動跟著變
      ↓  所有元件外觀改變,程式碼零改動
```

換活動就是換一筆 JSON,不重新部署。但**不是什麼都能改**:

| 可自訂 | 不可自訂 |
|---|---|
| 第 1 層色值(6 中性階 + 3 語意色) | 間距與字級尺度 |
| 顯示字體 | 內文字體、`--font-mono` |
| 圓角尺度(`0` = 全直角) | **語意色的職責** |
| 背景紋理 | 元件結構與互動模式 |

最後一條最重要:可以改「金色是哪個金」,不能讓金色代表勝利。`--font-mono` 不開放是因為賠率欄位對齊是功能,不是風格;間距不開放是因為一旦可調,版面必壞。

**跨活動的一致性本身就是價值** —— 玩家換一個活動,不該要重新學怎麼下注。客製的是外觀,不是產品。

## 手機不是縮小的桌機

16 人賽程樹大約 1000 × 700px,塞進 375px 螢幕只有三種下場:看不清、要一直捏放大、或縮到字看不見。

| 尺寸 | 賽程樹 | 投注單 |
|---|---|---|
| ≥ 1024px | 完整樹狀圖 | 右側 dock |
| 768–1023px | 完整樹 + 橫向捲動,黏住輪次標題 | |
| < 768px | **分輪檢視**,一次一輪 | 底部 sheet,留安全區 |

細節見 [responsive.md](.claude/skills/tournament-design-system/responsive.md)。

## 契約:禁止手寫 API 型別

跨 repo 又跨語言,型別只要有第二份就一定會漂。所以這裡一行 API 型別都不寫。

平台 API(身分、帳本、商店)的唯一來源是 **hestia 的 proto**。ConnectRPC 一套 proto
同時服務 gRPC 與 HTTP/JSON,Go server 與這裡的 TS client 從同一份契約生成。

```bash
pnpm gen:api     # buf generate,設定在 buf.gen.yaml
```

| | |
|---|---|
| 輸入 | `../hestia/proto`(hestia 與 theatron 要是同一層的兄弟目錄) |
| 產出 | `web/src/lib/api/gen/`,**不要手改,也不用手動安裝 protoc** |
| 工具 | `@bufbuild/buf` 與 `@bufbuild/protoc-gen-es` 都在 devDependencies 裡 |

`@bufbuild/buf` 需要跑 postinstall 才會把平台專屬的 binary 接成 `buf` 指令,
所以 `pnpm-workspace.yaml` 裡有一條 `allowBuilds`。沒有它 `pnpm gen:api` 會說找不到指令。

Connect 的 client 不需要第二個 plugin:`@connectrpc/connect` v2 直接吃 `*_pb.ts`
匯出的 service 描述。綁好的 client 在 [`web/src/lib/api/client.ts`](web/src/lib/api/client.ts),
`credentials: 'include'` 是必要的 —— 登入流程把 OAuth state 綁在 HttpOnly cookie 上。

改契約的流程是:改 `hestia/proto` → 在 hestia 跑 `buf lint` / `buf generate` → 回這裡跑 `pnpm gen:api`。

### 金額不能碰 Number

後端金額一律 `int64`(專案鐵則 3),protobuf 的 JSON 編碼把它寫成**字串**以保精度。
JS 的 `number` 是 double,超過 2^53 - 1 就靜默失真 —— 不會丟錯,只會少錢。

生成的型別在 TS 這側是 `bigint`,所以正確的做法是讓它一路是 `bigint` 或字串,
只在顯示層格式化:

```tsx
const { balance } = await platformApi.me.getBalance({ currency: 'PT' });
<Amount value={balance.amount} currency={balance.currency} />   // amount 是 bigint
```

`packages/ui/src/format/money.ts` 是唯一被允許決定「金額怎麼變成字串」的地方,
它收 `bigint | string`、拒收 `number`,而且有一條測試掃它自己的原始碼,
確保裡面不會冒出 `Number(` / `parseInt` / `toFixed` / `Intl.NumberFormat`。

## 元件檢視用一個路由,不用 Storybook

`/kitchen-sink` 渲染每個元件的每種狀態,頂部放主題切換器和尺寸切換器。

```bash
pnpm dev    # → http://localhost:3000/kitchen-sink
```

寬度切換器改的是**舞台容器**的寬度,不是視窗 —— 元件本來就該依自己的容器排版,
順便驗證這件事。主題切換器套的是子樹,所以同一頁可以直接比對兩個主題。

成本約 2 天,Storybook 約 1 週外加長期維護。而且它跑在真的 app 裡、用真的 token,不會有「Storybook 裡好好的、app 裡壞掉」。新增主題時套上去捲一遍,就知道有沒有東西破版。

## 視覺方向

已經有明確方向,**不要重新發想** —— 讀 `.claude/skills/tournament-design-system/`,那六份文件是規範本身:

| 檔案 | 什麼時候讀 |
|---|---|
| `SKILL.md` | 入口,四條硬規則 |
| `tokens.md` | 寫任何 CSS 之前 |
| `responsive.md` | 做任何版面,或改賽程樹 / 投注單 / 商店時 |
| `theming.md` | 新增活動主題,或不確定某個值能不能自訂時 |
| `vernacular.md` | 設計新版面或新元件時 |
| `slop-review.md` | 產出畫面後、開 PR 前 |

靈感不從「什麼風格」開始,從主題自己的世界開始:賠率表、記分板、籤位號碼牌、票根。借的是結構與質感,不是主題樂園式的直譯。
