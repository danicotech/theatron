# 開場人物提劍姿勢 — 2026-10-28

使用內建 imagegen，兩張獨立生成，透明背景；原本人物素材保持不變。輸出轉為 1024×1536 WebP，保留透明度。用途是 2D 開場右下人物連結的 hover／鍵盤焦點／觸控按壓狀態。

- 原角色：`web/public/opening-art/v2/portrait-a.webp`、`portrait-white.webp`
- 新素材：`web/public/opening-art/v2/portrait-a-armed-v1.webp`（463,414 bytes）、`portrait-white-armed-v1.webp`（316,434 bytes）
- 左側女性在呈現時沿用水平翻轉，兩位角色仍朝內對視。
- 卡片統一深黑底、白色 L 框，僅左側及底部 7px。固定側邊遮色，人物上移與放大；姿勢以 160ms 透明度切換，沒有粒子、循環動畫或水波。
- 提劍素材低優先載入，不阻塞開場。解碼成功才啟用換圖；失敗保留原姿勢。減少動態模式立即換姿勢，不位移／縮放。
- 1395px／390px 視窗檢查左右卡片；另驗證觸控導覽、鍵盤焦點、減少動態及素材失敗備援。相關開場測試 17 項通過，ESLint、token 檢查與正式 build 通過。

## 女性素材提示詞

Use case: identity-preserve. Edit target: supplied female wuxia character cutout. Create a separate transparent hover-state portrait asset for a website. Preserve exactly this adult woman's recognizable face, auburn braided updo and loose hair, black high-collared outer robe and vermilion inner robe, restrained realistic painted style. Change her pose to lifting a Chinese straight jian sword in a poised combat-ready guard: raised hand gripping the hilt at upper chest near shoulder, narrow steel blade ascending diagonally beside head, never crossing face. She continues looking towards image LEFT. Her raised arm and shoulders should visibly communicate readiness. Portrait 2:3, head and torso framing consistent with reference, entire hair and sword tip inside canvas with small clear margin. Keep weapon close to body so it reads in a narrow portrait card. Face remains unobstructed and detailed but not oversharpened; realistic fingers and grip. Isolated actual transparent background, no scenery, no lettering, no border, no UI, no glow, no motion blur. One character only.

## 男性素材提示詞

Use case: identity-preserve. Edit target: supplied male wuxia character cutout. Create a separate transparent hover-state portrait asset for a website. Preserve exactly this adult man's recognizable face, long dark half-up hair, white layered robes with gray inner collar and sash, restrained realistic painted style. Change pose to drawing and lifting a Chinese straight jian sword in combat-ready guard: visible raised hand gripping hilt at upper chest, narrow steel blade ascending along image RIGHT beside his hair without crossing face. His shoulders turn slightly into guard and his gaze remains toward image LEFT. Portrait 2:3; consistent head-and-torso scale with reference, entire hair and sword tip inside canvas with small clear margin. Keep sword and hands within narrow central 70% of image so they read in a cropped portrait card. Unobstructed detailed face, natural skin, no excessive sharpening, anatomically correct grip. Actual transparent background alpha, no scenery, lettering, border, UI, glow or motion blur. One character only.
