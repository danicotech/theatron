'use client';

import { useEffect, useRef, useState } from 'react';

import { STAGES, type ChapterId } from './chapters';
import styles from './ForegroundStage.module.css';
import { worldAsset } from './world';

/** 退場的時間。比進場短 —— 讓位要快,站上來可以慢。 */
const RETIRE_MS = 780;

export interface ForegroundStageProps {
  active: ChapterId;
  reduced: boolean;
}

/**
 * 近景層:站在鏡頭與文字之間的那幾件去背素材。
 *
 * 它固定貼著視窗底緣,不隨頁面捲動。理由是 kage 的那條:跟著文件捲的近景會被
 * 讀成「印在紙上的插圖」,只有釘在畫面上的才像是站在鏡頭前面的東西。所以每一件
 * 都從底緣量起,只有左右之分,沒有上下。
 *
 * 一章只掛一組。切章時舊的那組留一下再走 —— 直接抽掉會看到東西憑空消失,
 * 淡出加模糊則像是鏡頭往前走、把它留在身後了。
 *
 * 整層 aria-hidden:它沒有一個字是資訊,全部是布景。
 */
export function ForegroundStage({ active, reduced }: ForegroundStageProps) {
  const [live, setLive] = useState<ChapterId | null>(reduced ? active : null);
  const [retiring, setRetiring] = useState<ChapterId | null>(null);

  // live 刻意落後 active 一格。同一格裡掛上又標成 live,瀏覽器沒有起點可以補間,
  // 東西會直接出現在定位上 —— 那就沒有進場可言了。
  //
  // 判斷寫成「比對 state」而不是「記在 ref 裡的上一個值」:開發模式會把 effect
  // 跑兩次,ref 在第一次就被寫成新值,第二次就以為沒事發生,近景從此不出場。
  useEffect(() => {
    if (live === active) return;
    const frame = requestAnimationFrame(() => setLive(active));
    return () => cancelAnimationFrame(frame);
  }, [active, live]);

  // 舊的那組留一下再走。同樣用 effect 之間的比對,重跑一次不會多留一組。
  const leaving = useRef<ChapterId | null>(reduced ? active : null);
  useEffect(() => {
    const prev = leaving.current;
    leaving.current = live;
    if (reduced || prev === null || live === null || prev === live) return;

    setRetiring(prev);
    const timer = window.setTimeout(() => setRetiring(null), RETIRE_MS);
    return () => clearTimeout(timer);
  }, [live, reduced]);

  const shown: ChapterId[] = [];
  if (retiring !== null && retiring !== live) shown.push(retiring);
  if (live !== null) shown.push(live);

  return (
    <div className={styles.stage} aria-hidden="true" data-testid="foreground-stage">
      {shown.map((chapter) => (
        <div
          key={chapter}
          className={
            chapter === live ? `${styles.set} ${styles.active}` : `${styles.set} ${styles.retiring}`
          }
          data-fg-set={chapter}
        >
          {STAGES[chapter].map((piece) => {
            const a = worldAsset(piece.asset);
            return (
              <span
                key={piece.asset}
                className={`${styles.piece} ${styles[piece.slot] ?? ''}`}
                data-fg-in={piece.enter}
              >
                <img
                  src={a.file}
                  alt=""
                  width={a.width}
                  height={a.height}
                  loading="lazy"
                  decoding="async"
                />
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
