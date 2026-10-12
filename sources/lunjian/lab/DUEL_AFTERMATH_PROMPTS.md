# 對決賽後透明素材

使用內建 image_gen 生成（2026-09-20）；PNG 原稿保留，WebP 僅以 Sharp 轉換格式，沒有程式繪圖、去背或合成。

## duel-victor

```text
Use case: illustration-story.
Asset type: transparent full-body character cutout for a Chinese wuxia website, composited over an existing 3D arena.
Primary request: the exhausted narrow victor after a close sword duel. ONE original ADULT Chinese swordsman in flowing dark hanfu robes, visibly worn and tired but still standing, both feet planted, torso leaning gently on his own straight jian sword held point-down for support. Slightly bowed head, one hand firmly grips the sword hilt, the other holds his own side through his clothing; weary relieved posture, NOT a triumphant raised weapon.
Style: pure monochrome black ink manga, dominant near-black silhouette with selective white and muted gray dry-brush lines showing robe folds, face and hands. Restrained Chinese ink brush edges, not photorealistic and not glossy. Match a silhouetted theatrical wuxia figure, legible over a dark 3D environment.
Composition: portrait 1024x1536, complete body from hair to both soles, entire sword and loose robe silhouette inside canvas, 8 percent clear transparent margin. Three-quarter view gently facing right; subtle frayed robe edges convey a hard-fought match.
Scene/backdrop: TRUE TRANSPARENT ALPHA around the entire character. No scenery, NO ground, NO floor, no rectangular paper backdrop, no background wash or smoke, no cast shadow.
Constraints: fully clothed, no blood, no wound detail, no gore, no extra people, only one sword, anatomically clear two hands and two feet, no text, no letters, no logos, no VS, no frame or watermark. Preserve opaque black/white shading inside the figure while background is actually transparent.
```

## duel-defeated

```text
Use case: illustration-story. Production PNG asset: ONE full-body adult wuxia warrior DEFEATED AND LYING FLAT AFTER A NON-LETHAL SWORD DUEL, standalone transparent cutout.
Pose is essential: the adult Chinese swordsman has collapsed fully onto his side/front, chest and shoulder resting down, head resting directly on one forearm flat against the ground, his other arm extended loosely forward with open relaxed hand, his body and both legs extending behind with one knee slightly bent. Both elbows lie down. Face turned partly down, weary half-closed eyes, clearly conscious but unable to get up yet. This must immediately read as a defeated fighter lying down from exhaustion. NO propped-up torso, NO hand supporting his head, NO lounging, NO seductive reclining, NO proud smile.
Dark flowing Chinese hanfu with weary frayed edges, tied long black hair. One fallen Chinese straight jian sword lies separately in front, no longer held.
Style is monochrome black ink manga / restrained wuxia silhouette, dominant near-black robes with carefully drawn white and muted gray dry-brush lines defining folds, face and hands. Original adult character, not from an existing series. Fully clothed, no blood, no injury detail, no gore, no death.
Landscape 1536x1024. Low horizontal contour, head toward left and shoes toward right, complete hair, both arms, both shoes and entire fallen sword fully within canvas. At least 8% clear transparent margin.
TRUE TRANSPARENT ALPHA outside the whole character and sword. Absolutely NO scenery, NO ground or floor plane, NO paper rectangle, NO black or gray background, NO glow, NO smoke, NO shadow. Body shading may contain opaque black, white and gray; all surrounding space genuinely transparent. No text, no letters, no logo, no watermark.
```

敗者第一稿因姿勢太像悠閒側躺而未採用；指定局部修改因 sandbox 無法讀取 referenced_image_paths 而失敗，後以同一內建 image_gen 重新生成上述最終倒地姿势。


## 追加：輾壓勝利與慘輸

2026-09-20 使用內建 image_gen 生成，保留透明 PNG 原稿；WebP 僅作格式轉換。

### duel-dominant

```text
Use case: illustration-story. Production transparent full-body character cutout for a Chinese wuxia black-and-white ink manga website.
ONE original ADULT Chinese swordsman who has just won an overwhelming, effortless victory. He stands perfectly upright and composed, completely unharmed, long black hair tied loosely, dark flowing hanfu robe with clean immaculate folds. Three-quarter view facing RIGHT. One hand is held behind his back, the other holds ONE straight Chinese jian sword relaxed downward away from his body. Both feet firmly on the same implied ground level, full soles visible. Calm distant expression, understated confidence, no loud celebration, no raised sword. Sword must remain outside his body and its entire blade must be visible.
Pure monochrome black ink manga and restrained Chinese brushwork, dominant near-black silhouette with fine white and soft gray crosshatched highlights for face, hands, silk folds. Elegant adult proportions, no glossy 3D or photorealism.
Portrait 1024x1536, whole person from hair to both soles plus full sword within canvas, clear transparent margin, no cropped robe or weapon. TRUE TRANSPARENT ALPHA everywhere outside person and sword. No scenery, ground plane, floor, cast shadow, smoke, glow, black or gray background, paper rectangle. White fabric highlights may remain opaque inside the character.
No blood, wounds, torn clothes, bruises, gore. No extra people, no trophies, crowns, medals, words, text, numbers, VS, logos or watermark.
```

### duel-crushed

```text
Use case: illustration-story. Production transparent full-body defeated character cutout for a Chinese wuxia black-and-white ink manga website.
ONE original ADULT Chinese martial artist who has suffered an overwhelming sporting defeat. A clearly different character with short untidy black hair and a plain gray martial robe over loose trousers. His whole body has buckled forward onto bent knees: one knee and shin down, other leg folded, torso collapsed forward, ONE open hand weakly braces against the implied ground, the other arm hangs limp near his side, head deeply bowed from exhaustion. His shoulders slump heavily and robe is visibly frayed and torn at its outer edges while remaining fully clothed. A single fallen straight Chinese jian sword lies separately beside him, NOT held, entirely outside the body. This must unmistakably read as crushed defeat, NOT meditation, NOT a formal kneeling bow, NOT a relaxed rest. No weapon through body.
Pure monochrome black ink manga with restrained Chinese dry-brush linework; medium-gray robe, darker ink contour, selective opaque white highlights on hands and fabric, clear readable anatomy. Original adult character, no glossy 3D, not photorealistic.
Landscape 1536x1024, whole kneeling figure including ALL limbs, both shoes and entire fallen sword within image with clear transparent margins. View from front three-quarter side to show bowed face and the supporting palm. TRUE TRANSPARENT ALPHA outside body and sword. No ground plane, floor, scenery, paper rectangle, background wash, gray or black backdrop, glow, cast shadow, dust or smoke.
NO BLOOD, NO OPEN WOUNDS, NO GORE, NO DEATH. No extra people, no additional limbs or weapons, no text, no labels, no numbers, no logo or watermark.
```

