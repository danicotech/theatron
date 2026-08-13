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
