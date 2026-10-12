# 雙人同步工具接入位置（預留）

規格正本：[REALTIME_INTEGRATION.md](../../../../docs/REALTIME_INTEGRATION.md)。本目錄尚未提供同步房間功能。

後續責任：裁判指定兩人／玩家邀請對手、邀請回覆、雙方準備、各自擲骰或出拳、同步揭曉與重賽。玩家身分取自正式登入及活動名單，勝負取自後端已保存的回合結果。

- 現有 `../sportsbook/MatchTools.tsx` 是單機示範，不能直接當正式房間引擎。
- 現有入口在 `../sportsbook/SportsbookBridge.tsx` 與 `Sportsbook.tsx`；新環境接正式容器時保留對話框焦點、手機與 reduced-motion 行為。
- 使用生成的後端房間 client；與 `../realtime/` 共用連線生命週期規則，僅依房間權限顯示。
- 不呼叫判勝、籤位、BP、投注或先後攻寫入 API；裁判也不能代玩家出拳。
- 先確認 proto 再建立元件與 adapter，不加入假 API、模擬遠端玩家或永遠回傳成功的空實作。
