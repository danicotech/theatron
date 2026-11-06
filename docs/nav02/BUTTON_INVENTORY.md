# 全站按鈕與頁面盤點
更新：2026-10-27。使用者已選定 02 NAV；其餘按鈕方向為待逐項確認的實作規劃。
## 範圍與計數
共 24 個 page.tsx 路由宣告、487 個控制項來源宣告。不是畫面實例數：map 會重複實例化，條件與權限會改變可見項目。包含共用／舊程式供核對，不宣稱所有路由都已做業務驗收。
未讀取帳戶資料或測試真實送出／刪除／結算。動態文案以原始碼片段標示；runtime query/event 所建立的控制項可能需另外補錄。逐項方向為來源與狀態的初步分類，仍須對照實際事件確認。
## 修改方向
| 類別 | 方向 | 狀態 |
|---|---|---|
| 全站導覽 | 02 木紙面；桌面平均排列、平板分兩列、手機單欄置中 | 本輪套用 |
| 首頁主入口 | 保留高解析無字材質＋真宋體；固定右支點向左下傾斜 | 本輪對齊 |
| 閱讀連結／章節切換 | 朱紅墨痕由左向右，固定點擊範圍；不加木框 | 下一批 |
| 報名／登入／儲存 | 實色主按鈕＋次要取消；loading、防重送、錯誤回到原操作 | 逐流程重構 |
| 選項／分頁／篩選 | 持續的選中標示與 aria 狀態；手機可達，不靠 hover | 逐元件評估 |
| 備戰編輯／匯入匯出 | 高頻操作精簡尺寸與分組；不可誤把匯出當提交 | 下一批 |
| 注單／讓武購買 | 金額、餘額、截止狀態優先；保留確定送出流程 | 獨立驗收 |
| 裁判／刪除／發布／結算 | 危險動作與一般動作分離，確認、權限和結果回饋 | 不可全域換皮 |
| 關閉／返回／重試／展開 | 輕量工具按鈕，44px 以上，焦點返回與鍵盤操作 | 統一基礎狀態 |
| 舊劇場／展示頁 | 先確認使用路徑；不把死碼當已完成頁面 | 盤點標記 |
## 頁面清單
| 路由 | 原始碼 |
|---|---|
| /auth/continue | web/src/app/auth/continue/page.tsx |
| /fire-study | web/src/app/fire-study/page.tsx |
| /home | web/src/app/home/page.tsx |
| /judge/login | web/src/app/judge/login/page.tsx |
| /judge | web/src/app/judge/page.tsx |
| /judge/[slug]/m/[matchId] | web/src/app/judge/[slug]/m/[matchId]/page.tsx |
| /judge/[slug] | web/src/app/judge/[slug]/page.tsx |
| /kitchen-sink | web/src/app/kitchen-sink/page.tsx |
| /loadout | web/src/app/loadout/page.tsx |
| /opening-study | web/src/app/opening-study/page.tsx |
| / | web/src/app/page.tsx |
| /sportsbook | web/src/app/sportsbook/page.tsx |
| /t/[slug]/bets | web/src/app/t/[slug]/bets/page.tsx |
| /t/[slug]/bracket | web/src/app/t/[slug]/bracket/page.tsx |
| /t/[slug]/enroll | web/src/app/t/[slug]/enroll/page.tsx |
| /t/[slug]/login | web/src/app/t/[slug]/login/page.tsx |
| /t/[slug]/m/[matchId] | web/src/app/t/[slug]/m/[matchId]/page.tsx |
| /t/[slug]/me/handicap | web/src/app/t/[slug]/me/handicap/page.tsx |
| /t/[slug]/me/loadout | web/src/app/t/[slug]/me/loadout/page.tsx |
| /t/[slug]/me | web/src/app/t/[slug]/me/page.tsx |
| /t/[slug] | web/src/app/t/[slug]/page.tsx |
| /t/[slug]/rules | web/src/app/t/[slug]/rules/page.tsx |
| /t/[slug]/signup | web/src/app/t/[slug]/signup/page.tsx |
| /tools | web/src/app/tools/page.tsx |

完整逐項資料見 button-inventory.json 與互動清單 button-audit.html。
## 逐項清單
| ID | 類別／頁面 | 控制文字 | 原始碼 | 建議 |
|---|---|---|---|---|
| B0001 | 設計展示／非正式流程／/fire-study | 〔動態 selected ? '已選這款' : '選這款'〕 | web/src/app/fire-study/study.tsx:59 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0002 | 設計展示／非正式流程／/fire-study | 百業試鋒夜鴉閣 〔動態 progress === 0 && ( <span className={styles.prompt}> {error ? '無法啟用繪〕 | web/src/app/fire-study/study.tsx:64 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0003 | 設計展示／非正式流程／/fire-study | 重播 〔動態 variant.id〕 | web/src/app/fire-study/study.tsx:88 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0004 | 設計展示／非正式流程／/fire-study | 暫停 | web/src/app/fire-study/study.tsx:91 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0005 | 設計展示／非正式流程／/fire-study | 繼續 | web/src/app/fire-study/study.tsx:94 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0006 | 設計展示／非正式流程／/fire-study | 一起點燃 ↗ | web/src/app/fire-study/study.tsx:132 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0007 | 設計展示／非正式流程／/fire-study | 全部暫停 | web/src/app/fire-study/study.tsx:135 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0008 | 設計展示／非正式流程／/fire-study | 全部繼續 | web/src/app/fire-study/study.tsx:138 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0009 | 設計展示／非正式流程／/fire-study | 全部復原 | web/src/app/fire-study/study.tsx:166 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0010 | 設計展示／非正式流程／/fire-study | 紙張燃燒實拍 | web/src/app/fire-study/study.tsx:190 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0011 | 設計展示／非正式流程／/fire-study | Three.js 體積火焰 | web/src/app/fire-study/study.tsx:198 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0012 | 設計展示／非正式流程／/kitchen-sink | arena-night | web/src/app/kitchen-sink/KitchenSink.tsx:84 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0013 | 設計展示／非正式流程／/kitchen-sink | 〔動態 t.name ?? t.id〕 | web/src/app/kitchen-sink/KitchenSink.tsx:94 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0014 | 設計展示／非正式流程／/kitchen-sink | 〔動態 w.label〕 | web/src/app/kitchen-sink/KitchenSink.tsx:110 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0015 | 設計展示／非正式流程／/kitchen-sink | 加入注單 | web/src/app/kitchen-sink/KitchenSink.tsx:134 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0016 | 設計展示／非正式流程／/kitchen-sink | 報名參賽 | web/src/app/kitchen-sink/KitchenSink.tsx:135 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0017 | 設計展示／非正式流程／/kitchen-sink | 送出注單 | web/src/app/kitchen-sink/KitchenSink.tsx:136 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0018 | 設計展示／非正式流程／/kitchen-sink | 判定勝者 | web/src/app/kitchen-sink/KitchenSink.tsx:137 | 危險／關鍵操作：明確動詞、權限與結果；確認機制依影響程度設計 |
| B0019 | 設計展示／非正式流程／/kitchen-sink | 小 | web/src/app/kitchen-sink/KitchenSink.tsx:143 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0020 | 設計展示／非正式流程／/kitchen-sink | 中 | web/src/app/kitchen-sink/KitchenSink.tsx:144 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0021 | 設計展示／非正式流程／/kitchen-sink | 大 | web/src/app/kitchen-sink/KitchenSink.tsx:145 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0022 | 設計展示／非正式流程／/kitchen-sink | 送出注單 | web/src/app/kitchen-sink/KitchenSink.tsx:151 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0023 | 設計展示／非正式流程／/kitchen-sink | 商店已關閉 | web/src/app/kitchen-sink/KitchenSink.tsx:152 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0024 | 設計展示／非正式流程／/kitchen-sink | 購買 | web/src/app/kitchen-sink/KitchenSink.tsx:153 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0025 | 設計展示／非正式流程／/kitchen-sink | 判定勝者 | web/src/app/kitchen-sink/KitchenSink.tsx:160 | 危險／關鍵操作：明確動詞、權限與結果；確認機制依影響程度設計 |
| B0026 | 設計展示／非正式流程／/kitchen-sink | 加入注單 | web/src/app/kitchen-sink/KitchenSink.tsx:184 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0027 | 設計展示／非正式流程／/kitchen-sink | 送出注單 | web/src/app/kitchen-sink/KitchenSink.tsx:185 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0028 | 設計展示／非正式流程／/kitchen-sink | 購買 | web/src/app/kitchen-sink/KitchenSink.tsx:199 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0029 | 設計展示／非正式流程／/kitchen-sink | ← 裁判台 | web/src/app/kitchen-sink/KitchenSink.tsx:288 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0030 | 設計展示／非正式流程／/kitchen-sink | 看賽事進程 | web/src/app/kitchen-sink/KitchenSink.tsx:343 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0031 | 設計展示／非正式流程／/kitchen-sink | 規則 | web/src/app/kitchen-sink/KitchenSink.tsx:409 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0032 | 設計展示／非正式流程／/kitchen-sink | 對戰表 | web/src/app/kitchen-sink/KitchenSink.tsx:412 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0033 | 設計展示／非正式流程／/kitchen-sink | 報名參賽 | web/src/app/kitchen-sink/KitchenSink.tsx:415 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0034 | 設計展示／非正式流程／/kitchen-sink | 賽制 | web/src/app/kitchen-sink/KitchenSink.tsx:422 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0035 | 設計展示／非正式流程／/kitchen-sink | 報名參賽 | web/src/app/kitchen-sink/KitchenSink.tsx:425 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0036 | 設計展示／非正式流程／/opening-study | {`播放 ${id} | web/src/app/opening-study/study.tsx:255 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0037 | 設計展示／非正式流程／/opening-study | 重播 ↻ | web/src/app/opening-study/study.tsx:267 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0038 | 設計展示／非正式流程／/opening-study | 〔動態 playing ? '暫停' : '繼續'〕 | web/src/app/opening-study/study.tsx:270 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0039 | 設計展示／非正式流程／/opening-study | 〔動態 favorite === id ? '已暫選這款' : '暫選這款'〕 ↗ | web/src/app/opening-study/study.tsx:332 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0040 | 設計展示／非正式流程／/opening-study | {item.id} {item.name} {item.mood} ↗ | web/src/app/opening-study/study.tsx:349 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0041 | 設計展示／非正式流程／/opening-study | 設計參考與使用方式 | web/src/app/opening-study/study.tsx:383 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0042 | 設計展示／非正式流程／/opening-study | Elliot 的色彩心理學回顧 | web/src/app/opening-study/study.tsx:386 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0043 | 設計展示／非正式流程／/opening-study | MoMA 的 Op art 館藏 | web/src/app/opening-study/study.tsx:394 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0044 | 設計展示／非正式流程／/opening-study | Dazed 封面系列 | web/src/app/opening-study/study.tsx:401 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0045 | 設計展示／非正式流程／/opening-study | Surface 刊頭設計 | web/src/app/opening-study/study.tsx:409 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0046 | 設計展示／非正式流程／/opening-study | {second ? '報名' : '規則說明'} ↗ | web/src/app/opening-study/wireframe.tsx:75 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0047 | 設計展示／非正式流程／/opening-study | 首頁 ↗ | web/src/app/opening-study/wireframe.tsx:139 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0048 | 設計展示／非正式流程／/opening-study | BAIYE SHIFENG | web/src/app/opening-study/wireframe.tsx:155 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0049 | 設計展示／非正式流程／/opening-study | 查看賽程 ↗ | web/src/app/opening-study/wireframe.tsx:192 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0050 | 裁判與管理／間接／runtime／待確認載入 | 重試 | web/src/features/admin/AdminGuard.tsx:45 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0051 | 裁判與管理／/judge | 〔動態 pending ? '建立中' : '開賽事'〕 | web/src/features/admin/CreateTournamentForm.tsx:291 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0052 | 裁判與管理／/judge/[slug] | 〔動態 drawn ? '重抽' : '抽籤'〕 | web/src/features/admin/DrawPanel.tsx:78 | 危險／關鍵操作：明確動詞、權限與結果；確認機制依影響程度設計 |
| B0053 | 裁判與管理／/judge/[slug] | {p.seedNo} {p.displayName} 〔動態 byes.has(p.publicId) ? <span className={styles.bye}>輪空</span> : null〕 | web/src/features/admin/DrawPanel.tsx:122 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0054 | 裁判與管理／/judge/[slug] | 確認這張對戰表 | web/src/features/admin/DrawPanel.tsx:174 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0055 | 裁判與管理／/judge/[slug] | 再看看 | web/src/features/admin/DrawPanel.tsx:191 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0056 | 裁判與管理／/judge/[slug] | 確認對戰表 | web/src/features/admin/DrawPanel.tsx:203 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0057 | 裁判與管理／/judge/[slug]/m/[matchId] | 退掉「 〔動態 s.itemName〕 」 | web/src/features/admin/HandicapReview.tsx:97 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0058 | 裁判與管理／/judge/[slug]/m/[matchId] | 不退 | web/src/features/admin/HandicapReview.tsx:108 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0059 | 裁判與管理／/judge/[slug]/m/[matchId] | 代退這一項 | web/src/features/admin/HandicapReview.tsx:121 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0060 | 裁判與管理／/judge/[slug] | 登入 | web/src/features/admin/JudgeConsole.tsx:157 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0061 | 裁判與管理／/judge/[slug] | 推進到「 〔動態 next.label〕 」 | web/src/features/admin/JudgeConsole.tsx:199 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0062 | 裁判與管理／/judge | 進入這一屆的裁判台 | web/src/features/admin/JudgeEntry.tsx:39 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0063 | 裁判與管理／/judge | 管理目前賽事 | web/src/features/admin/JudgeEntry.tsx:58 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0064 | 裁判與管理／/judge/login | 使用裁判通行碼 | web/src/features/admin/JudgeLogin.tsx:77 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0065 | 裁判與管理／/judge/login | 登入 | web/src/features/admin/JudgeLogin.tsx:123 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0066 | 裁判與管理／/judge/[slug]/m/[matchId] | 返回全部場次 | web/src/features/admin/MatchConsole.tsx:223 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0067 | 裁判與管理／/judge/[slug]/m/[matchId] | ← 裁判台 | web/src/features/admin/MatchConsole.tsx:225 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0068 | 裁判與管理／/judge/[slug]/m/[matchId] | 登入 | web/src/features/admin/MatchConsole.tsx:276 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0069 | 裁判與管理／/judge/[slug]/m/[matchId] | 開盤 | web/src/features/admin/MatchConsole.tsx:295 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0070 | 裁判與管理／/judge/[slug]/m/[matchId] | 確定封盤 | web/src/features/admin/MatchConsole.tsx:321 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0071 | 裁判與管理／/judge/[slug]/m/[matchId] | 再看看 | web/src/features/admin/MatchConsole.tsx:338 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0072 | 裁判與管理／/judge/[slug]/m/[matchId] | 封盤 | web/src/features/admin/MatchConsole.tsx:351 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0073 | 裁判與管理／/judge/[slug]/m/[matchId] | 〔動態 m.kind === MatchKind.THIRD_PLACE ? '季軍戰' 〕 | web/src/features/admin/MatchConsole.tsx:398 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0074 | 裁判與管理／/judge/[slug]/m/[matchId] | 儲存直播連結 | web/src/features/admin/MatchConsole.tsx:543 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0075 | 裁判與管理／/judge/[slug]/m/[matchId] | 〔動態 p.displayName〕 {i === 0 ? 'P1' : 'P2'} | web/src/features/admin/MatchConsole.tsx:564 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0076 | 裁判與管理／/judge/[slug]/m/[matchId] | 確定讓 〔動態 nameOf(withdrawing)〕 棄賽 | web/src/features/admin/MatchConsole.tsx:605 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0077 | 裁判與管理／/judge/[slug]/m/[matchId] | 再看看 | web/src/features/admin/MatchConsole.tsx:625 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0078 | 裁判與管理／/judge/[slug]/m/[matchId] | 讓 〔動態 nameOf(withdrawing)〕 棄賽 | web/src/features/admin/MatchConsole.tsx:638 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0079 | 裁判與管理／/judge/[slug] |  | web/src/features/admin/RankingPanel.tsx:217 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0080 | 裁判與管理／/judge/[slug] | 〔動態 picked === null ? '先選一個段位' : `評為 ${rankOf(ranks, picked)?.name ?? ''}`〕 | web/src/features/admin/RankingPanel.tsx:252 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0081 | 裁判與管理／/judge/[slug] | 〔動態 entry.player?.displayName〕 · 〔動態 entry.player?.gameId〕 | web/src/features/admin/RegistrationRoster.tsx:38 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0082 | 裁判與管理／/judge/[slug]/m/[matchId] | 第 〔動態 roundNo〕 回合正式決鬥開始 | web/src/features/admin/RoundControls.tsx:59 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0083 | 裁判與管理／/judge/[slug]/m/[matchId] | {s.name} {s.wins} 勝 | web/src/features/admin/RoundControls.tsx:136 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0084 | 裁判與管理／/judge/[slug]/m/[matchId] | 確定判 〔動態 picked.name〕 贏第 〔動態 round.roundNo〕 回合 | web/src/features/admin/RoundControls.tsx:172 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0085 | 裁判與管理／/ | 檢視賽程 | web/src/features/admin/ScheduleAdminBridge.tsx:83 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0086 | 裁判與管理／/ | 編輯賽程 | web/src/features/admin/ScheduleAdminBridge.tsx:86 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0087 | 裁判與管理／間接／runtime／待確認載入 | 確認 〔動態 next.label〕 | web/src/features/admin/ScheduleManagement.tsx:129 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0088 | 裁判與管理／間接／runtime／待確認載入 | 取消 | web/src/features/admin/ScheduleManagement.tsx:137 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0089 | 裁判與管理／間接／runtime／待確認載入 | 〔動態 next.phase === TournamentPhase.FINISHED ? '結束本屆賽事' : `進入${next.label}`〕 | web/src/features/admin/ScheduleManagement.tsx:143 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0090 | 裁判與管理／/judge/[slug]/m/[matchId] | 確認開賽前設定 | web/src/features/admin/SetupChecklist.tsx:56 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0091 | 裁判與管理／/judge/[slug]/m/[matchId] | 〔動態 s.name〕 | web/src/features/admin/ViolationPanel.tsx:107 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0092 | 裁判與管理／/judge/[slug]/m/[matchId] | 記一筆違規 | web/src/features/admin/ViolationPanel.tsx:189 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0093 | 投注與注單／/ | 重新讀取 | web/src/features/betting/ArenaMarkets.tsx:55 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0094 | 投注與注單／/ | {barText} | web/src/features/betting/BetSlip.tsx:188 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0095 | 投注與注單／/ | 再開一張 | web/src/features/betting/BetSlip.tsx:220 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0096 | 投注與注單／/ | 觀局紀錄 | web/src/features/betting/BetSlip.tsx:228 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0097 | 投注與注單／/ | 移除 | web/src/features/betting/BetSlip.tsx:256 | 危險／關鍵操作：明確動詞、權限與結果；確認機制依影響程度設計 |
| B0098 | 投注與注單／/ | 登入 | web/src/features/betting/BetSlip.tsx:309 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0099 | 投注與注單／/ | 登入後繼續下注 | web/src/features/betting/BetSlip.tsx:323 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0100 | 投注與注單／/ | 送出注單 | web/src/features/betting/BetSlip.tsx:330 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0101 | 投注與注單／/ | 確認下注 〔動態 formatAmount(stake)〕 | web/src/features/betting/BetSlip.tsx:351 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0102 | 投注與注單／/ | 回去改 | web/src/features/betting/BetSlip.tsx:362 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0103 | 投注與注單／/ | × | web/src/features/betting/DuelBettingBridge.tsx:146 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0104 | 投注與注單／/ | 選場下注 | web/src/features/betting/DuelBettingBridge.tsx:152 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0105 | 投注與注單／/ | 觀局紀錄 | web/src/features/betting/DuelBettingBridge.tsx:159 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0106 | 投注與注單／/、/t/[slug]/me | 登入後投票 | web/src/features/betting/MarketBoard.tsx:311 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0107 | 投注與注單／/、/t/[slug]/me | 〔動態 mine ? '已投' : '投票'〕 | web/src/features/betting/MarketBoard.tsx:315 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0108 | 投注與注單／/、/t/[slug]/me | 〔動態 slipCopy(slipState)〕 | web/src/features/betting/MarketBoard.tsx:327 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0109 | 投注與注單／/、/t/[slug]/me | 登入 | web/src/features/betting/MyBets.tsx:105 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0110 | 投注與注單／/、/t/[slug]/me | 選場下注 | web/src/features/betting/MyBets.tsx:119 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0111 | 投注與注單／/、/t/[slug]/me | 前往觀局雅集 | web/src/features/betting/MyBets.tsx:123 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0112 | 賽程與對局／間接／runtime／待確認載入 | 回賽事首頁 | web/src/features/bracket/BracketPage.tsx:144 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0113 | 賽程與對局／間接／runtime／待確認載入 | 規則與讓武項目 | web/src/features/bracket/BracketPage.tsx:145 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0114 | 賽程與對局／間接／runtime／待確認載入 | 〔動態 live ? <span className={styles.liveDot} aria-hidden="true" /> : null〕 〔動態 live ? '直播中 · 看直播' : '看直播'〕 | web/src/features/bracket/MatchPage.tsx:205 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0115 | 賽程與對局／間接／runtime／待確認載入 | 返回賽程 | web/src/features/bracket/MatchPage.tsx:258 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0116 | 賽程與對局／間接／runtime／待確認載入 | 規則與讓武項目 | web/src/features/bracket/MatchPage.tsx:259 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0117 | 全站導覽與開場／/home、/judge/login、/judge、/judge/[slug]/m/[matchId]、/judge/[slug]、/、/sportsbook、/t/[slug]/enroll、/t/[slug]/me/handicap、/t/[slug]/me、/t/[slug]/signup、/tools | ! | web/src/features/chrome/HelpTip.tsx:4 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0118 | 全站導覽與開場／間接／runtime／待確認載入 | 〔動態 label〕 | web/src/features/chrome/SiteNav.tsx:41 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0119 | 全站導覽與開場／間接／runtime／待確認載入 |  | web/src/features/chrome/SiteNav.tsx:49 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0120 | 全站導覽與開場／間接／runtime／待確認載入 | 會員專區 | web/src/features/chrome/SiteNav.tsx:60 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0121 | 全站導覽與開場／間接／runtime／待確認載入 |  | web/src/features/chrome/SiteNav.tsx:68 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0122 | 全站導覽與開場／間接／runtime／待確認載入 |  | web/src/features/chrome/SiteNav.tsx:88 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0123 | 全站導覽與開場／間接／runtime／待確認載入 |  | web/src/features/chrome/SiteNav.tsx:96 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0124 | 全站導覽與開場／間接／runtime／待確認載入 | 會員專區 | web/src/features/chrome/SiteNav.tsx:106 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0125 | 全站導覽與開場／間接／runtime／待確認載入 | 小工具 | web/src/features/chrome/SiteNav.tsx:112 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0126 | 全站導覽與開場／間接／runtime／待確認載入 | 備戰方案 | web/src/features/chrome/SiteNav.tsx:113 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0127 | 全站導覽與開場／間接／runtime／待確認載入 | 靜態閱讀 | web/src/features/chrome/SiteNav.tsx:114 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0128 | 讓武商店／/t/[slug]/me/handicap | 用遊戲ID 進站 | web/src/features/handicap/HandicapShop.tsx:161 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0129 | 讓武商店／/t/[slug]/me/handicap | 我的報名 | web/src/features/handicap/HandicapShop.tsx:184 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0130 | 讓武商店／/t/[slug]/me/handicap | 規則與讓武項目 | web/src/features/handicap/HandicapShop.tsx:187 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0131 | 讓武商店／/t/[slug]/me/handicap | 這一場 | web/src/features/handicap/HandicapShop.tsx:207 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0132 | 讓武商店／/t/[slug]/me/handicap | 規則與讓武項目 | web/src/features/handicap/HandicapShop.tsx:210 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0133 | 讓武商店／/t/[slug]/me/handicap | 〔動態 g.label〕 | web/src/features/handicap/HandicapShop.tsx:321 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0134 | 讓武商店／/t/[slug]/me/handicap | 買下 | web/src/features/handicap/ItemCard.tsx:101 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0135 | 讓武商店／/t/[slug]/me/handicap | 退掉 | web/src/features/handicap/SelectionList.tsx:144 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0136 | 舊劇場／需確認載入／間接／runtime／待確認載入 | 〔動態 〕 {label} | web/src/features/landing/doc/SealButton.tsx:86 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0137 | 舊劇場／需確認載入／間接／runtime／待確認載入 | {String(i).padStart(3, '0')} {s.kicker} | web/src/features/landing/StopRail.tsx:64 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0138 | 其他功能與路由／/home、/、/sportsbook、/tools | 建立房間 | web/src/features/match-tools/ToolsRoom.tsx:286 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0139 | 其他功能與路由／/home、/、/sportsbook、/tools | 加入房間 | web/src/features/match-tools/ToolsRoom.tsx:311 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0140 | 其他功能與路由／/home、/、/sportsbook、/tools | 複製連結 | web/src/features/match-tools/ToolsRoom.tsx:324 | 資料工具：輕量紙墨分組；匯入需驗證，匯出與提交區隔 |
| B0141 | 其他功能與路由／/home、/、/sportsbook、/tools | 複製代碼 | web/src/features/match-tools/ToolsRoom.tsx:327 | 資料工具：輕量紙墨分組；匯入需驗證，匯出與提交區隔 |
| B0142 | 其他功能與路由／/home、/、/sportsbook、/tools | 返回江湖雅戲 | web/src/features/match-tools/ToolsRoom.tsx:339 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0143 | 其他功能與路由／/home、/、/sportsbook、/tools | 〔動態 owner ? '關閉房間' : '離開房間'〕 | web/src/features/match-tools/ToolsRoom.tsx:368 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0144 | 其他功能與路由／/home、/、/sportsbook、/tools | 〔動態 room.roundNumber ? '開始下一回合' : '開始回合'〕 | web/src/features/match-tools/ToolsRoom.tsx:432 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0145 | 其他功能與路由／/home、/、/sportsbook、/tools | 擲出 〔動態 room.diceCount〕 顆骰子 | web/src/features/match-tools/ToolsRoom.tsx:457 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0146 | 其他功能與路由／/home、/、/sportsbook、/tools | 〔動態 label〕 | web/src/features/match-tools/ToolsRoom.tsx:475 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0147 | 其他功能與路由／/home、/、/sportsbook、/tools | 取消回合 | web/src/features/match-tools/ToolsRoom.tsx:495 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0148 | 其他功能與路由／/auth/continue | 重新登入 Discord | web/src/features/member/AuthContinue.tsx:33 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0149 | 其他功能與路由／/judge/login、/t/[slug]/login、/t/[slug]/me、/t/[slug]/signup | Discord 快速註冊／登入 | web/src/features/member/DiscordAccess.tsx:15 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0150 | 其他功能與路由／/auth/continue、/t/[slug]/login、/t/[slug]/me、/t/[slug]/signup | 登入 | web/src/features/member/MemberAccess.tsx:31 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0151 | 其他功能與路由／/auth/continue、/t/[slug]/login、/t/[slug]/me、/t/[slug]/signup | 註冊 | web/src/features/member/MemberAccess.tsx:37 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0152 | 其他功能與路由／/t/[slug]/me | 登出 | web/src/features/member/MemberLogout.tsx:31 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0153 | 其他功能與路由／/t/[slug]/me | 切換頁面 · 〔動態 current〕 {open ? '−' : '＋'} | web/src/features/member/MemberShell.tsx:50 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0154 | 其他功能與路由／/t/[slug]/me | 〔動態 label〕 | web/src/features/member/MemberShell.tsx:62 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0155 | 其他功能與路由／/t/[slug]/me | 江湖雅戲 | web/src/features/member/MemberShell.tsx:72 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0156 | 其他功能與路由／/t/[slug]/me | 管理賽事 | web/src/features/member/MemberShell.tsx:73 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0157 | 其他功能與路由／/t/[slug]/me | 規則與讓武說明 | web/src/features/member/MemberShell.tsx:74 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0158 | 其他功能與路由／/t/[slug]/me | 賽程 | web/src/features/member/MemberShell.tsx:75 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0159 | 其他功能與路由／/t/[slug]/me | 重試 | web/src/features/member/MemberWorkspace.tsx:65 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0160 | 其他功能與路由／/t/[slug]/me | 前往報名 | web/src/features/member/MemberWorkspace.tsx:103 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0161 | 其他功能與路由／/t/[slug]/me | 查看本場讓武 → | web/src/features/member/PersonalArmory.tsx:87 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0162 | 其他功能與路由／/home、/judge/[slug]、/、/t/[slug]/enroll、/t/[slug]/me | 重新連線 | web/src/features/realtime/ConnectionStatus.tsx:22 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0163 | 報名與會員／/home、/、/t/[slug]/enroll、/t/[slug]/me | 移除原時段 | web/src/features/signup/AvailabilityFields.tsx:74 | 危險／關鍵操作：明確動詞、權限與結果；確認機制依影響程度設計 |
| B0164 | 報名與會員／/home、/、/t/[slug]/enroll、/t/[slug]/me | − | web/src/features/signup/AvailabilityFields.tsx:114 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0165 | 報名與會員／/home、/、/t/[slug]/enroll、/t/[slug]/me | ＋ 新增時段 | web/src/features/signup/AvailabilityFields.tsx:124 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0166 | 報名與會員／間接／runtime／待確認載入 | 從武庫選擇 〔動態 f.label〕 | web/src/features/signup/CharacterArsenal.tsx:138 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0167 | 報名與會員／間接／runtime／待確認載入 | 清除 〔動態 f.label〕 | web/src/features/signup/CharacterArsenal.tsx:159 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0168 | 報名與會員／間接／runtime／待確認載入 | 完成選擇 | web/src/features/signup/CharacterArsenal.tsx:191 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0169 | 報名與會員／間接／runtime／待確認載入 | 〔動態 groupLabels[g]〕 | web/src/features/signup/CharacterArsenal.tsx:198 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0170 | 報名與會員／間接／runtime／待確認載入 | 重新讀取 | web/src/features/signup/CharacterArsenal.tsx:213 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0171 | 報名與會員／間接／runtime／待確認載入 | 〔動態 group === 'builds' ? ( <BuildCard name={item.name} /> 〕 〔動態 group === 'builds' && ( <span hidden id={`${id}-${item.key}-weapons`〕 {values[field.key].split('、').includes(item.name) ? '✓'  | web/src/features/signup/CharacterArsenal.tsx:222 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0172 | 報名與會員／/home、/、/t/[slug]/enroll、/t/[slug]/me | 重新讀取武學 | web/src/features/signup/MartialSelect.tsx:63 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0173 | 報名與會員／/t/[slug]/signup | 註冊並登入 | web/src/features/signup/MemberRegistration.tsx:111 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0174 | 報名與會員／/t/[slug]/me | 登入會員 | web/src/features/signup/MyPlayer.tsx:158 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0175 | 報名與會員／/t/[slug]/me | 還沒報名 | web/src/features/signup/MyPlayer.tsx:161 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0176 | 報名與會員／/t/[slug]/me | 重新確認登入狀態 | web/src/features/signup/MyPlayer.tsx:174 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0177 | 報名與會員／/t/[slug]/me | 〔動態 view === 'all' ? '離站' : '登出'〕 | web/src/features/signup/MyPlayer.tsx:276 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0178 | 報名與會員／/t/[slug]/me | 修改 | web/src/features/signup/MyPlayer.tsx:333 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0179 | 報名與會員／/t/[slug]/me | 儲存 | web/src/features/signup/MyPlayer.tsx:378 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0180 | 報名與會員／/t/[slug]/me | 取消 | web/src/features/signup/MyPlayer.tsx:387 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0181 | 報名與會員／/t/[slug]/me | 查看角色配置 | web/src/features/signup/MyPlayer.tsx:463 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0182 | 報名與會員／/t/[slug]/me | 賽事頁 | web/src/features/signup/MyPlayer.tsx:471 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0183 | 報名與會員／/t/[slug]/me | 規則與讓武項目 | web/src/features/signup/MyPlayer.tsx:474 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0184 | 報名與會員／/t/[slug]/me | 本場讓武 | web/src/features/signup/MyPlayer.tsx:479 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0185 | 報名與會員／/t/[slug]/me | 這一場 | web/src/features/signup/MyPlayer.tsx:482 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0186 | 報名與會員／/t/[slug]/me | 本屆規則 | web/src/features/signup/MyPlayer.tsx:542 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0187 | 報名與會員／/t/[slug]/login、/t/[slug]/me | 登入 | web/src/features/signup/PlayerLogin.tsx:97 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0188 | 報名與會員／/home、/、/t/[slug]/enroll、/t/[slug]/me | 本屆規則 | web/src/features/signup/RegistrationFields.tsx:154 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0189 | 報名與會員／/home、/、/t/[slug]/enroll、/t/[slug]/me | 編輯個人武庫 ↗ | web/src/features/signup/SelectedLoadout.tsx:145 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0190 | 報名與會員／/home、/、/t/[slug]/enroll、/t/[slug]/me | 重試 | web/src/features/signup/SelectedLoadout.tsx:188 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0191 | 報名與會員／/home、/、/t/[slug]/enroll、/t/[slug]/me | 〔動態 confirming ? '儲存中…' : confirmLabel〕 | web/src/features/signup/SelectedLoadout.tsx:218 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0192 | 報名與會員／/home、/、/t/[slug]/enroll、/t/[slug]/me | 前往武器庫配置 | web/src/features/signup/SelectedLoadout.tsx:257 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0193 | 報名與會員／/home、/、/t/[slug]/enroll、/t/[slug]/me | 重新讀取 | web/src/features/signup/SelectedLoadout.tsx:265 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0194 | 報名與會員／/home、/、/t/[slug]/enroll、/t/[slug]/me | {role.name} {role.ready ? '檢視配置' : '尚未完成配置'} | web/src/features/signup/SelectedLoadout.tsx:273 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0195 | 報名與會員／/home、/、/t/[slug]/enroll、/t/[slug]/me | 使用此武庫，確認 | web/src/features/signup/SelectedLoadout.tsx:297 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0196 | 報名與會員／/home、/、/t/[slug]/enroll | 確認報名 | web/src/features/signup/SignupForm.tsx:188 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0197 | 報名與會員／/home、/、/t/[slug]/enroll | 使用帳號註冊／登入 | web/src/features/signup/SignupPage.tsx:63 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0198 | 報名與會員／/home、/、/t/[slug]/enroll | 重試 | web/src/features/signup/SignupPage.tsx:73 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0199 | 報名與會員／/home、/、/t/[slug]/enroll | 查看我的報名 | web/src/features/signup/SignupPage.tsx:82 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0200 | 報名與會員／/home、/、/t/[slug]/enroll | 查看報名武庫 | web/src/features/signup/SignupPage.tsx:85 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0201 | 觀局與活動／/home、/、/sportsbook | 抽籤與籤位安排 | web/src/features/sportsbook/ManagerOperations.tsx:114 | 危險／關鍵操作：明確動詞、權限與結果；確認機制依影響程度設計 |
| B0202 | 觀局與活動／/home、/、/sportsbook | 〔動態 drawing === 'seats' ? '求籤中…' : '抽取籤位'〕 | web/src/features/sportsbook/ManagerOperations.tsx:130 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0203 | 觀局與活動／/home、/、/sportsbook | 確認套用籤位 | web/src/features/sportsbook/ManagerOperations.tsx:199 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0204 | 觀局與活動／/home、/、/sportsbook | 下注類型與盤口開關 | web/src/features/sportsbook/ManagerOperations.tsx:224 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0205 | 觀局與活動／/home、/、/sportsbook | 全部暫停 | web/src/features/sportsbook/ManagerOperations.tsx:237 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0206 | 觀局與活動／/home、/、/sportsbook | 開放未開賽項目 | web/src/features/sportsbook/ManagerOperations.tsx:249 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0207 | 觀局與活動／/home、/、/sportsbook | 儲存名稱 | web/src/features/sportsbook/ManagerOperations.tsx:310 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0208 | 觀局與活動／/home、/、/sportsbook | 〔動態 m.status === 'open' ? '暫停投注' : '重新開放'〕 | web/src/features/sportsbook/ManagerOperations.tsx:311 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0209 | 觀局與活動／/home、/、/sportsbook | 抽獎與頒獎 | web/src/features/sportsbook/ManagerOperations.tsx:334 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0210 | 觀局與活動／/home、/、/sportsbook | 〔動態 drawing === 'raffle' ? '抽籤中…' : `抽取 1 名（${eligible.length} 人）`〕 | web/src/features/sportsbook/ManagerOperations.tsx:378 | 危險／關鍵操作：明確動詞、權限與結果；確認機制依影響程度設計 |
| B0211 | 觀局與活動／/home、/、/sportsbook | 查看本次抽獎名單（ 〔動態 eligible.length〕 人） | web/src/features/sportsbook/ManagerOperations.tsx:397 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0212 | 觀局與活動／/home、/、/sportsbook | 標記頒發 | web/src/features/sportsbook/ManagerOperations.tsx:409 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0213 | 觀局與活動／/home、/、/sportsbook | 登錄獎項 | web/src/features/sportsbook/ManagerOperations.tsx:470 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0214 | 觀局與活動／/home、/、/sportsbook | 標記頒發 | web/src/features/sportsbook/ManagerOperations.tsx:482 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0215 | 觀局與活動／間接／runtime／待確認載入 | 擲骰比大小 | web/src/features/sportsbook/MatchTools.tsx:88 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0216 | 觀局與活動／間接／runtime／待確認載入 | 剪刀石頭布 | web/src/features/sportsbook/MatchTools.tsx:98 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0217 | 觀局與活動／間接／runtime／待確認載入 | 〔動態 rolling ? '擲骰中…' : dice ? '再擲一次' : '雙方擲骰'〕 | web/src/features/sportsbook/MatchTools.tsx:153 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0218 | 觀局與活動／間接／runtime／待確認載入 | 我是 〔動態 name(1)〕 ，開始選擇 | web/src/features/sportsbook/MatchTools.tsx:163 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0219 | 觀局與活動／間接／runtime／待確認載入 | 〔動態 hand〕 | web/src/features/sportsbook/MatchTools.tsx:175 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0220 | 觀局與活動／間接／runtime／待確認載入 | 〔動態 choices.length === 2 ? '再猜一次' : '重新開始'〕 | web/src/features/sportsbook/MatchTools.tsx:217 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0221 | 觀局與活動／/home、/、/sportsbook | 移除 | web/src/features/sportsbook/ParticipantBp.tsx:120 | 危險／關鍵操作：明確動詞、權限與結果；確認機制依影響程度設計 |
| B0222 | 觀局與活動／/home、/、/sportsbook | 退還 BP | web/src/features/sportsbook/ParticipantBp.tsx:146 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0223 | 觀局與活動／/home、/、/sportsbook | 〔動態 category〕 | web/src/features/sportsbook/ParticipantBp.tsx:175 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0224 | 觀局與活動／/home、/、/sportsbook | 〔動態 selected ? '已選擇' : !affordable ? 'BP 不足' : '加入讓武'〕 | web/src/features/sportsbook/ParticipantBp.tsx:201 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0225 | 觀局與活動／/home、/、/sportsbook | 我的武學配置 → | web/src/features/sportsbook/Participation.tsx:269 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0226 | 觀局與活動／/home、/、/sportsbook | 賽制 | web/src/features/sportsbook/Participation.tsx:320 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0227 | 觀局與活動／/home、/、/sportsbook | 讓武原則 | web/src/features/sportsbook/Participation.tsx:322 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0228 | 觀局與活動／/home、/、/sportsbook | {i + 1} 〔動態 label〕 | web/src/features/sportsbook/Participation.tsx:338 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0229 | 觀局與活動／/home、/、/sportsbook | 查看我的對局 · 第 〔動態 m.round〕 輪 | web/src/features/sportsbook/Participation.tsx:351 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0230 | 觀局與活動／/home、/、/sportsbook | 修改報名資料與角色 | web/src/features/sportsbook/Participation.tsx:393 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0231 | 觀局與活動／/home、/、/sportsbook | 查看我的對局 · 〔動態 m.kind === 'third' ? '季軍戰' : `第 ${m.round} 輪`〕 | web/src/features/sportsbook/Participation.tsx:403 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0232 | 觀局與活動／/home、/、/sportsbook | 查看規則 ↗ | web/src/features/sportsbook/Participation.tsx:416 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0233 | 觀局與活動／/home、/、/sportsbook | 登入查看我的報名 | web/src/features/sportsbook/Participation.tsx:435 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0234 | 觀局與活動／/home、/、/sportsbook | 查看規則與讓武說明 ↗ | web/src/features/sportsbook/Participation.tsx:436 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0235 | 觀局與活動／/home、/、/sportsbook | {i 〔動態 label〕 | web/src/features/sportsbook/Participation.tsx:461 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0236 | 觀局與活動／/home、/、/sportsbook | 〔動態 selectedRole ? '編輯這個備戰角色 ↗' : '前往我的武學配置 ↗'〕 | web/src/features/sportsbook/Participation.tsx:585 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0237 | 觀局與活動／/home、/、/sportsbook | 查看完整配置 | web/src/features/sportsbook/Participation.tsx:614 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0238 | 觀局與活動／/home、/、/sportsbook | 給大會的備註（選填） | web/src/features/sportsbook/Participation.tsx:620 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0239 | 觀局與活動／/home、/、/sportsbook | 修改報名資料 | web/src/features/sportsbook/Participation.tsx:640 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0240 | 觀局與活動／/home、/、/sportsbook | 修改角色設定 | web/src/features/sportsbook/Participation.tsx:652 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0241 | 觀局與活動／/home、/、/sportsbook | 上一步 | web/src/features/sportsbook/Participation.tsx:679 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0242 | 觀局與活動／/home、/、/sportsbook | 〔動態 busy && savingComplete === false ? '正在儲存…' : saved?.st〕 | web/src/features/sportsbook/Participation.tsx:684 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0243 | 觀局與活動／/home、/、/sportsbook | 〔動態 busy && savingComplete === true ? '正在儲存…' : step === 3 〕 | web/src/features/sportsbook/Participation.tsx:697 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0244 | 觀局與活動／/home、/、/sportsbook | 〔動態 busy ? '正在儲存…' : '儲存活動設定'〕 | web/src/features/sportsbook/Participation.tsx:803 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0245 | 觀局與活動／/home、/、/sportsbook | 參賽者報名入口 ↗ | web/src/features/sportsbook/Participation.tsx:812 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0246 | 觀局與活動／/home、/、/sportsbook | 查看完整賽程 ↗ | web/src/features/sportsbook/Participation.tsx:815 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0247 | 觀局與活動／/home、/、/sportsbook | 〔動態 e.name〕 · 〔動態 e.status === 'confirmed' ? '已完成報名' : '草稿'〕 | web/src/features/sportsbook/Participation.tsx:821 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0248 | 觀局與活動／/home、/、/sportsbook | ↑ | web/src/features/sportsbook/Participation.tsx:874 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0249 | 觀局與活動／/home、/、/sportsbook | 發布對局（ 〔動態 ids.length〕 人） | web/src/features/sportsbook/Participation.tsx:888 | 危險／關鍵操作：明確動詞、權限與結果；確認機制依影響程度設計 |
| B0250 | 觀局與活動／/home、/、/sportsbook | 重新讀取報名表 | web/src/features/sportsbook/RegistrationEntry.tsx:74 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0251 | 觀局與活動／/home、/、/sportsbook | 重新讀取 | web/src/features/sportsbook/SavedLoadoutRoles.tsx:76 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0252 | 觀局與活動／/home、/、/sportsbook | {role.name} {!role.ready ? '配置未完成，請前往我的武學配置' : selected === role.source + ':' + role.id ? '已套用' : '套用角色'}{' '} · {role.source === 'library' ? '本機角色庫' : '此活動'} | web/src/features/sportsbook/SavedLoadoutRoles.tsx:83 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0253 | 觀局與活動／/home、/、/sportsbook | 〔動態 paper ? '返回' : '×'〕 | web/src/features/sportsbook/Sportsbook.tsx:148 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0254 | 觀局與活動／/home、/、/sportsbook | 〔動態 x〕 | web/src/features/sportsbook/Sportsbook.tsx:741 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0255 | 觀局與活動／/home、/、/sportsbook | 〔動態 busy ? '處理中…' : authMode === '註冊' ? '註冊並領取 1,000 點' 〕 | web/src/features/sportsbook/Sportsbook.tsx:789 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0256 | 觀局與活動／/home、/、/sportsbook | 重新讀取 | web/src/features/sportsbook/Sportsbook.tsx:814 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0257 | 觀局與活動／/home、/、/sportsbook | 登出 | web/src/features/sportsbook/Sportsbook.tsx:852 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0258 | 觀局與活動／/home、/、/sportsbook | 〔動態 scrollForm ? '登入／註冊' : '登入／註冊領 1,000 點'〕 | web/src/features/sportsbook/Sportsbook.tsx:869 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0259 | 觀局與活動／/home、/、/sportsbook | 返回賽程 ↗ | web/src/features/sportsbook/Sportsbook.tsx:875 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0260 | 觀局與活動／/home、/、/sportsbook | 檢視模式 | web/src/features/sportsbook/Sportsbook.tsx:893 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0261 | 觀局與活動／/home、/、/sportsbook | 管理模式 | web/src/features/sportsbook/Sportsbook.tsx:907 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0262 | 觀局與活動／/home、/、/sportsbook | 本屆切換固定報價 | web/src/features/sportsbook/Sportsbook.tsx:950 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0263 | 觀局與活動／/home、/、/sportsbook | 以目前賽程建立試玩 | web/src/features/sportsbook/Sportsbook.tsx:955 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0264 | 觀局與活動／/home、/、/sportsbook | 〔動態 t〕 | web/src/features/sportsbook/Sportsbook.tsx:977 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0265 | 觀局與活動／/home、/、/sportsbook | 小工具 | web/src/features/sportsbook/Sportsbook.tsx:986 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0266 | 觀局與活動／/home、/、/sportsbook | 重新讀取 | web/src/features/sportsbook/Sportsbook.tsx:1007 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0267 | 觀局與活動／/home、/、/sportsbook | 我的報名與角色 | web/src/features/sportsbook/Sportsbook.tsx:1022 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0268 | 觀局與活動／/home、/、/sportsbook | 查看觀局紀錄 | web/src/features/sportsbook/Sportsbook.tsx:1023 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0269 | 觀局與活動／/home、/、/sportsbook | 〔動態 e.name〕 | web/src/features/sportsbook/Sportsbook.tsx:1033 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0270 | 觀局與活動／/home、/、/sportsbook | 前往報名書卷 ↗ | web/src/features/sportsbook/Sportsbook.tsx:1043 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0271 | 觀局與活動／/home、/、/sportsbook | 前往比武 ↗ | web/src/features/sportsbook/Sportsbook.tsx:1046 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0272 | 觀局與活動／/home、/、/sportsbook | 左方勝 賠率待公布 | web/src/features/sportsbook/Sportsbook.tsx:1136 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0273 | 觀局與活動／/home、/、/sportsbook | 右方勝 賠率待公布 | web/src/features/sportsbook/Sportsbook.tsx:1139 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0274 | 觀局與活動／/home、/、/sportsbook | 查看報名與角色設定 | web/src/features/sportsbook/Sportsbook.tsx:1172 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0275 | 觀局與活動／/home、/、/sportsbook | {i === 1 && selected.bye ? '輪空' : name(id)} {id ? '查看備戰配置' : '等待前場結果'} | web/src/features/sportsbook/Sportsbook.tsx:1202 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0276 | 觀局與活動／/home、/、/sportsbook | 進入比武場景 ↗ | web/src/features/sportsbook/Sportsbook.tsx:1221 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0277 | 觀局與活動／/home、/、/sportsbook | 〔動態 busy && lastAction?.type === 'vote' && 〕 | web/src/features/sportsbook/Sportsbook.tsx:1312 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0278 | 觀局與活動／/home、/、/sportsbook | 〔動態 oddsText(odds[o.id]!)〕 × 選擇 {o.label} | web/src/features/sportsbook/Sportsbook.tsx:1342 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0279 | 觀局與活動／/home、/、/sportsbook | 登入查看 | web/src/features/sportsbook/Sportsbook.tsx:1374 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0280 | 觀局與活動／/home、/、/sportsbook | 查看各組結果（ 〔動態 b.combinations.length〕 組） | web/src/features/sportsbook/Sportsbook.tsx:1416 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0281 | 觀局與活動／/home、/、/sportsbook | 登入查看 | web/src/features/sportsbook/Sportsbook.tsx:1456 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0282 | 觀局與活動／/home、/、/sportsbook | 〔動態 busy ? '正在綁定…' : '綁定，不重複贈點'〕 | web/src/features/sportsbook/Sportsbook.tsx:1509 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0283 | 觀局與活動／/home、/、/sportsbook | 申請兌換 | web/src/features/sportsbook/Sportsbook.tsx:1531 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0284 | 觀局與活動／/home、/、/sportsbook | 登入查看 | web/src/features/sportsbook/Sportsbook.tsx:1556 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0285 | 觀局與活動／/home、/、/sportsbook | 前往獎品兌換 | web/src/features/sportsbook/Sportsbook.tsx:1566 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0286 | 觀局與活動／/home、/、/sportsbook | 取消並退款 | web/src/features/sportsbook/Sportsbook.tsx:1580 | 危險／關鍵操作：明確動詞、權限與結果；確認機制依影響程度設計 |
| B0287 | 觀局與活動／/home、/、/sportsbook | 另開一屆試玩 | web/src/features/sportsbook/Sportsbook.tsx:1612 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0288 | 觀局與活動／/home、/、/sportsbook | 〔動態 busy ? '正在儲存…' : '建立活動'〕 | web/src/features/sportsbook/Sportsbook.tsx:1667 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0289 | 觀局與活動／/home、/、/sportsbook | 會員與參賽者對應 | web/src/features/sportsbook/Sportsbook.tsx:1733 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0290 | 觀局與活動／/home、/、/sportsbook | 賽果與結算 | web/src/features/sportsbook/Sportsbook.tsx:1768 | 危險／關鍵操作：明確動詞、權限與結果；確認機制依影響程度設計 |
| B0291 | 觀局與活動／/home、/、/sportsbook | 開始比賽 | web/src/features/sportsbook/Sportsbook.tsx:1787 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0292 | 觀局與活動／/home、/、/sportsbook | 填寫逐局賽果 | web/src/features/sportsbook/Sportsbook.tsx:1805 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0293 | 觀局與活動／/home、/、/sportsbook | 檢查結算 | web/src/features/sportsbook/Sportsbook.tsx:1815 | 危險／關鍵操作：明確動詞、權限與結果；確認機制依影響程度設計 |
| B0294 | 觀局與活動／/home、/、/sportsbook | 比武 ↗ | web/src/features/sportsbook/Sportsbook.tsx:1847 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0295 | 觀局與活動／/home、/、/sportsbook | 盤口與賠率設定 | web/src/features/sportsbook/Sportsbook.tsx:1853 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0296 | 觀局與活動／/home、/、/sportsbook | 設定／作廢 | web/src/features/sportsbook/Sportsbook.tsx:1882 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0297 | 觀局與活動／/home、/、/sportsbook | 獎品與兌換審核 | web/src/features/sportsbook/Sportsbook.tsx:1897 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0298 | 觀局與活動／/home、/、/sportsbook | 新增獎品 | web/src/features/sportsbook/Sportsbook.tsx:1898 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0299 | 觀局與活動／/home、/、/sportsbook | 編輯 | web/src/features/sportsbook/Sportsbook.tsx:1918 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0300 | 觀局與活動／/home、/、/sportsbook | 核准 | web/src/features/sportsbook/Sportsbook.tsx:1931 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0301 | 觀局與活動／/home、/、/sportsbook | 標記已發放 | web/src/features/sportsbook/Sportsbook.tsx:1946 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0302 | 觀局與活動／/home、/、/sportsbook | 取消退款 | web/src/features/sportsbook/Sportsbook.tsx:1965 | 危險／關鍵操作：明確動詞、權限與結果；確認機制依影響程度設計 |
| B0303 | 觀局與活動／/home、/、/sportsbook | 〔動態 legs.length〕 個選項 · 〔動態 ' '〕 〔動態 selectedCombinations.length === 1 ? `${exactOdds(selectedCombinations[0]〕 〔動態 ' '〕 · 〔動態 slipOpen ? '繼續選盤 ↓' : '查看注單 ↑'〕 | web/src/features/sportsbook/Sportsbook.tsx:1998 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0304 | 觀局與活動／/home、/、/sportsbook | 查看我的選擇（ 〔動態 legs.length〕 ） | web/src/features/sportsbook/Sportsbook.tsx:2032 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0305 | 觀局與活動／/home、/、/sportsbook | 〔動態 n〕 | web/src/features/sportsbook/Sportsbook.tsx:2078 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0306 | 觀局與活動／/home、/、/sportsbook | 檢查注單 | web/src/features/sportsbook/Sportsbook.tsx:2107 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0307 | 觀局與活動／/home、/、/sportsbook | × | web/src/features/sportsbook/Sportsbook.tsx:2153 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0308 | 觀局與活動／/home、/、/sportsbook | 進階設定（選填） | web/src/features/sportsbook/Sportsbook.tsx:2170 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0309 | 觀局與活動／/home、/、/sportsbook | 計算方式與點數上限 | web/src/features/sportsbook/Sportsbook.tsx:2226 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0310 | 觀局與活動／/home、/、/sportsbook | 查看 〔動態 selectedCombinations.length〕 個組合的賠率 | web/src/features/sportsbook/Sportsbook.tsx:2235 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0311 | 觀局與活動／/home、/、/sportsbook | 更新賠率 | web/src/features/sportsbook/Sportsbook.tsx:2260 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0312 | 觀局與活動／/home、/、/sportsbook | 〔動態 legs.length ? '完成，回去填點數' : '返回挑選結果'〕 | web/src/features/sportsbook/Sportsbook.tsx:2261 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0313 | 觀局與活動／/home、/、/sportsbook | 返回修改 | web/src/features/sportsbook/Sportsbook.tsx:2434 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0314 | 觀局與活動／/home、/、/sportsbook | 〔動態 busy ? '處理中…' : confirmLabel(confirm.command)〕 | web/src/features/sportsbook/Sportsbook.tsx:2437 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0315 | 觀局與活動／/home、/、/sportsbook | 〔動態 busy ? '正在儲存…' : '儲存賽果草稿'〕 | web/src/features/sportsbook/Sportsbook.tsx:2522 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0316 | 觀局與活動／/home、/、/sportsbook | 〔動態 busy ? '正在儲存…' : '儲存設定'〕 | web/src/features/sportsbook/Sportsbook.tsx:2619 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0317 | 觀局與活動／/home、/、/sportsbook | 作廢此盤 | web/src/features/sportsbook/Sportsbook.tsx:2639 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0318 | 觀局與活動／/home、/、/sportsbook | 〔動態 busy ? '正在儲存…' : '儲存獎品'〕 | web/src/features/sportsbook/Sportsbook.tsx:2693 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0319 | 觀局與活動／/home、/ | 前往我的武學配置 → | web/src/features/sportsbook/SportsbookBridge.tsx:305 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0320 | 其他功能與路由／間接／runtime／待確認載入 | 我已報名,進站 | web/src/features/tournament/TournamentHome.tsx:102 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0321 | 其他功能與路由／間接／runtime／待確認載入 | 〔動態 `我的報名(${me})`〕 | web/src/features/tournament/TournamentHome.tsx:104 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0322 | 其他功能與路由／間接／runtime／待確認載入 | 賽程 | web/src/features/tournament/TournamentHome.tsx:107 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0323 | 其他功能與路由／間接／runtime／待確認載入 | 規則與讓武項目 | web/src/features/tournament/TournamentHome.tsx:108 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0324 | 其他功能與路由／間接／runtime／待確認載入 | 報名參賽 | web/src/features/tournament/TournamentHome.tsx:126 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0325 | 共用元件／/home、/judge/login、/judge、/judge/[slug]/m/[matchId]、/judge/[slug]、/kitchen-sink、/、/t/[slug]/enroll、/t/[slug]/login、/t/[slug]/me/handicap、/t/[slug]/me、/t/[slug]/signup | 〔動態 r.label〕 | packages/ui/src/patterns/BracketTree.tsx:100 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0326 | 共用元件／/home、/judge/login、/judge、/judge/[slug]/m/[matchId]、/judge/[slug]、/kitchen-sink、/、/t/[slug]/enroll、/t/[slug]/login、/t/[slug]/me/handicap、/t/[slug]/me、/t/[slug]/signup | 〔動態 body〕 | packages/ui/src/patterns/BracketTree.tsx:188 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0327 | 共用元件／/home、/judge/login、/judge、/judge/[slug]/m/[matchId]、/judge/[slug]、/kitchen-sink、/、/t/[slug]/enroll、/t/[slug]/login、/t/[slug]/me/handicap、/t/[slug]/me、/t/[slug]/signup | {children} {hint === undefined ? null : {hint}} ↗ | packages/ui/src/patterns/InkLink.tsx:26 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0328 | 共用元件／/home、/judge/login、/judge、/judge/[slug]/m/[matchId]、/judge/[slug]、/kitchen-sink、/、/t/[slug]/enroll、/t/[slug]/login、/t/[slug]/me/handicap、/t/[slug]/me、/t/[slug]/signup | 〔動態 loading ? <span className={styles.spinner} aria-hidden="true" /> : null〕 〔動態 children〕 | packages/ui/src/primitives/Button.tsx:32 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0329 | 首頁與開場／/home | 了解賽制 | design/lunjian/lab/home.html:117 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0330 | 首頁與開場／/home | 提筆報名 | design/lunjian/lab/home.html:117 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0331 | 七章與舞台／章節內動態模板 | 跳到內容 | design/lunjian/lab/lunjian-layout.html:2254 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0332 | 七章與舞台／章節內動態模板 | 點擊畫面，點燃布幕 CLICK TO IGNITE | design/lunjian/lab/lunjian-layout.html:2332 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0333 | 七章與舞台／章節內動態模板 | 夜鴉閣 | design/lunjian/lab/lunjian-layout.html:2354 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0334 | 七章與舞台／章節內動態模板 | 宗旨 | design/lunjian/lab/lunjian-layout.html:2354 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0335 | 七章與舞台／章節內動態模板 | 規則說明 | design/lunjian/lab/lunjian-layout.html:2354 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0336 | 七章與舞台／章節內動態模板 | 讓武 | design/lunjian/lab/lunjian-layout.html:2354 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0337 | 七章與舞台／章節內動態模板 | 報名 | design/lunjian/lab/lunjian-layout.html:2354 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0338 | 七章與舞台／章節內動態模板 | 比武 | design/lunjian/lab/lunjian-layout.html:2354 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0339 | 七章與舞台／章節內動態模板 | 賽程 | design/lunjian/lab/lunjian-layout.html:2354 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0340 | 七章與舞台／章節內動態模板 | 獎賞 | design/lunjian/lab/lunjian-layout.html:2354 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0341 | 七章與舞台／章節內動態模板 | 場景 | design/lunjian/lab/lunjian-layout.html:2354 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0342 | 七章與舞台／章節內動態模板 | 輕量場景 | design/lunjian/lab/lunjian-layout.html:2354 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0343 | 七章與舞台／章節內動態模板 | 3D 場景 | design/lunjian/lab/lunjian-layout.html:2354 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0344 | 七章與舞台／章節內動態模板 | 會員專區 登入／註冊 | design/lunjian/lab/lunjian-layout.html:2354 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0345 | 七章與舞台／章節內動態模板 | 開啟導覽選單 | design/lunjian/lab/lunjian-layout.html:2354 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0346 | 七章與舞台／章節內動態模板 | 夜鴉閣 | design/lunjian/lab/lunjian-layout.html:2355 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0347 | 七章與舞台／章節內動態模板 | 關閉導覽選單 | design/lunjian/lab/lunjian-layout.html:2355 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0348 | 七章與舞台／章節內動態模板 | 宗旨 | design/lunjian/lab/lunjian-layout.html:2355 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0349 | 七章與舞台／章節內動態模板 | 規則說明 | design/lunjian/lab/lunjian-layout.html:2355 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0350 | 七章與舞台／章節內動態模板 | 讓武 | design/lunjian/lab/lunjian-layout.html:2355 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0351 | 七章與舞台／章節內動態模板 | 報名 | design/lunjian/lab/lunjian-layout.html:2355 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0352 | 七章與舞台／章節內動態模板 | 比武 | design/lunjian/lab/lunjian-layout.html:2355 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0353 | 七章與舞台／章節內動態模板 | 賽程 | design/lunjian/lab/lunjian-layout.html:2355 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0354 | 七章與舞台／章節內動態模板 | 獎賞 | design/lunjian/lab/lunjian-layout.html:2355 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0355 | 七章與舞台／章節內動態模板 | 會員專區 登入／註冊 | design/lunjian/lab/lunjian-layout.html:2355 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0356 | 七章與舞台／章節內動態模板 | 更多功能 | design/lunjian/lab/lunjian-layout.html:2355 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0357 | 七章與舞台／章節內動態模板 | 小工具 | design/lunjian/lab/lunjian-layout.html:2355 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0358 | 七章與舞台／章節內動態模板 | 備戰方案 | design/lunjian/lab/lunjian-layout.html:2355 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0359 | 七章與舞台／章節內動態模板 | 輕量場景 | design/lunjian/lab/lunjian-layout.html:2355 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0360 | 七章與舞台／章節內動態模板 | 3D 場景 | design/lunjian/lab/lunjian-layout.html:2355 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0361 | 七章與舞台／章節內動態模板 | 靜態閱讀 | design/lunjian/lab/lunjian-layout.html:2355 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0362 | 七章與舞台／章節內動態模板 | 墨韻版本試映 ↗ | design/lunjian/lab/lunjian-layout.html:2355 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0363 | 七章與舞台／章節內動態模板 | 報名前 | design/lunjian/lab/lunjian-layout.html:2355 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0364 | 七章與舞台／章節內動態模板 | 進行中 | design/lunjian/lab/lunjian-layout.html:2355 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0365 | 七章與舞台／章節內動態模板 | 頒獎 | design/lunjian/lab/lunjian-layout.html:2355 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0366 | 七章與舞台／/#prologue | 讀完整宗旨 辦賽理念與邀請 | design/lunjian/lab/lunjian-layout.html:2373 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0367 | 七章與舞台／/#prologue | ← 返回 首頁 | design/lunjian/lab/lunjian-layout.html:2386 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0368 | 七章與舞台／/#prologue | 下一章 規則說明 → | design/lunjian/lab/lunjian-layout.html:2386 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0369 | 七章與舞台／/#rules | 同段 | design/lunjian/lab/lunjian-layout.html:2402 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0370 | 七章與舞台／/#rules | 差 1 段 | design/lunjian/lab/lunjian-layout.html:2402 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0371 | 七章與舞台／/#rules | 差 2 段 | design/lunjian/lab/lunjian-layout.html:2402 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0372 | 七章與舞台／/#rules | 差 3 段 | design/lunjian/lab/lunjian-layout.html:2402 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0373 | 七章與舞台／/#rules | 查看完整規則 五節 · 含裁判與爭議處理 | design/lunjian/lab/lunjian-layout.html:2406 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0374 | 七章與舞台／/#rules | × | design/lunjian/lab/lunjian-layout.html:2408 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0375 | 七章與舞台／/#rules | 「讓武」頁 | design/lunjian/lab/lunjian-layout.html:2421 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0376 | 七章與舞台／/#rules | ← 上一章 宗旨 | design/lunjian/lab/lunjian-layout.html:2446 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0377 | 七章與舞台／/#rules | 下一章 讓武 → | design/lunjian/lab/lunjian-layout.html:2446 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0378 | 七章與舞台／/#rules | ← 上一章 宗旨 | design/lunjian/lab/lunjian-layout.html:2448 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0379 | 七章與舞台／/#rules | 下一章 讓武 → | design/lunjian/lab/lunjian-layout.html:2448 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0380 | 七章與舞台／/#invitation | 武器限制 5 項 | design/lunjian/lab/lunjian-layout.html:2465 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0381 | 七章與舞台／/#invitation | 技能限制 8 項 | design/lunjian/lab/lunjian-layout.html:2466 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0382 | 七章與舞台／/#invitation | 防禦與位移限制 6 項 | design/lunjian/lab/lunjian-layout.html:2467 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0383 | 七章與舞台／/#invitation | 下毒 4 項 | design/lunjian/lab/lunjian-layout.html:2468 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0384 | 七章與舞台／/#invitation | 勝利條件 6 項 | design/lunjian/lab/lunjian-layout.html:2469 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0385 | 七章與舞台／/#invitation | 規則限制 7 項 | design/lunjian/lab/lunjian-layout.html:2470 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0386 | 七章與舞台／/#invitation | 武器限制 5 項 | design/lunjian/lab/lunjian-layout.html:2473 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0387 | 七章與舞台／/#invitation | 技能限制 8 項 | design/lunjian/lab/lunjian-layout.html:2506 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0388 | 七章與舞台／/#invitation | 防禦與位移限制 6 項 | design/lunjian/lab/lunjian-layout.html:2558 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0389 | 七章與舞台／/#invitation | 下毒 4 項 | design/lunjian/lab/lunjian-layout.html:2597 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0390 | 七章與舞台／/#invitation | 勝利條件 6 項 | design/lunjian/lab/lunjian-layout.html:2625 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0391 | 七章與舞台／/#invitation | 規則限制 7 項 | design/lunjian/lab/lunjian-layout.html:2664 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0392 | 七章與舞台／/#invitation | ← 上一章 規則說明 | design/lunjian/lab/lunjian-layout.html:2715 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0393 | 七章與舞台／/#invitation | 下一章 報名 → | design/lunjian/lab/lunjian-layout.html:2715 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0394 | 七章與舞台／/#register | 開始報名 | design/lunjian/lab/lunjian-layout.html:2730 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0395 | 七章與舞台／/#register | 重新讀取活動 | design/lunjian/lab/lunjian-layout.html:2732 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0396 | 七章與舞台／/#register | ← 上一章 讓武 | design/lunjian/lab/lunjian-layout.html:2735 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0397 | 七章與舞台／/#register | 下一章 比武 → | design/lunjian/lab/lunjian-layout.html:2735 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0398 | 七章與舞台／/#duel | 看左方選手的備戰方案 | design/lunjian/lab/lunjian-layout.html:2744 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0399 | 七章與舞台／/#duel | 看右方選手的備戰方案 | design/lunjian/lab/lunjian-layout.html:2745 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0400 | 七章與舞台／/#duel | 觀局雅集 | design/lunjian/lab/lunjian-layout.html:2770 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0401 | 七章與舞台／/#duel | 比賽前 | design/lunjian/lab/lunjian-layout.html:2774 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0402 | 七章與舞台／/#duel | 比賽中 | design/lunjian/lab/lunjian-layout.html:2774 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0403 | 七章與舞台／/#duel | 完成比賽 | design/lunjian/lab/lunjian-layout.html:2774 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0404 | 七章與舞台／/#duel | 返回賽事資訊 | design/lunjian/lab/lunjian-layout.html:2774 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0405 | 七章與舞台／/#duel | 輾壓勝利 | design/lunjian/lab/lunjian-layout.html:2777 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0406 | 七章與舞台／/#duel | 慘輸 | design/lunjian/lab/lunjian-layout.html:2777 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0407 | 七章與舞台／/#duel | 險勝 | design/lunjian/lab/lunjian-layout.html:2777 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0408 | 七章與舞台／/#duel | 平手 | design/lunjian/lab/lunjian-layout.html:2777 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0409 | 七章與舞台／/#duel | ← 上一章 報名 | design/lunjian/lab/lunjian-layout.html:2782 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0410 | 七章與舞台／/#duel | 下一章 賽程 → | design/lunjian/lab/lunjian-layout.html:2782 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0411 | 七章與舞台／/#schedule | 重新整理賽程 | design/lunjian/lab/lunjian-layout.html:2794 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0412 | 七章與舞台／/#schedule | 我的參賽 | design/lunjian/lab/lunjian-layout.html:2795 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0413 | 七章與舞台／/#schedule | 管理活動與對局 ↗ | design/lunjian/lab/lunjian-layout.html:2795 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0414 | 七章與舞台／/#schedule | ← 上一章 比武 | design/lunjian/lab/lunjian-layout.html:2797 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0415 | 七章與舞台／/#schedule | 下一章 獎賞 → | design/lunjian/lab/lunjian-layout.html:2797 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0416 | 七章與舞台／/#rewards | ← 上一章 賽程 | design/lunjian/lab/lunjian-layout.html:2822 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0417 | 七章與舞台／/#rewards | 回到 宗旨 → | design/lunjian/lab/lunjian-layout.html:2822 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0418 | 七章與舞台／章節內動態模板 | × | design/lunjian/lab/lunjian-layout.html:2838 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0419 | 七章與舞台／章節內動態模板 | × | design/lunjian/lab/lunjian-layout.html:2865 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0420 | 七章與舞台／章節內動態模板 | ${LABELS[i]} | design/lunjian/lab/lunjian-layout.html:3167 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0421 | 七章與舞台／章節內動態模板 | 選 ${escapeHTML(p.name)} · ${sportsbookData?'下注':'模擬下注'} | design/lunjian/lab/lunjian-layout.html:3705 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0422 | 七章與舞台／章節內動態模板 | ${m.status==='done' ? '查看' : '選'} ${escapeHTML(p.name)} · ${m.status==='done' ? '盤口結果' : '查看賠率'} | design/lunjian/lab/lunjian-layout.html:3708 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0423 | 七章與舞台／章節內動態模板 | 裝備與武學 | design/lunjian/lab/lunjian-layout.html:3803 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0424 | 七章與舞台／章節內動態模板 | 其餘配置 | design/lunjian/lab/lunjian-layout.html:3809 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0425 | 七章與舞台／章節內動態模板 | 去下注 | design/lunjian/lab/lunjian-layout.html:3832 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0426 | 七章與舞台／章節內動態模板 | 前往此場比武 | design/lunjian/lab/lunjian-layout.html:3955 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0427 | 七章與舞台／章節內動態模板 | 返回賽程 | design/lunjian/lab/lunjian-layout.html:3955 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0428 | 七章與舞台／章節內動態模板 | 返回比武 | design/lunjian/lab/lunjian-layout.html:3957 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0429 | 備戰方案／/loadout | 論劍 | design/lunjian/lab/loadout.html:1964 | 閱讀／導覽：宋體與左至右墨痕；主要頁面入口另評估匾額 |
| B0430 | 備戰方案／/loadout | ← 返回比武 | design/lunjian/lab/loadout.html:1966 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0431 | 備戰方案／/loadout | ← 返回比武 | design/lunjian/lab/loadout.html:1971 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0432 | 備戰方案／/loadout | 規則說明 | design/lunjian/lab/loadout.html:1972 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0433 | 備戰方案／/loadout | 匯入配置 | design/lunjian/lab/loadout.html:1973 | 資料工具：輕量紙墨分組；匯入需驗證，匯出與提交區隔 |
| B0434 | 備戰方案／/loadout | 匯出配置 | design/lunjian/lab/loadout.html:1974 | 資料工具：輕量紙墨分組；匯入需驗證，匯出與提交區隔 |
| B0435 | 備戰方案／/loadout | 複製配置 | design/lunjian/lab/loadout.html:1975 | 資料工具：輕量紙墨分組；匯入需驗證，匯出與提交區隔 |
| B0436 | 備戰方案／/loadout | ☰ | design/lunjian/lab/loadout.html:1977 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0437 | 備戰方案／/loadout | 重試儲存 | design/lunjian/lab/loadout.html:1982 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0438 | 備戰方案／/loadout | ! | design/lunjian/lab/loadout.html:1985 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0439 | 備戰方案／/loadout | 選擇流派 | design/lunjian/lab/loadout.html:1986 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0440 | 備戰方案／/loadout | 套裝加成 | design/lunjian/lab/loadout.html:2001 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0441 | 備戰方案／/loadout | 來源明細 | design/lunjian/lab/loadout.html:2007 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0442 | 備戰方案／/loadout | 查看更多 | design/lunjian/lab/loadout.html:2007 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0443 | 備戰方案／/loadout | 倉庫工具 ⌄ | design/lunjian/lab/loadout.html:2025 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0444 | 備戰方案／/loadout | ! | design/lunjian/lab/loadout.html:2056 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0445 | 備戰方案／/loadout | 加入屬性 | design/lunjian/lab/loadout.html:2057 | 資料工具：輕量紙墨分組；匯入需驗證，匯出與提交區隔 |
| B0446 | 備戰方案／/loadout | 用目前數值帶入 | design/lunjian/lab/loadout.html:2058 | 資料工具：輕量紙墨分組；匯入需驗證，匯出與提交區隔 |
| B0447 | 備戰方案／/loadout | 帶入配置並前往報名 | design/lunjian/lab/loadout.html:2079 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0448 | 備戰方案／/loadout | 帶入報名表的文字 | design/lunjian/lab/loadout.html:2084 | 揭露控制：展開／收合狀態清楚，整列可點擊 |
| B0449 | 備戰方案／/loadout | 複製文字 | design/lunjian/lab/loadout.html:2087 | 資料工具：輕量紙墨分組；匯入需驗證，匯出與提交區隔 |
| B0450 | 備戰方案／/loadout | 匯出 JSON | design/lunjian/lab/loadout.html:2088 | 資料工具：輕量紙墨分組；匯入需驗證，匯出與提交區隔 |
| B0451 | 備戰方案／/loadout | 清空 | design/lunjian/lab/loadout.html:2089 | 危險／關鍵操作：明確動詞、權限與結果；確認機制依影響程度設計 |
| B0452 | 備戰方案／/loadout | × | design/lunjian/lab/loadout.html:2107 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0453 | 備戰方案／/loadout | 加入 | design/lunjian/lab/loadout.html:2113 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0454 | 備戰方案／/loadout | 清空這格 | design/lunjian/lab/loadout.html:2114 | 危險／關鍵操作：明確動詞、權限與結果；確認機制依影響程度設計 |
| B0455 | 備戰方案／/loadout | × | design/lunjian/lab/loadout.html:2127 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0456 | 備戰方案／/loadout | 取消 | design/lunjian/lab/loadout.html:2131 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0457 | 備戰方案／/loadout | 確定 | design/lunjian/lab/loadout.html:2132 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0458 | 備戰方案／/loadout | × | design/lunjian/lab/loadout.html:2142 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0459 | 備戰方案／/loadout | 關閉 | design/lunjian/lab/loadout.html:2149 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0460 | 備戰方案／/loadout | × | design/lunjian/lab/loadout.html:2159 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0461 | 備戰方案／/loadout | 全選 | design/lunjian/lab/loadout.html:2164 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0462 | 備戰方案／/loadout | 取消全選 | design/lunjian/lab/loadout.html:2165 | 選擇控制：保留持續 selected 狀態，不以 hover 代替 |
| B0463 | 備戰方案／/loadout | 取消 | design/lunjian/lab/loadout.html:2171 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0464 | 備戰方案／/loadout | 加入倉庫 | design/lunjian/lab/loadout.html:2172 | 資料工具：輕量紙墨分組；匯入需驗證，匯出與提交區隔 |
| B0465 | 備戰方案／/loadout | × | design/lunjian/lab/loadout.html:2182 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0466 | 備戰方案／/loadout | 重設裝備 | design/lunjian/lab/loadout.html:2191 | 危險／關鍵操作：明確動詞、權限與結果；確認機制依影響程度設計 |
| B0467 | 備戰方案／/loadout | 取消 | design/lunjian/lab/loadout.html:2192 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0468 | 備戰方案／/loadout | 儲存裝備 | design/lunjian/lab/loadout.html:2193 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0469 | 備戰方案／/loadout | × | design/lunjian/lab/loadout.html:2203 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0470 | 備戰方案／/loadout | 取消 | design/lunjian/lab/loadout.html:2207 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0471 | 備戰方案／/loadout | 確認 | design/lunjian/lab/loadout.html:2208 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0472 | 備戰方案／/loadout | × | design/lunjian/lab/loadout.html:2218 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0473 | 備戰方案／/loadout | × | design/lunjian/lab/loadout.html:2230 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0474 | 備戰方案／/loadout | 刪除角色 | design/lunjian/lab/loadout.html:2234 | 危險／關鍵操作：明確動詞、權限與結果；確認機制依影響程度設計 |
| B0475 | 備戰方案／/loadout | 取消 | design/lunjian/lab/loadout.html:2235 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0476 | 備戰方案／/loadout | 保存 | design/lunjian/lab/loadout.html:2236 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |
| B0477 | 備戰方案／/loadout | × | design/lunjian/lab/loadout.html:2246 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0478 | 備戰方案／/loadout | 匯入 | design/lunjian/lab/loadout.html:2249 | 資料工具：輕量紙墨分組；匯入需驗證，匯出與提交區隔 |
| B0479 | 七章與舞台／章節內動態模板 | × | design/lunjian/lab/arena-ticket.js:7 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0480 | 七章與舞台／章節內動態模板 | 返回修改 | design/lunjian/lab/arena-ticket.js:7 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0481 | 七章與舞台／章節內動態模板 | 檢查示範注單 | design/lunjian/lab/arena-ticket.js:7 | 功能按鈕：依事件確認用途，再分主操作／次操作；動態文字需逐流程驗收 |
| B0482 | 七章與舞台／章節內動態模板 | 返回比武 | design/lunjian/lab/arena-ticket.js:7 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0483 | 七章與舞台／章節內動態模板 | × | design/lunjian/lab/bracket-editor.js:164 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0484 | 七章與舞台／章節內動態模板 | 此方獲勝 | design/lunjian/lab/bracket-editor.js:164 | 危險／關鍵操作：明確動詞、權限與結果；確認機制依影響程度設計 |
| B0485 | 七章與舞台／章節內動態模板 | 此方獲勝 | design/lunjian/lab/bracket-editor.js:164 | 危險／關鍵操作：明確動詞、權限與結果；確認機制依影響程度設計 |
| B0486 | 七章與舞台／章節內動態模板 | 取消 | design/lunjian/lab/bracket-editor.js:164 | 次要工具：輕量紙墨，固定觸控區與焦點 |
| B0487 | 七章與舞台／章節內動態模板 | 儲存這場比分 | design/lunjian/lab/bracket-editor.js:164 | 主要功能：共用實色按鈕；loading／disabled／成功失敗 |