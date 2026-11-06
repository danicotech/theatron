# 2D 刊首高細節人物 v2 — 2026-10-22

使用內建 image_gen，以既有 v1 人物為參考分別重製；沒有合成整張海報。透明原稿保存在本目錄，網站版本在 web/public/opening-art/v2。原 v1 留存。

| 素材 | 原稿尺寸 | 用途 |
| --- | --- | --- |
| hero-left.png | 1122 × 1402 RGBA | 抬手主人像；彩色、灰階、出框共用同一張 |
| portrait-a.png | 1024 × 1536 RGBA | 黑衣近景，網頁鏡像後向右與白衣對視 |
| portrait-white.png | 1024 × 1536 RGBA | 白衣近景，向左對視 |

輸出 WebP quality=90、alphaQuality=100，無縮放、無額外銳化。PNG 透明通道已檢查。背景維持既有首頁 scene-gate，同時移除刊首額外 blur；前景仍用原 v1 梅枝。

## 生成提示詞規格

共同：以既有人物為編輯參考，保留身份、構圖及姿勢；提高眼睛、髮絲、皮膚與布料細節。自然電影光線，保留細微繪畫感，避免塑膠皮膚、過度銳化、雜亂高頻紋理。獨立透明 PNG、真實 alpha，沒有背景、文字、標誌、道具或地面陰影。

主人像：成人女性，保留抬手、頭部朝左、黑灰高領外袍與朱紅內袍；最高可用直幅解析度；保持原裁切與手部位置。

黑衣近景：同一位成人女性，頭至腰、雙手放下，臉與眼神朝左（網頁會鏡像）；深色外袍與朱紅內衣；細緻眼睛、頭髮、織物，柔和自然光。

白衣近景：成人男性，象牙白衣、灰色腰帶、束起的深色頭髮，臉與眼神朝左；保留頭至腰構圖，細緻頭髮與布料，自然柔光。

近景透明提取追加提示詞：
Use case: background-extraction. Remove EVERY background pixel, including the entire brown/gray gradient and glow. Output only the exact person as a clean isolated transparent PNG with real alpha transparency. Preserve the existing face, gaze direction, pose, hair, detailed skin, clothes and original 1024x1536 framing unchanged. No solid background, no gradient, no checkerboard baked in, no cast shadow or floor. Keep semi-transparent wisps of hair. This is an exact cutout for a website where the head must extend above its card frame.
