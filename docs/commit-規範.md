# Commit 規範

Conventional Commits,四個 repo 同一套。完整版(type 的判準、body 怎麼寫、CI 怎麼擋)在 [hestia/docs/commit-規範.md](https://github.com/danicotech/hestia/blob/main/docs/commit-規範.md),這裡只放格式與本 repo 的 scope。

```text
<type>(<scope>): <subject>

- 為什麼要改
- 有什麼副作用或前提
```

```text
feat(bracket): 手機版改成分輪檢視

- 完整樹在 375px 下必須捏放大才看得清,等於沒有手機版
- 一次一輪,黏住輪次標題,左右滑動換輪
- 桌機不受影響,1024px 以上仍是完整樹
```

**冒號前面沒有空格。** `feat(bracket) : xxx` 會被 commitlint 擋下來。

## type

`feat` / `fix` / `refactor` / `perf` / `docs` / `test` / `build` / `ci` / `chore` / `revert`

## scope

| scope | 範圍 |
|---|---|
| `ui` | `packages/ui` 的元件 |
| `tokens` | design token 的第 1、2 層 |
| `theme` | 主題注入與主題契約 |
| `landing` | 首頁 |
| `bracket` | 賽程樹 |
| `betting` | 投注單與賠率顯示 |
| `admin` | 後台 |
| `web` | 路由、SSR、BFF、session |
| `deps` | 相依升級 |
| `ci` | workflow |

## 這個 repo 特別要注意的

**視覺改動的 subject 要說出理由,不能只說改了什麼。**

`style(ui): 調整卡片間距` 沒有資訊。`fix(ui): 卡片間距改用 token,原本寫死的值在小螢幕會擠在一起` 才有 —— 半年後有人想改回去的時候,他看得到當初為什麼。

出現一次性 hex 值的 commit 應該被 CI 擋下來,不是靠 review 抓。

## 三條最容易忘的

- subject 用祈使句、不加句號、72 字元以內
- body 講**為什麼**,不是改了哪些檔案
- **PR 標題也要照這個格式** —— squash merge 之後它就是主線上的 commit message
