'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

import type { ChapterId, ScenePlate } from './chapters';
import { SceneLayer } from './SceneLayer';
import { useChapterProgress } from './useChapterProgress';
import styles from './WorldScene.module.css';

export interface WorldSceneProps {
  /** 降級用的 2D 場景板。沒有 WebGL、或使用者要求減少動態時就是它上場。 */
  plates: readonly ScenePlate[];
  active: ChapterId;
  reduced: boolean;
  /** 文件的根,進度是從它底下的章節量出來的。 */
  doc: RefObject<HTMLElement | null>;
}

/**
 * 即時算出來的環境層 —— 這一頁的「世界」。
 *
 * 為什麼是這個形狀:
 *
 *  1. **2D 那一層沒有被刪掉,它是降級路徑。** 沒有 WebGL、或使用者開了減少動態,
 *     就直接畫 SceneLayer,連 canvas 都不建。內容永遠讀得完,這是底線。
 *  2. **three 是動態載入的。** 它比整個頁面其他所有東西加起來還大;掛在首屏的
 *     JS 包裡,第一次繪製就得等它下載完。所以等元件掛好、確定真的要用了才載。
 *  3. **畫出第一格之前,2D 那層留著。** 不然使用者會先看到一塊黑,等個幾百毫秒
 *     世界才亮起來 —— 那個黑比沒有 3D 更糟。
 *
 * 相機吃的是 useChapterProgress 的連續進度(0…4),不是離散的章節;
 * 近景與章節軌道仍然吃離散的 active。兩種答案各有各的用途,見那兩個 hook。
 */
export function WorldScene({ plates, active, reduced, doc }: WorldSceneProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const progress = useChapterProgress(doc);
  // 沒有 WebGL 就永遠不建 canvas。探測要在瀏覽器裡做,所以初值是 null(還不知道)。
  const [webgl, setWebgl] = useState<boolean | null>(null);
  // 世界畫出第一格之前,2D 那層不能收。
  const [painted, setPainted] = useState(false);

  const wanted = !reduced && webgl !== false;

  useEffect(() => {
    if (reduced) {
      setWebgl(false);
      return;
    }
    let alive = true;
    void import('../world3d/webgl').then(({ hasWebGL }) => {
      if (alive) setWebgl(hasWebGL());
    });
    return () => {
      alive = false;
    };
  }, [reduced]);

  useEffect(() => {
    if (webgl !== true || reduced) return;
    const el = canvas.current;
    if (el === null) return;

    let alive = true;
    let stop: (() => void) | undefined;

    void Promise.all([import('../world3d/engine'), import('../world3d/quality')]).then(
      ([{ createEngine }, { detectQuality, probeBrowser, degrade }]) => {
        if (!alive) return;

        const quality = detectQuality(probeBrowser());
        let ratio = Math.min(window.devicePixelRatio || 1, quality.dprCap);
        const engine = createEngine({
          canvas: el,
          quality,
          reduced,
          width: window.innerWidth,
          height: window.innerHeight,
          pixelRatio: ratio,
        });

        // 指標視差。用歸一化座標(−1…1),相機那邊決定要用多少。
        const pointer = { x: 0, y: 0 };
        const onPointer = (e: PointerEvent) => {
          pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
          pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
        };

        const onResize = () => {
          engine.resize(window.innerWidth, window.innerHeight);
        };

        // 分頁在背景時不要畫。看不見的東西沒有畫的理由,而且省電。
        let hidden = document.visibilityState === 'hidden';
        const onVisibility = () => {
          hidden = document.visibilityState === 'hidden';
          last = performance.now();
        };

        let raf = 0;
        let last = performance.now();
        let slow = 0;
        let first = true;

        const loop = () => {
          raf = requestAnimationFrame(loop);
          const now = performance.now();
          // 夾住 dt:分頁切回來時 now − last 可能是好幾秒,不夾會讓所有
          // 阻尼一次跳到終點,看起來像閃了一下。
          const dt = Math.min((now - last) / 1000, 1 / 20);
          last = now;
          if (hidden) return;

          engine.frame(dt, now / 1000, progress.current, pointer.x, pointer.y);

          if (first) {
            first = false;
            setPainted(true);
          }

          // 連續掉格才降解析度 —— 偶爾一格慢是正常的,照著降會一路降到底。
          if (dt > 1 / 30) {
            slow += 1;
            if (slow > 45 && ratio > 0.7) {
              ratio = degrade(ratio);
              engine.setPixelRatio(ratio);
              slow = 0;
            }
          } else if (slow > 0) {
            slow -= 1;
          }
        };

        raf = requestAnimationFrame(loop);
        window.addEventListener('resize', onResize);
        window.addEventListener('pointermove', onPointer, { passive: true });
        document.addEventListener('visibilitychange', onVisibility);

        stop = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener('resize', onResize);
          window.removeEventListener('pointermove', onPointer);
          document.removeEventListener('visibilitychange', onVisibility);
          engine.dispose();
        };
      },
    );

    return () => {
      alive = false;
      stop?.();
    };
  }, [webgl, reduced, progress]);

  return (
    <>
      {/* 世界還沒亮起來之前,2D 那層頂著;亮了之後它淡出讓位。 */}
      {(!wanted || !painted) && <SceneLayer plates={plates} active={active} reduced={reduced} />}
      {wanted && (
        <canvas
          ref={canvas}
          className={[styles.canvas, painted ? styles.lit : ''].join(' ')}
          aria-hidden="true"
        />
      )}
    </>
  );
}
