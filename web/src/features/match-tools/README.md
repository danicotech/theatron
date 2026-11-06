# 多人小工具

正式入口 /tools，首頁、會員區與 sportsbook 皆使用 ToolsRoom。舊 sportsbook/MatchTools.tsx 僅保留歷史單機測試，不作正式房間引擎。

生成契約：hestia/activity/v1/tools.proto。房間由邀請碼加入，使用獨立訪客 cookie；稱呼不等同正式會員身分。房主選猜拳或每人 1～4 骰；鎖定名單、全部提交才揭曉、後端結果權威。最多 12 個身分，24 小時有效。

串流自動重連，按 revision 防止舊快照覆蓋。未揭曉與取消回合均不回傳手勢或點數。2D SVG 骰面對應真實結果，CSS 彈出效果支援 reduced-motion；不改正式賽事資料。

完整狀態、驗收與限制見 [REALTIME_INTEGRATION.md](../../../../docs/REALTIME_INTEGRATION.md)。
