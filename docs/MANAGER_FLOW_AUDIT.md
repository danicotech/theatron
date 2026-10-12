# 管理者流程驗收 — 2026-10-12

## 驗收範圍

入口：`http://127.0.0.1:3000/sportsbook?mode=manage`。

本次是 **IndexedDB 本機管理模擬**。此頁已持續標示體驗版與本機管理權限，所有使用者都可進入；不是正式裁判登入，也不會發放實體獎品。正式 `/judge` 使用生成 API client，目前沒有可用 Hestia 後端可完成登入及跨裝置驗收。

使用使用者指定 `design-taste-frontend` 的既有品牌審查方式，管理介面採專案 `tournament-design-system`；抽籤套用 `animation-systems` 的短動作、生命週期清理及 reduced-motion。保留紙墨配色、語意 token 與既有字體，不加新依賴。

## 實作與驗證

| 操作 | 結果與保護 |
| --- | --- |
| 建立活動與選擇名單 | 沿用空白報名或示範選手來源，保留舊活動 |
| 拖曳籤位 | 桌機拖曳互換；手機／鍵盤用換位 select，確認後套用 |
| 隨機抽籤 | 求籤台以 CSS transform 搖籤；crypto 無偏差洗牌；先預覽再確認 |
| 非 2 次方人數 | 5 人顯示 3 個輪空席，預覽直接沿用 `defaultSnapshot` 的首輪規則；實測與保存賽程逐席一致 |
| 重排限制 | 有注單或已開賽後禁止；保留會員對應、角色、評段、盤口設定；清除舊投票與本場 BP 選擇 |
| 盤口名稱 | 未下注／未開賽可改名，已有注單後鎖定，不回寫舊注單 |
| 下注類型 | 整場勝負、單局、比分、時間、名次六類型，可按類型暫停／開放；設定保存至後續輪次 |
| 暫停盤口 | 只阻擋新下注；原注單保留其賠率並正常結算，不作廢退款 |
| 開賽 | 可選指定場次（實测從第二場開始）；封閉本場及全活動名次盤；不能重新開放進行中／已結算盤 |
| 賽果與秒數 | 沿用 BO3 逐局勝者、秒數草稿與結算摘要；結算必須二次確認，完成後不能任意改判 |
| 抽獎 | 可選全會員或本活動參賽會員；排除匿名及本活動已中獎者；結果先保存，庫存扣 1；同操作重送不重抽 |
| 抽獎名單 | 抽之前可展開查看符合資格會員 |
| 頒獎 | 獨立記錄選手／獎項／獎勵，二次確認登錄及標記頒發；不更改賽果或自動扣除兌換庫存 |
| 頒發記錄 | 刷新後保留；禁止重複標記。觀眾代理補上得主「我的獎品」收件頁 |

## 可重現驗證

在 `theatron/` 執行：

```powershell
pnpm exec vitest run web/src/features/sportsbook/managerEngine.test.ts web/src/features/sportsbook/engine.test.ts
node scripts/verify-manager-flow-browser.mjs
pnpm typecheck
pnpm exec eslint web/src/features/sportsbook/ManagerOperations.tsx web/src/features/sportsbook/managerEngine.ts web/src/features/sportsbook/managerEngine.test.ts web/src/features/sportsbook/interaction.ts
pnpm lint:custom
```

- 核心引擎：34 項測試通過，含下注後改名／重排鎖定、已開賽禁重開、後續輪次類型開關、庫存與重複抽取防護、頒獎不修改賽果。
- 瀏覽器：1440、375 寬完成拖曳／換位、求籤動畫、套用籤位、改名／暫停／重開、實際新會員註冊、抽獎、扣庫存、頒發、刷新保存、指定第二場開賽。786 寬額外驗證 5 人輪空；無水平溢位及 pageerror。
- 所有測試使用全新 browser context，不讀寫使用者當前瀏覽器資料。
- 截圖與結果：`docs/previews/manager-flow/`；觀眾代理另外交叉驗證盤口暫停後既有注單結算、後續輪次政策及得主收件。

## 尚未連接的正式系統

上述抽獎、盤口開關、頒獎記錄是本機完整流程，沒有伺服器權限、公開抽籤稽核證明、跨裝置同步或獎品配送。正式功能應擴充後端契約後再接生成 client，不可把本機管理當作正式權限使用。

「分組」目前是單淘汰賽首輪對局分組；不是多人隊伍賽制或循環小組賽。比賽時間為逐局實際秒數與整場加總，不包含自動判輸的計時裁判功能。
