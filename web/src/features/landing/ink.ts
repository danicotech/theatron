import type { CSSProperties } from 'react';

import { clamp01, smoothstep } from './prologue/stages';

/**
 * 墨暈 —— 全站唯一一份。
 *
 * 序幕的血墨、章節之間的轉場、報名印章按下去那一下,是**同一件事**的三個尺寸:
 * 一個從中心長出來、前緣被噪聲咬得不規則的閾值遮罩。所以它只實作一次,
 * 由參數決定長多大、從哪裡長、咬得多碎。
 *
 * 序幕那一份跑在 GLSL 裡(布的 fragment),因為它必須跟布的皺褶對得上;
 * 這一份跑在 CSS 裡,因為它蓋的是 DOM。兩邊用同一條 smoothstep 曲線與同一個
 * 「半徑減噪聲」的式子,所以看起來是同一種墨,不是兩種。
 *
 * 為什麼不是 canvas:轉場要蓋在真的文字上面,而文字要能被選取、被螢幕閱讀器讀。
 * canvas 會把那一層變成一張圖。
 */

export type InkOrigin = 'centre' | 'seal' | 'tear';

export interface InkOptions {
  /** 長到最大時的半徑,以元素短邊的百分比計。 */
  spread?: number;
  /** 前緣的柔邊寬度(百分比)。越小越銳利 —— 印章比轉場銳利。 */
  edge?: number;
  origin?: InkOrigin;
}

/** 三個起點。轉場從畫面中心,印章從按下去的地方,血墨從裂口。 */
const ORIGINS: Readonly<Record<InkOrigin, readonly [number, number]>> = {
  centre: [50, 50],
  seal: [50, 50],
  tear: [62, 26],
};

/**
 * 進度 → 一組 CSS 變數。
 *
 * 是純函式,所以轉場跟序幕一樣可以來回刮:同一個進度永遠是同一張遮罩,
 * 不存在「已經播到哪裡」。
 */
export function inkVars(progress: number, options: InkOptions = {}): CSSProperties {
  const p = clamp01(progress);
  const spread = options.spread ?? 150;
  const edge = options.edge ?? 16;
  const [x, y] = ORIGINS[options.origin ?? 'centre'];

  // 半徑用 smoothstep 而不是線性:墨滴到紙上是先慢、中間快、到邊又慢下來
  // (纖維吸飽了)。線性的擴散看起來像一個在放大的圓形遮罩,不像墨。
  const radius = smoothstep(0, 1, p) * spread;

  return {
    '--ink-x': `${x}%`,
    '--ink-y': `${y}%`,
    '--ink-radius': `${radius.toFixed(2)}%`,
    // 前緣在剛開始時最糊(墨還在紙上跑),吃飽之後銳利下來。
    '--ink-edge': `${(edge * (1 - 0.55 * p)).toFixed(2)}%`,
    '--ink-p': p.toFixed(4),
  } as CSSProperties;
}

/**
 * 章與章之間的轉場進度。
 *
 * **整數是章節的中心,不是交界。** `useChapterProgress` 的錨點取的是每一章
 * 中心線對齊視窗中心的位置,所以 2.0 是第三章正中間、2.5 才是它與下一章之間。
 * 轉場帶因此掛在**半整數**上 —— 掛在整數上會變成「每讀到一章的正中間就潑一次墨」,
 * 那是最容易犯、也最容易在實機上才看出來的錯。
 *
 * 只吃連續進度,所以中途換方向、或直接跳到別章,都只是「這個數字變了」——
 * 不需要中斷任何正在播的東西,因為沒有東西在播。
 */
export function transitionAt(progress: number, band = 0.34): number {
  // 進度 0…1 整段都還在序幕裡。
  //
  // `useChapterProgress` 把第一章的錨點釘在 0(第一屏一定是 0),而序幕比一屏
  // 高四倍 —— 所以「0.5」不是第一章與第二章的交界,它是序幕演到一半。在那裡
  // 潑一次墨,會在血墨正要滲開的那一刻再蓋一層紅,兩片紅互相打架。
  //
  // 而且**序幕不需要轉場**:它自己的最後一段就是轉場(紅不消失,收進下一章的
  // 印與髮絲線)。所以第一道墨暈從 1.5 起算。
  if (progress < 1) return 0;

  const frac = progress - Math.floor(progress);
  const half = band / 2;
  const d = Math.abs(frac - 0.5);
  if (d > half) return 0;
  // 進帶時漲到 1、出帶時退回 0 —— 墨暈開又收掉,不是留在畫面上。
  return smoothstep(half, 0, d);
}
