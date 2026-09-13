import styles from './StaticPoster.module.css';
import { worldAsset } from './world';

/**
 * 不想看到動、沒有 WebGL、或 3D 還在載的時候,序幕長這樣:一張**靜止的殘旗海報**。
 *
 * 三件事要說清楚:
 *
 *  1. **它不是「比較差的版本」,它是同一件事的靜止畫。** 規格要的是「減少動態時
 *     仍然有完整的比賽資訊」,而資訊本來就全部在 DOM 那一層 —— 這張海報要負責的
 *     只有氣氛。少的是動,不是內容。
 *  2. **旗是畫出來的,不是素材。** `design/jianzhong/assets` 裡沒有殘旗去背
 *     (素材缺口第三節),而 SVG 的旗吃主題色、縮到 390 寬不會糊,還可以把
 *     那道裂口畫成跟 3D 版同一個角度。拿別的素材頂替會變成另一個世界的東西。
 *  3. **底板用 `plate-gate`**,那是《劍塚》這一版專門生的四張之一;百業的雪景
 *     背景色調對不上,不用。
 */
export function StaticPoster() {
  const plate = worldAsset('plate-gate');

  return (
    <div className={styles.poster} aria-hidden="true" data-testid="static-poster">
      <img
        className={styles.plate}
        src={plate.file}
        alt=""
        width={plate.width}
        height={plate.height}
        decoding="async"
        fetchPriority="high"
      />

      <svg className={styles.flag} viewBox="0 0 320 400" aria-hidden="true" focusable="false">
        <defs>
          {/* 月在旗後,所以布本身是亮的 —— 上緣最亮,越往下越沉。
              皮影的光必須在被照的東西後面,靜止畫也不例外。 */}
          <linearGradient id="poster-backlight" x1="0" y1="0" x2="0.25" y2="1">
            <stop offset="0%" className={styles.lit} />
            <stop offset="62%" className={styles.mid} />
            <stop offset="100%" className={styles.deep} />
          </linearGradient>
        </defs>

        {/* 朽樑。旗掛在它上面,所以它要先畫。 */}
        <rect className={styles.beam} x="0" y="26" width="320" height="9" />

        {/* 布。下緣是不規則的破口,不是一條直線 —— 直線讀起來是窗簾。
            右上到左下那道缺口就是劍劃過的那一刀,角度與 3D 版的 SDF 線段同一條。 */}
        <path
          className={styles.cloth}
          d="M46 35 L274 35 L268 300 L246 286 L238 322 L214 300 L198 338 L172 306
             L154 344 L128 310 L112 340 L88 302 L66 326 L52 292 Z
             M198 227 L118 82 L146 74 L226 219 Z"
          fillRule="evenodd"
        />

        {/* 裂口的兩道邊光。布被劃開的地方纖維變薄,光從那裡穿得最多。 */}
        <path className={styles.lip} d="M198 227 L118 82" />
        <path className={styles.lip} d="M226 219 L146 74" />

        {/* 血墨。從裂口往下滲,前緣不規則 —— 跟 shader 那一版是同一種墨。 */}
        <path
          className={styles.ink}
          d="M150 140 C 132 176, 140 214, 128 246 C 120 268, 134 286, 126 306
             C 148 300, 156 272, 170 250 C 186 224, 178 190, 190 162 Z"
        />
      </svg>
    </div>
  );
}
