# 可移轉的論劍來源快照

2026-10-12 提交前從 `../scrollcraft/builds/lunjian/` 保存目前使用的 lab 原始碼、兩個生成器、素材、配裝資料及 MERGE.md。`manifest.json` 記錄每檔 SHA-256；未包含歷史截圖、`_merge`、`_src`、舊版備份及臨時偵錯腳本。

- 在原設計工作區：外部 lab 仍為唯一編輯來源；修改後生成，再執行 `python scripts/snapshot-lab.py` 更新此快照。腳本不刪除既有檔案；來源有刪檔時需審查快照清單並明確移除對應舊檔。
- 在獨立 clone：本目錄是可接續的來源，修改這裡後使用同目錄生成器。不要同時修改兩套 lab。
- 測試由 `scripts/lab-source.ts` 優先取外部工作區，缺少時取此快照；可設定 `LUNJIAN_SOURCE_ROOT=sources/lunjian/lab` 強制驗證獨立來源。
- 已生成的 `web/public/` 與 React markup 一併進版控，所以一般 `pnpm dev`／`pnpm build` 不需要先跑 Python 或依賴外部設計目錄。

從名為 **theatron** 的 clone 根目錄執行（既有生成器按此目錄名稱計算輸出）：

```powershell
python sources/lunjian/lab/tools/to-theatron.py
python sources/lunjian/lab/tools/loadout-to-theatron.py
```

生成器會替換資產目錄。執行前確認其 `TH` 指向本 clone 的 `web/`，且目的地沒有尚未回存來源的修改；若 clone 改名，先修正生成器的目標路徑。不要將此快照的原始碼交給自動格式化，否則會破壞與正本的位元組一致性。

後端即時同步另見 [交接規格](../../docs/REALTIME_INTEGRATION.md)。瀏覽器驗收腳本目前仍使用原開發機的 Playwright 路徑，換機後需先設定可用的 Playwright；單元測試和 build 不需要該環境。
