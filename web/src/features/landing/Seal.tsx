import styles from './Seal.module.css';

/**
 * 朱文方印。全站唯一一份印章圖形。
 *
 * 規格要的印章 SVG 不存在(素材缺口第四節),而手寫篆刻需要字跡來源 ——
 * 沒有就不假造。這一顆是畫出來的:方框、四角的缺口、內側一條細邊,
 * 字用顯示字體排在中間。它是**印章的形制**,不是某個人的印。
 *
 * 一份實作三個地方用(獎賞牆上的紅印、報名的印章按鈕、落款),
 * 這是「一個概念只有一個權威位置」。
 */
export interface SealProps {
  /** 印面上的字。兩個字最好看,四個字會擠 —— 超過就縮字級,不換行。 */
  text: string;
  /** 有沒有進無障礙樹。牆上的印是裝飾(旁邊有字),按鈕裡的印也是。 */
  className?: string | undefined;
}

export function Seal({ text, className }: SealProps) {
  const chars = Array.from(text).slice(0, 4);
  // 印章的字是由右至左、由上而下排的,不是一條橫的。一字置中、二字直排、
  // 三四字兩欄 —— 這三種版式涵蓋了所有會出現在這個站上的印。
  const layout = SEAL_LAYOUTS[chars.length] ?? SEAL_LAYOUTS[1]!;

  return (
    <svg
      className={[styles.seal, className].filter(Boolean).join(' ')}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      {/* 印身。四角略略缺一塊 —— 石章的角本來就會崩,方正得完美的是印刷體。 */}
      <path className={styles.body} d="M6 10 L10 6 L90 6 L94 11 L94 90 L89 94 L11 94 L6 89 Z" />
      {/* 內邊。朱文印的邊比字粗,是它讀得出來是印而不是紅方塊的原因。 */}
      <path className={styles.inner} d="M15 15 H85 V85 H15 Z" />
      {chars.map((ch, i) => {
        const at = layout.at[i] ?? [50, 50];
        return (
          <text
            className={styles.text}
            key={`${ch}-${i}`}
            x={at[0]}
            y={at[1]}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={layout.size}
          >
            {ch}
          </text>
        );
      })}
    </svg>
  );
}

/** 一字置中、二字直排、三四字兩欄(右欄先)。座標是 100×100 印面上的。 */
const SEAL_LAYOUTS: Readonly<
  Record<number, { size: number; at: ReadonlyArray<readonly [number, number]> }>
> = {
  1: { size: 46, at: [[50, 51]] },
  2: {
    size: 32,
    at: [
      [50, 33],
      [50, 68],
    ],
  },
  3: {
    size: 26,
    at: [
      [67, 33],
      [67, 68],
      [33, 50],
    ],
  },
  4: {
    size: 26,
    at: [
      [67, 33],
      [67, 68],
      [33, 33],
      [33, 68],
    ],
  },
};
