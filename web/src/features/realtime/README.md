# 正式即時狀態接入位置（預留）

規格正本：[REALTIME_INTEGRATION.md](../../../../docs/REALTIME_INTEGRATION.md)。使用者將在切換環境後開發已有 Hestia 後端；本目錄尚未提供可執行的同步程式。

後續責任：

- 共用活動訂閱、快照合併、版本／缺口檢查、斷線重連與狀態。
- 沿用 `../../lib/api/activity.ts` 的生成 WatchService，公開流不帶私人資料。
- 對首頁、裁判、賽程、投注、BP、報名提供一致狀態；每個元件不得自行開流。
- 私人與工具房間訂閱分開授權，登出／切換活動時清理。

等後端 proto 確認後再建立控制器、hook 與狀態庫。不要先手寫共用網路型別、WebSocket JSON 格式或以試玩 State 為正式 API。
