# 可編輯的論劍展示來源

目前工作規範要求 `sources/` 全部唯讀，因此本目錄是後續版面／動畫文字修改的工作來源，`sources/lunjian/` 僅保留為參考快照，不再並行修改。

`lab/` 的文字檔與必要的 jz 覆寫由唯讀快照複製。沒有複製 art/type/vendor 素材目錄，生成器會保留既有 public 素材，不刪除或重建它們。若要修改素材需另外準備明確的資產流程。

在 theatron 根目錄執行 `python design/lunjian/lab/tools/to-theatron.py`。生成器輸出 web/public/lunjian、首頁標記與同源覆寫。`scripts/lab-source.ts` 優先選此處，仍支援 LUNJIAN_SOURCE_ROOT。

2026-10-22：白衣人物套入 figure-window，共用斜角裁切；內框置於人物上方；intro=1 可重播。Three.js 粒子與 GSAP 揭幕屬 React 掛載層，維護於 web/src/features/chrome/homeOpening.ts、paperBurn.ts、paperFire3d.ts。
