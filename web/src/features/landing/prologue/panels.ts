import { clamp01, STAGE_BOUNDS } from './stages';

/**
 * 第一幕的五個分鏡格。
 *
 * 這一幕是漫畫分鏡,不是動畫:**格內人物完全不動**。所以剪影不是每幀算出來的
 * 畫面,是一張整格期間都不變的貼圖 —— 整幕只重畫五次,其餘時間是零成本。
 * 「現在是第幾格」因此必須是進度的純函式(與 stages.ts 同一個理由):
 * 快滑、反滑、停在任何一點,得到的都是同一格,不會因為「剛才播到哪」而跳。
 *
 * 一個格描述兩件事:
 *
 *   · 兩件剪影各自的**水平位移** —— 對峙是分開的,交鋒是合上的,後撤又分得更開。
 *     兩個 SVG 共用同一個 viewBox(見 public/shadow/duel.json),偏移 0 疊起來
 *     就是原圖,所以位移是相對原位的偏差,不是各自的絕對座標。
 *   · 鏡頭在畫布上的**取景框** —— 推近與極近靠的是裁切與放大,不是把人畫大。
 *     格與格之間不插值:換格是離散的,由墨暈在 150ms 內換掉(見 shaders.ts)。
 */

/**
 * 第一幕的終點。
 *
 * 序幕的三幕弧線是暖 → 撕裂 → 冷:第一幕就是 stages.ts 的 `duel` 段。邊界不在
 * 這裡重寫一次 —— 它只有一個權威位置,改那邊這裡自動跟上。
 */
const ACT_ONE_END = STAGE_BOUNDS[0]?.to ?? 1;

export interface ProloguePanel {
  /** 給人看的名字。畫面上不出現,錯誤訊息與測試靠它指名。 */
  id: string;
  /** 這一格從哪個**幕內進度**開始(含)。終點是下一格的起點。 */
  from: number;
  /** 左件的水平位移,單位是畫布寬的比例。正是往右。 */
  leftDx: number;
  /** 右件的水平位移,同上。 */
  rightDx: number;
  /** 取景中心的垂直位置,0 是畫布上緣、1 是下緣。 */
  camY: number;
  /** 取景寬,1 是整張畫布。小於 1 就是推近。 */
  camWidth: number;
}

/**
 * 五格。數字就是分鏡表原樣。
 *
 * 只存起點不存終點:每個邊界的權威位置只有一個,存兩份就會有一份忘記跟。
 * 最後一格沒有終點 —— 它撐到這一幕結束(分鏡表上的 0.85 之後布就要被劃破了,
 * 那時人物已經在淡出,不需要第六格)。
 */
export const PANELS: readonly ProloguePanel[] = [
  // ① 對峙:兩人分站兩邊,中間留著那段還沒被跨過的距離。
  { id: 'standoff', from: 0, leftDx: -0.055, rightDx: 0.055, camY: 0.5, camWidth: 1 },
  // ② 第一次交鋒:回到原位 —— 原圖本身就是兩把劍交在一起的那一格。
  { id: 'clash', from: 0.35, leftDx: 0, rightDx: 0, camY: 0.5, camWidth: 1 },
  // ③ 推近:鏡頭往上收到劍的高度,身體只留一部分在框裡。
  { id: 'press', from: 0.47, leftDx: 0.005, rightDx: -0.005, camY: 0.34, camWidth: 0.62 },
  // ④ 極近劍鋒:三倍多的放大,畫面上只剩兩片交在一起的鋒。
  { id: 'edge', from: 0.59, leftDx: 0.015, rightDx: -0.015, camY: 0.2, camWidth: 0.3 },
  // ⑤ 後撤:退得比對峙還開,而且鏡頭稍微拉遠 —— 這一下的空是給劍尖刺穿布面留的。
  { id: 'recoil', from: 0.7, leftDx: -0.07, rightDx: 0.07, camY: 0.52, camWidth: 1.04 },
];

/** 序幕全程的進度 → 第一幕的幕內進度。第一幕之後一律當作停在幕尾。 */
export function actOneProgress(progress: number): number {
  return clamp01(clamp01(progress) / (ACT_ONE_END || 1));
}

/** 幕內進度落在第幾格。線性掃 —— 只有五格,二分不會比較好讀。 */
export function panelIndexAt(actProgress: number): number {
  const x = clamp01(actProgress);
  for (let i = PANELS.length - 1; i >= 0; i -= 1) {
    if (x >= (PANELS[i]?.from ?? 0)) return i;
  }
  return 0;
}

/** 序幕全程的進度 → 第幾格。場景那一層拿到的是全程進度,所以這支才是入口。 */
export function panelAt(progress: number): number {
  return panelIndexAt(actOneProgress(progress));
}

export function panelOf(progress: number): ProloguePanel {
  return PANELS[panelAt(progress)] ?? PANELS[0]!;
}

/** canvas 2D 的仿射矩陣,順序與 `setTransform(a, b, c, d, e, f)` 相同。 */
export type CanvasMatrix = readonly [number, number, number, number, number, number];

/**
 * 取景框 → 畫進離屏 canvas 用的矩陣。
 *
 * **一定要直接寫矩陣,不要串 translate/scale/translate。** 串起來的版本 y 方向
 * 很容易寫反,而寫反的症狀是極近那一格的取景整個掉到畫面外 —— 剩下一塊空布,
 * 看起來像剪影沒載進來,不像座標錯了。直接寫沒有出錯的機會,而且測得起來:
 * 「(0.5, camY) 這一點要落在畫布正中央」是一行斷言。
 */
export function panelMatrix(panel: ProloguePanel, width: number, height: number): CanvasMatrix {
  const s = 1 / panel.camWidth;
  const cx = 0.5;
  return [s, 0, 0, s, width / 2 - s * cx * width, height / 2 - s * panel.camY * height];
}

/** 把一個畫布座標套上矩陣。只有測試與除錯用得到,但它是矩陣唯一的意義。 */
export function applyMatrix(m: CanvasMatrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
