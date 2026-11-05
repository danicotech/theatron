# 武俠名帖卡面生成

使用內建 image_gen，生成兩張無字 production 卡面，並非完整頁面截圖。原稿保留，WebP 僅格式轉換，沒有裁切、去背或重繪。

- 黑墨原稿：art/_src/bracket-card-dark.png
- 白紙原稿：art/_src/bracket-card-light.png
- 網頁卡面：art/bracket-card-dark.webp、art/bracket-card-light.webp
- 黑墨輸出：C:/Users/User/.codex/generated_images/01a0be4b-673e-7fb3-9d37-eb978ff7f37b/exec-0a9ea155-d49d-417b-8b00-5061c63bf5e6.png
- 白紙輸出：C:/Users/User/.codex/generated_images/01a0be4b-673e-7fb3-9d37-eb978ff7f37b/exec-6ba8e8db-a50c-4acc-aaa0-a69c34f713a7.png

已目視兩張輸出：深墨與暖紙，墨邊和紙纖維在邊角，中央無文字；姓名／段位／比分保留 HTML。圖片不代表選手或虛構門派。

## 黑墨完整提示詞

Use case: stylized-concept. Asset type: ONE production raster background skin for a horizontal player name card in a Chinese wuxia tournament bracket, not a page mockup. Generate an elegant dark ink martial invitation slip. Wide horizontal 3:1 composition, requested 1536x512 canvas. Flat front view, straight horizontal edges, card fills the entire canvas with no outside margin. Entire image opaque. A deep charcoal blue-black matte ink paper surface, subtle handmade fibers. At the very left outer 10 percent, a narrow irregular vermilion brush strip and one fine weathered old-gold line. Delicate frayed dry-brush paper edges along the top and bottom 4 percent, spare pale ink scratches confined to the corners. Middle 80 percent is very dark, quiet and almost uniform, absolutely reserved for readable HTML player name and score; no illustrations crossing it. Atmosphere: dignified Chinese black-and-white ink manhua, literary, hand-worked material, restrained. No text, no Chinese characters, no letters, no numbers, no logos, no circular badge, no portraits, no weapon silhouette in the center, no UI screenshot, no 3D perspective, no shiny metallic bevel, no glow, no drop shadow, no landscape. One single unlettered dark card skin.

## 白紙完整提示詞

Use case: stylized-concept. Asset type: ONE production raster background skin for a horizontal player name card in a Chinese wuxia tournament bracket, not a page mockup. Generate an elegant pale rice-paper martial invitation slip, matching a dark ink-paper counterpart. Wide horizontal 3:1 composition, requested 1536x512 canvas. Flat front view, straight horizontal edges, card fills the entire canvas with no outside margin. Entire image opaque. Warm ivory-gray handmade xuan paper, subtle fine fibers and restrained barely visible ink wash. At the very right outer 10 percent, thin irregular charcoal-black brush edging with one small vermilion dry-brush accent at the lower corner. Delicate ragged dry-brush paper texture at the top and bottom 4 percent. Middle 80 percent is pale, empty and very quiet, absolutely reserved for readable dark HTML player name and score; no drawings crossing it. Atmosphere: elegant Chinese monochrome ink manhua, literary, tactile paper, sparing visual detail. No text, no Chinese characters, no letters, no numbers, no logo, no circular badge, no portraits, no weapon silhouette in the center, no UI screenshot, no 3D perspective, no shiny metallic bevel, no glow, no drop shadow, no landscape. One single unlettered light card skin.

## 輸出規格

工具實際輸出 2172 × 724；維持原尺寸，僅轉 WebP quality 90。

- bracket-card-dark.webp: 2172 × 724，156906 bytes，SHA256 `584e61c3d6e40c1447b2d0116ca184f8c80f5dc8c7857fdda74ae9f8a93b1fab`。
- bracket-card-light.webp: 2172 × 724，239358 bytes，SHA256 `7f2818ed8458120d62c377b08db76a0a44bd258180a73003e8e41bd259b015e5`。
