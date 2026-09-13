'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

import type { ChapterId } from './chapters';
import { SceneLayer } from './SceneLayer';
import { PROGRESS_MAX } from './useChapterProgress';
import styles from './WorldScene.module.css';

export interface WorldSceneProps {
  /** 連續章節進度(0…章數−1)。由 Landing 量,這裡只讀。 */
  progress: RefObject<number>;
  /** 現在是哪一章。降級路徑要用它決定站哪一張板子。 */
  active: ChapterId;
  reduced: boolean;
}

/**
 * 即時算出來的環境層 —— 這一頁的「世界」。
 *
 * 為什麼是這個形狀:
 *
 *  1. **它是布景,不是內容。** 整層 aria-hidden。沒有 WebGL、或使用者開了減少
 *     動態,就根本不建 canvas —— 什麼都不會少讀到,因為每一個字都在 DOM 那一層。
 *     序幕自己還有一張靜態海報頂著(見 prologue/Prologue.tsx)。
 *  2. **three 是動態載入的。** 它比整個頁面其他所有東西加起來還大;掛在首屏的
 *     JS 包裡,第一次繪製就得等它下載完。所以等元件掛好、確定真的要用了才載。
 *  3. **進度要換算。** 章節有七章(進度 0…6),而相機的 waypoint 是 world3d 那邊
 *     定的,數量不一定相同。直接把 0…6 餵進去,超出的部分會被夾在最後一個鏡位上 ——
 *     後三章就變成同一個畫面。所以按比例縮進相機自己的範圍,
 *     而那個範圍要在 three 載進來之後才問得到(camera.ts import three)。
 */
export function WorldScene({ progress, active, reduced }: WorldSceneProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // 沒有 WebGL 就永遠不建 canvas。探測要在瀏覽器裡做,所以初值是 null(還不知道)。
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [painted, setPainted] = useState(false);

  const wanted = !reduced && webgl === true;

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
    if (!wanted) return;
    const el = canvas.current;
    if (el === null) return;

    let alive = true;
    let stop: (() => void) | undefined;

    void Promise.all([
      import('../world3d/engine'),
      import('../world3d/quality'),
      import('../world3d/camera'),
    ])
      .then(([{ createEngine }, { detectQuality, probeBrowser, degrade }, { WAYPOINTS }]) => {
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

        // 七章的進度 → 相機自己的鏡位範圍。除以零不可能(至少兩個鏡位),
        // 但 PROGRESS_MAX 可能是 0(只有一章),所以那一邊要防。
        const scale = PROGRESS_MAX > 0 ? (WAYPOINTS.length - 1) / PROGRESS_MAX : 0;

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

          engine.frame(dt, now / 1000, progress.current * scale, pointer.x, pointer.y);

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
      })
      .catch(() => {
        // 建不起來就當成沒有 WebGL。一塊黑畫布比沒有布景糟得多。
        if (alive) setWebgl(false);
      });

    return () => {
      alive = false;
      stop?.();
      setPainted(false);
    };
  }, [wanted, reduced, progress]);

  return (
    <>
      {/* 世界亮起來之前、或根本不會亮的時候,2D 那層頂著。
          任何一刻都不會是一塊沒有定義的黑。 */}
      {(!wanted || !painted) && <SceneLayer active={active} reduced={reduced} />}
      {wanted && (
        <canvas
          ref={canvas}
          className={[styles.canvas, painted ? styles.lit : ''].join(' ')}
          aria-hidden="true"
          data-testid="world-canvas"
        />
      )}
    </>
  );
}
