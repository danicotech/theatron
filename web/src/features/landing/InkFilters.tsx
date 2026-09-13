import styles from './InkFilters.module.css';

/**
 * 全站共用的兩個 SVG 濾鏡。整頁只掛一次。
 *
 * 為什麼是 SVG 而不是圖檔:規格要的手繪墨點筆刷不存在(素材缺口第四節),
 * 而 feTurbulence 就是程序噪聲 —— 跟序幕 shader 裡的 fbm 是同一個東西的另一種
 * 執行方式。用它把遮罩的邊緣**位移**(不是模糊)出來,得到的才是墨在纖維上
 * 跑出來的碎邊。
 *
 * 兩個濾鏡各自只做一件事:
 *   ink-rough  把邊緣咬碎 —— 轉場、印章、海報上的墨都用它
 *   ink-paper  紙的纖維紋 —— 捲軸與木牆的底
 */
export function InkFilters() {
  return (
    <svg className={styles.defs} aria-hidden="true" focusable="false">
      <defs>
        <filter id="ink-rough" x="-20%" y="-20%" width="140%" height="140%">
          {/* baseFrequency 的兩個值不同:墨沿纖維走得比逆纖維遠,所以噪聲要有方向。 */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.013 0.028"
            numOctaves={4}
            seed={4713}
            result="grain"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="grain"
            scale={26}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        <filter id="ink-paper" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={3} seed={19} />
          {/* 只留一點點:紙紋看得見就變成花紋,看不見才是紙。 */}
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.06 0"
          />
        </filter>
      </defs>
    </svg>
  );
}
