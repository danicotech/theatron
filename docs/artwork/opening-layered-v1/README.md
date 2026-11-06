# 赤影縱刊：分層素材 v1

2026-10-22，使用內建 image_gen 分別生成，沒有把完整封面合成為單張圖片。

| 素材 | 原始檔 | 網頁使用 |
| --- | --- | --- |
| 景深背景 | background.png | /opening-art/v1/background.webp |
| 向右看的黑衣主人物，透明 | hero.png | /opening-art/v1/hero.webp |
| 黑衣特寫，透明 | portrait-a.png | /opening-art/v1/portrait-a.webp |
| 向左看的白衣對手，透明 | portrait-white.png | /opening-art/v1/portrait-white.webp |
| 近景梅枝，透明 | foreground.png | /opening-art/v1/foreground.webp |

黑衣特寫在網頁水平翻轉朝右，與白衣對手相向。主人物的頭部朝向另經 image_gen 修改，衣袖姿勢與構圖保留；三份主圖共用同一來源，灰階僅為 CSS 顯示效果。未使用的 portrait-b.png 是同角色另一姿態草稿，不部署。

黑白雙框、出框裁切、文字與 GSAP 動畫全部由網頁獨立控制，不烘焙進素材。背景固定柔焦、前景獨立差速移動；網頁素材只做尺寸縮減與 WebP 編碼，保留 alpha。五張使用素材共 380464 bytes。

完整提示詞見 final-prompts.json（含原始生成與後續改向）；原始來源與網頁尺寸見 manifest.json。

最新覆蓋：主人物依使用者要求朝左，改用 hero-left.png / hero-left.webp（原始生成素材，不是鏡像）。右下黑白特寫仍對視；舊 hero.png 及其右向記錄保留為歷史版本。
最新使用五張 WebP 合計 479812 bytes；manifest.json 為目前版本，manifest-right-facing.json 保存前版。
