# 平手演出：兩名獨立透明人物

日期：2026-09-21。使用內建 image_gen 生成；先檢視既有 `art/duel-victor.webp` 的寫實水墨線條，再分別生成兩名人物。兩張相向組合用來表達雙方力竭仍站立的平手畫面；不是勝負結果或正式賽事紀錄。

## 資產與姿態

| 資產 | 用途與目視結果 |
| --- | --- |
| [duel-draw-left.png](art/duel-draw-left.png)／[WebP](art/duel-draw-left.webp) | 黑灰袍成年男性朝右，肩稍垂、一手扶膝、另一手持劍尖向地；雙腳站立，完整頭髮、腳底與劍。 |
| [duel-draw-right.png](art/duel-draw-right.png)／[WebP](art/duel-draw-right.webp) | 白灰袍成年女性朝左，雙手扶向下的劍柄，疲憊但保持警戒站立；完整頭髮、腳底與劍。 |

兩者有衣物磨損與破邊，無血、傷口或勝利姿態，沒有倒地人物、場景、地板、文字或矩形紙底。PNG 原稿保留；WebP 僅以 Sharp quality 86／effort 5 格式壓縮，未裁切、去背、補畫或合成。

## 生成來源

- 左：`C:/Users/User/.codex/generated_images/01a0bf62-0a40-7b73-b773-d6ba02ed1130/exec-7dea7303-9649-4a18-960c-99026b97342a.png`
- 右：`C:/Users/User/.codex/generated_images/01a0bf62-0a40-7b73-b773-d6ba02ed1130/exec-53c76191-3000-4c64-b379-0b16b171cc91.png`

## 完整提示詞：左

```text
Use case: illustration-story.
Asset type: one independent transparent full-body character sprite for a Chinese wuxia website's DRAW / TIE match illustration. This is one half of a matched pair: both combatants are exhausted, both remain standing, neither has won.
Style: original adult Chinese wuxia, REALISTIC ANATOMY rendered in PURE MONOCHROME BLACK INK with delicate manga crosshatching, dense dry-brush black robe shadows, soft gray brush washes and opaque white highlights. Refined restrained ink linework, realistic tired face and hands, not cartoon chibi, not glossy 3D, not a photo. Match a realistically drawn ink swordsman after a long duel.
Framing: portrait 1024x1536. Entire character and ONE whole straight jian sword entirely within frame: all hair, both soles, sword tip and robe edges visible. Figure including weapon fills approximately 85 percent of canvas height with clear transparent margin all around. No cut-off head, toes or blade. Single character only.
Background: TRUE TRANSPARENT ALPHA around the silhouette, no scenery, no ground, no floor, no background wash, no paper rectangle, no cast shadow. Keep white and gray areas INSIDE the clothing/skin/sword opaque.
Constraints: slight fraying and small tears at clothing hem/sleeves only. NO BLOOD, NO WOUNDS, no gore. No triumphant pose, no raised weapon, no kneeling, no sitting, no collapse, no lying on the ground. No other people, no detached props, no text, no lettering, no logo, no watermark, no borders. Exactly two arms, two hands, two legs, anatomically natural hands.
Subject and pose: ONE ADULT MALE swordsman wearing flowing BLACK AND CHARCOAL GRAY hanfu robes with tied-up dark hair, three-quarter view facing RIGHT toward an unseen opponent. He is exhausted, shoulders slightly dropped, torso bent forward just a little, one hand resting on his own bent knee for support while BOTH feet stay firmly planted and he remains standing. His other hand grips a single jian sword angled downward, blade tip nearly touching the imagined floor at his side. No actual floor is drawn. Calm spent expression, catching his breath, no smile or victory gesture. Preserve clear full-body silhouette with separated legs and natural slight forward lean; he is tired but stable.
```

## 完整提示詞：右

```text
Use case: illustration-story.
Asset type: one independent transparent full-body character sprite for a Chinese wuxia website's DRAW / TIE match illustration. This is one half of a matched pair: both combatants are exhausted, both remain standing, neither has won.
Style: original adult Chinese wuxia, REALISTIC ANATOMY rendered in PURE MONOCHROME BLACK INK with delicate manga crosshatching, dense dry-brush black robe shadows, soft gray brush washes and opaque white highlights. Refined restrained ink linework, realistic tired face and hands, not cartoon chibi, not glossy 3D, not a photo. Match a realistically drawn ink swordsman after a long duel.
Framing: portrait 1024x1536. Entire character and ONE whole straight jian sword entirely within frame: all hair, both soles, sword tip and robe edges visible. Figure including weapon fills approximately 85 percent of canvas height with clear transparent margin all around. No cut-off head, toes or blade. Single character only.
Background: TRUE TRANSPARENT ALPHA around the silhouette, no scenery, no ground, no floor, no background wash, no paper rectangle, no cast shadow. Keep white and gray areas INSIDE the clothing/skin/sword opaque.
Constraints: slight fraying and small tears at clothing hem/sleeves only. NO BLOOD, NO WOUNDS, no gore. No triumphant pose, no raised weapon, no kneeling, no sitting, no collapse, no lying on the ground. No other people, no detached props, no text, no lettering, no logo, no watermark, no borders. Exactly two arms, two hands, two legs, anatomically natural hands.
Subject and pose: ONE ADULT FEMALE swordswoman wearing long WHITE AND PALE GRAY hanfu robes with a dark narrow waist sash, black hair tied high, three-quarter view facing LEFT toward an unseen opponent. She is exhausted but remains alert and STANDING with both feet planted, shoulders slightly lowered and body upright. BOTH HANDS rest together around the hilt of ONE straight jian sword held close beside her body, sword blade pointing DOWN, tip near her feet; weapon stays beside the body rather than crossing the face. No actual floor is drawn. Serious watchful tired expression, no smile or victory gesture. Full long robes with tasteful mild hem fraying, fully clothed. Natural stance, not injured or collapsing.
```

## 透明與成品檢查

已目視檢查工具輸出及最終 WebP。兩份均為 1024 × 1536、有 alpha；全圖 1,572,864 像素。左圖 846,635 像素全透明、663,154 像素 alpha ≥ 240；右圖 919,674 像素全透明、584,217 像素 alpha ≥ 240。主體最高 alpha 254，白灰袍與人物線條保留接近不透明的內容。

此為資產檢查；尚不代表套入頁面後的瀏覽器視覺驗收。沒有修改 HTML 或執行整站生成器。
