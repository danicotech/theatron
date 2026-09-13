/**
 * 序幕的四階段 —— 整段戲的**唯一**狀態來源。
 *
 * 規格的一條硬要求:序幕必須可以正反刮。所以這裡沒有計時器、沒有
 * `performance.now()`、沒有「播到第幾幀」。狀態是一個純函式:
 *
 *     progress(0…1) → PrologueState
 *
 * 往回捲的時候不是「倒帶」,是同一個函式吃到比較小的數字 —— 於是往回走跟往前走
 * 得到的畫面必定一模一樣,連對齊誤差都不會有。這也是它測得起來的原因:
 * 測試不必模擬時間,只要餵數字。
 *
 * 唯一不是純函式的東西是袖、帶、髮的**遲滯**(規格要 100–200ms)。遲滯本質上
 * 是時間,所以它不在這裡 —— 它在 prologueScene 裡,用一個阻尼追著這裡算出來的
 * 姿勢跑。分界是刻意的:**狀態是進度的函式,次級運動是狀態的函式。**
 * 停下來的時候阻尼會收斂到精確值,所以刮停在任何一點畫面都是確定的。
 */

/** 四個階段。名字就是規格裡那四段。 */
export type PrologueStageId = 'duel' | 'tear' | 'bleed' | 'fall';

/**
 * 四段的邊界,規格給的數字原樣搬過來。
 *
 * 寫成一張表而不是散在 `if` 裡:階段編號、階段內進度、以及「下一段從哪開始」
 * 三件事都要用到同一組數字,散開的話改一個就會有一個忘記跟。
 */
export const STAGE_BOUNDS: ReadonlyArray<{ id: PrologueStageId; from: number; to: number }> = [
  // 旗幾乎不動,兩道身影在旗後對劍,標題逐筆現出,竹葉飄。
  { id: 'duel', from: 0, to: 0.25 },
  // 劍尖刺穿布面,拖出一道斜的裂口;畫面微顫;月光從裂口灌進來。
  { id: 'tear', from: 0.25, to: 0.45 },
  // 血墨從裂口滲出,紅淹掉大半個畫面,藍只活在四角與裂口內側。
  { id: 'bleed', from: 0.45, to: 0.75 },
  // 旗落下、化成墨;紅不消失,收進下一章的印與髮絲線;枯梅接住最後一滴,開花。
  { id: 'fall', from: 0.75, to: 1 },
];

export interface PrologueState {
  /** 原始進度,已夾在 0…1。 */
  p: number;
  /** 第幾段(0…3)。 */
  stageIndex: number;
  stage: PrologueStageId;
  /** 這一段自己的 0…1。給階段內的編排用。 */
  stageProgress: number;

  /** 標題逐筆現出的完成度。 */
  title: number;
  /** 旗後兩道身影的可見度。劍劃破之後他們就不在了。 */
  duel: number;
  /** 對劍的招式進度。剪影的姿勢是它的函式。 */
  pose: number;
  /** 裂口張開的程度。**單調不減**,刮回去才會把布補回來。 */
  tear: number;
  /** 血墨滲出的半徑。同樣單調不減。 */
  bleed: number;
  /** 旗落下 / 化墨的完成度。 */
  fall: number;
  /** 枯梅開花的完成度。 */
  blossom: number;
  /** 紅色收進下一章的印與髮絲線的完成度。 */
  seal: number;
  /** 月光從裂口灌進來的量。 */
  moonThrough: number;
  /** 刺穿那一下的畫面震顫(0…1)。是進度的凸起,不是時間的衰減。 */
  shudder: number;
  /** 布面整體的擺幅。裂開之後布鬆了,擺得更大。 */
  billow: number;
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** GLSL 的 smoothstep。shader 與 CPU 兩邊用同一條曲線,刮到哪裡都對得上。 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const span = edge1 - edge0;
  const t = clamp01(span === 0 ? (x < edge0 ? 0 : 1) : (x - edge0) / span);
  return t * t * (3 - 2 * t);
}

/**
 * 一個以進度為軸的凸起(不是以時間為軸的衰減)。
 *
 * 刺穿那一下的震顫要在刮回去的時候**再顫一次**,而且顫得一樣 ——
 * 用時間寫的衰減做不到這件事,它只會在第一次經過時發生。
 */
function bump(x: number, from: number, to: number): number {
  const t = clamp01((x - from) / (to - from || 1e-6));
  return Math.sin(t * Math.PI) ** 2;
}

/** 進度落在第幾段。二分不必要 —— 只有四段,線性掃比較好讀。 */
export function stageAt(p: number): number {
  const x = clamp01(p);
  for (let i = STAGE_BOUNDS.length - 1; i >= 0; i -= 1) {
    if (x >= (STAGE_BOUNDS[i]?.from ?? 0)) return i;
  }
  return 0;
}

/**
 * 進度 → 整段戲的狀態。
 *
 * 每一條訊號都是 smoothstep 的組合,理由不只是好看:smoothstep 在兩端一階導數
 * 為零,所以刮到邊界上停住時不會有一個還在跑的速度殘留。裂口與血墨刻意**單調
 * 不減**(只有 smoothstep 沒有乘任何會回頭的項)—— 布被劃破之後不會自己癒合,
 * 倒著刮時它是「還沒被劃破」,不是「正在癒合」。
 */
export function prologueState(progress: number): PrologueState {
  const p = clamp01(progress);
  const stageIndex = stageAt(p);
  const bound = STAGE_BOUNDS[stageIndex] ?? STAGE_BOUNDS[0]!;
  const stageProgress = clamp01((p - bound.from) / (bound.to - bound.from || 1e-6));

  const tear = smoothstep(0.25, 0.45, p);
  const bleed = smoothstep(0.45, 0.75, p);
  const fall = smoothstep(0.75, 1, p);

  return {
    p,
    stageIndex,
    stage: bound.id,
    stageProgress,

    title: smoothstep(0.0, 0.16, p),
    // 身影**一開始就在**:這一章的第一格就是兩個人在打。淡入的話,頁面最上面
    // 那一屏是一塊空布,而那正是訪客第一眼看到的東西。
    // 他們在布被劃破之後淡出 —— 他們是「剛才在打的兩個人」,不是一直站在那裡。
    duel: 1 - smoothstep(0.38, 0.6, p),
    // 招式跑完整段 0…0.45:刺穿那一下正好是招式的終點,不是中途插進來的事件。
    pose: clamp01(p / 0.45),
    tear,
    bleed,
    fall,
    blossom: smoothstep(0.8, 1, p),
    seal: smoothstep(0.86, 1, p),
    // 月光只能從已經破掉的地方進來,所以它是裂口的函式,不是另一條獨立曲線。
    moonThrough: tear * (1 - 0.45 * bleed),
    shudder: bump(p, 0.25, 0.36),
    billow: 0.35 + 0.5 * tear + 0.35 * fall,
  };
}

/**
 * 餵給 shader 的 uniform。
 *
 * 單獨一支而不是直接把 PrologueState 倒進去:shader 只認得上幾個數字,
 * 而 PrologueState 裡有一半是 DOM 那層在用的。兩邊各取所需,但**來源同一個**。
 */
export interface PrologueUniforms {
  uTear: number;
  uBleed: number;
  uFall: number;
  uDuel: number;
  uPose: number;
  uMoon: number;
  uShudder: number;
  uBillow: number;
}

export function prologueUniforms(progress: number): PrologueUniforms {
  const s = prologueState(progress);
  return {
    uTear: s.tear,
    uBleed: s.bleed,
    uFall: s.fall,
    uDuel: s.duel,
    uPose: s.pose,
    uMoon: s.moonThrough,
    uShudder: s.shudder,
    uBillow: s.billow,
  };
}

/**
 * 四段各自的一句說明。給 DOM 那層當可讀的狀態文字用 ——
 * 序幕是唯一「看得到但讀不到」的一段,所以它要自己說出正在發生什麼。
 */
export const STAGE_CAPTIONS: Readonly<Record<PrologueStageId, string>> = {
  duel: '旗後兩道身影對劍',
  tear: '劍鋒劃破旗面,月光灌進裂口',
  bleed: '血墨從裂口滲出',
  fall: '旗落,最後一滴落在枯梅上',
};
