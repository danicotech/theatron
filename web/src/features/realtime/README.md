# 活動即時狀態

TournamentRealtime 依 slug 共用一條生成 WatchTournament 串流。收到首次 heartbeat 才讀取活動、段位與公開對戰表；任何非 heartbeat 通知使快照失效。通知暴增會合併；讀取中再次失效會捨棄舊結果再讀。斷線、回前景、手動重試皆重連並取得完整快照。最後訂閱者離開會中止請求和計時器。

ConnectionStatus 與 useTournamentRealtime 提供一致狀態，未 ready 時報名與修改暫停。首頁、報名頁、我的報名、活動首頁與裁判台已接入。報名通知僅含空 registrationChanged；私人表單和名冊透過各自授權 RPC 重讀，不能加入公開快照。

revision 是這個 client 成功重讀的次數，不是伺服器全域版本。現有契約沒有重播游標，因此不能宣稱事件恰好一次或全域排序。其他投注/BP頁面的輪詢、私人專屬串流與雙人房間仍待後續接入。規格見 ../../../../docs/REALTIME_INTEGRATION.md。
