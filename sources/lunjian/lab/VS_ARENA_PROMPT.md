# 擂台 VS：透明書法素材

生成日期：2026-09-21。使用內建 image_gen，一次生成；未使用 CLI 或腳本代畫。

## 參考與用途

使用者提供 [ChatGPT Image09_16_02.png](<../../../../ChatGPT Image09_16_02.png>) 作書法構圖參考：尖銳上挑的 V、橫向下掃的 S、破筆與弧形墨勢。新圖只保留獨立筆畫，改為骨白／暖白以適配深色 3D 擂台；不沿用參考的大面積紙色、山景、建築或植物。這是新素材，不覆蓋原 vs-ink.png。

原生 view_image 因 Windows sandbox Failed 5 無法讀圖；以授權的唯讀檔案及記憶體格式轉換實際檢視參考與輸出，沒有修改參考圖。

## 檔案與生成來源

- 原稿：[art/vs-arena-ink.png](art/vs-arena-ink.png)
- 網頁格式：[art/vs-arena-ink.webp](art/vs-arena-ink.webp)
- 內建工具原始輸出：`C:/Users/User/.codex/generated_images/01a0bf62-0a40-7b73-b773-d6ba02ed1130/exec-ba713f35-a144-4a97-a222-f176a037ef53.png`

PNG 為原始輸出的逐位元組複本，保留原始輸出。工具實際回傳 **1254 × 1254**（提示詞要求 1024 × 1024）；未裁切或重新取樣。WebP 僅由 Sharp 以 quality 90／effort 5 格式轉換，無去背、合成、色彩重繪或另加背景。

## 完整提示詞

```text
Use case: illustration-story.
Asset type: ONE production transparent raster calligraphy overlay for a Chinese wuxia 3D arena webpage, not a poster or website mockup.
Primary request: Exact uppercase Latin letters "VS", large, clear and dramatically hand-brushed in the center, with the tall sharp rising stroke of V and the broad lower sweeping S forming an energetic diagonal calligraphic composition. Bold Chinese dry-brush spirit, frayed bristle tips, irregular ink breakups, fine flying-white texture and restrained tiny ink flecks. Painterly, forceful but elegant literary martial atmosphere, not a clean vector font.
Color palette: The MAIN VS strokes must be OPAQUE BONE WHITE / warm ivory so they read clearly when overlaid on a dark 3D arena. Only a few charcoal-black dry edges within the brush contours and extremely sparse antique-gold hairline scratches. Mostly ivory, little black, gold less than 1 percent of visible artwork. NO metallic lighting or reflected highlights.
Composition: square 1024x1024. VS fills approximately 65 percent of the canvas width and height, with generous fully transparent outer margin. A LIMITED open partial crescent brush sweep loosely follows ONE side of the letters, about half a circle at most, broken and airy, subordinate to VS. No closed circle, no enclosing border, no thick surrounding disc. Keep the gaps BETWEEN letter strokes and inside the partial crescent COMPLETELY TRANSPARENT so the live scene shows through.
Scene/backdrop: TRUE TRANSPARENT ALPHA BACKGROUND. Isolated brush marks ONLY. Every pixel outside the actual calligraphic brush strokes, tiny attached flecks and partial brush sweep must be transparent. No white paper, no paper texture, no off-white rectangle, no cloudy wash behind the letters, no solid black backdrop, no gray canvas.
Constraints: one VS mark only, original artwork. No people, no fighters, no mountains, no buildings, no pagodas, no bamboo, no flowers, no environment, no landscape, no floor, no ground, no reflections, no glow, no luminous halo, no drop shadow, no light ring, no flames, no other text, no signature, no seal, no watermark. Do NOT fill the background to make the pale lettering visible: preserve transparent alpha and opaque ivory strokes. The overlay must leave the underlying 3D scenery visible everywhere between and around its brush strokes.
```

## 素材檢查

已檢視生成原稿與網頁版本：可辨識大幅 VS、骨白粗筆、少量黑色飛白邊緣及舊金細痕；墨掃不封閉，沒有人物、場景、地面反光或發光光暈。字形內外的空隙保持透明，不以白底遮住 3D 背景。

| 項目 | PNG | WebP |
| --- | ---: | ---: |
| 尺寸 | 1254 × 1254 | 1254 × 1254 |
| 檔案大小 | 1,385,562 bytes | 440,884 bytes |
| Alpha 通道 | 有 | 有 |
| 全透明像素 | 995,320（63.29%） | 995,320（63.29%） |
| 非零 alpha 像素 | 577,196 | 577,196 |
| alpha ≥ 240 像素 | 323,695 | 323,695 |
| 最高 alpha | 255 | 255 |

兩格式 alpha 計數一致。主要可見筆畫（alpha ≥ 32）範圍為 x=88–1163、y=61–1182；極淡筆屑可達圖片邊緣，未剪除。主體沒有固定矩形紙底；透明間隙可露出實際場景。

本紀錄僅代表素材檢查。HTML／CSS 接入、生成器同步及 3D 場景中的實際尺寸與可讀性由主實作處理；未宣稱瀏覽器實機驗收。
