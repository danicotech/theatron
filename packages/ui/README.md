# packages/ui

純展示層。設計系統、design token、主題注入都住這裡。

跟 `web/` 分開不是為了現在就要共用 —— 是為了**讓「純展示」這件事有一條實體的界線**。同一個資料夾裡的東西,遲早會有人順手 import。

## 唯一的邊界

> **不 import API 型別、不呼叫 fetch、不知道賽事規則。只收 props。**

這條是「各活動客製視覺」能成立的前提。破了之後每次辦新活動都要回來動元件,而動元件就會動到上一場已經上線的東西。

## 兩個目錄的差別

| | 放什麼 | 判準 |
|---|---|---|
| `primitives/` | Button、Input、Chip、Sheet、Dialog | 換一個完全不同的產品也還用得到 |
| `patterns/` | OddsRow、MatchCard、BracketTree、BetSlip、PhaseRail | 這個領域特有,但跨活動通用 |

分不出來的時候,問「這個東西在賽事的世界裡對應到什麼」—— 見 [vernacular.md](../../.claude/skills/tournament-design-system/vernacular.md)。

## tokens/ 與 theme/

`tokens/` 放第 1 層原始值與第 2 層語意 slot。`theme/` 放注入邏輯:把平台回傳的主題 JSON 轉成覆寫第 1 層的 CSS 變數。

注入點只有一個地方,不要散出去。

| 檔案 | 是什麼 |
|---|---|
| `tokens/primitives.css` | 第 1 層。色階、顯示字體、圓角基準值 —— 主題會抽換的全部在這裡 |
| `tokens/semantic.css` | 第 2 層。語意 slot、間距、字級、字重、動態、觸控目標 |
| `tokens/index.css` | web 只 import 這一個(`@theatron/ui/tokens.css`) |
| `tokens/layer-one.ts` | 第 1 層變數名的清單。主題注入照著它寫,不自己拼字串 |
| `theme/event-theme.ts` | `parseEventTheme`(驗形狀)+ `toCssVars` / `toThemeRule`(產 CSS) |
| `theme/ThemeProvider.tsx` | 唯一的注入點 |

第 3 層(元件變數)不住在這裡,住在各元件自己的 `*.module.css` 裡,
而且只在需要偏離語意 slot 時才建 —— 例如 `--button-bg: var(--surface-raised)`。

### 為什麼第 2 層掛在 `[data-theme]` 而不是 `:root`

`/kitchen-sink` 要在同一頁並列兩個主題。語意 slot 如果只宣告在 `:root`,
子樹換掉第 1 層之後,第 2 層仍然解析成根節點的值,巢狀主題就失效了。
掛在 `[data-theme]` 上,兩層才會一起跟著子樹走。

### 主題可以換什麼

只有 `tokens/layer-one.ts` 列出來的東西:六個中性階、三個語意色、顯示字體、圓角尺度。
間距、字級、內文字體、`--font-mono`、以及**語意色的職責**都不開放 ——
可以改「金色是哪個金」,不能讓金色代表勝利。細節見
[theming.md](../../.claude/skills/tournament-design-system/theming.md)。

## format/

`format/money.ts` 是整個前端唯一決定「金額怎麼變成字串」的地方。

後端金額是 `int64`,protobuf 的 JSON 編碼把它寫成字串以保精度。
JS 的 `number` 是 double,超過 2^53 - 1 就靜默失真 —— 不會丟錯,只會少錢。
所以這裡收 `bigint | string`、**拒收 `number`**(型別擋一次,執行期再擋一次),
而且 `money.guard.test.ts` 會掃它自己的原始碼,確保裡面不會冒出
`Number(` / `parseInt` / `parseFloat` / `toFixed` / `Intl.NumberFormat`。

格式化是展示,所以它在 `packages/ui` 而不是 `web` —— 但它不知道任何 API 型別,
只知道「一個整數金額」。
