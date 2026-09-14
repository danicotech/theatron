'use client';

import { useEffect, useRef, useState } from 'react';

import type { StopId } from './acts';
import { stageFor } from './foreground';
import styles from './ForegroundStage.module.css';
import { findWorldAsset } from './world';

/** 退場的時間。比進場短 —— 讓位要快,站上來可以慢。 */
const RETIRE_MS = 780;

export interface ForegroundStageProps {
  /** 現在停在哪個定格點。沒停在任何一個時近景全部退場。 */
  held: StopId | null;
  reduced: boolean;
}

/**
 * 近景層:站在鏡頭與文字之間的那幾件去背素材。
 *
 * 它固定貼著視窗底緣,不隨頁面捲動。理由是 kage 的那條:跟著文件捲的近景會被
 * 讀成「印在紙上的插圖」,只有釘在畫面上的才像是站在鏡頭前面的東西。所以每一件
 * 都從底緣量起,只有左右之分,沒有上下。
 *
 * 擺位由帳冊的 `side` 決定,尺寸由 `asset` 決定 —— 兩件事分開,是因為同一件素材
 * 會在不同場次站不同邊(梅枝在木牆那一場從上角伸入),而它的大小不該跟著變。
 *
 * 一個定格點只掛一組。換場時舊的那組留一下再走 —— 直接抽掉會看到東西憑空消失,
 * 淡出加模糊則像是鏡頭往前走、把它留在身後了。
 *
 * 整層 aria-hidden:它沒有一個字是資訊,全部是布景。
 */
export function ForegroundStage({ held, reduced }: ForegroundStageProps) {
  const [live, setLive] = useState<StopId | null>(reduced ? held : null);
  const [retiring, setRetiring] = useState<StopId | null>(null);

  // live 刻意落後 held 一格。同一格裡掛上又標成 live,瀏覽器沒有起點可以補間,
  // 東西會直接出現在定位上 —— 那就沒有進場可言了。
  //
  // 判斷寫成「比對 state」而不是「記在 ref 裡的上一個值」:開發模式會把 effect
  // 跑兩次,ref 在第一次就被寫成新值,第二次就以為沒事發生,近景從此不出場。
  useEffect(() => {
    if (live === held) return;
    const frame = requestAnimationFrame(() => setLive(held));
    return () => cancelAnimationFrame(frame);
  }, [held, live]);

  // 舊的那組留一下再走。同樣用 effect 之間的比對,重跑一次不會多留一組。
  const leaving = useRef<StopId | null>(reduced ? held : null);
  useEffect(() => {
    const prev = leaving.current;
    leaving.current = live;
    if (reduced || prev === null || live === null || prev === live) return;

    setRetiring(prev);
    const timer = window.setTimeout(() => setRetiring(null), RETIRE_MS);
    return () => clearTimeout(timer);
  }, [live, reduced]);

  const shown: StopId[] = [];
  if (retiring !== null && retiring !== live) shown.push(retiring);
  if (live !== null) shown.push(live);

  return (
    <div className={styles.stage} aria-hidden="true" data-testid="foreground-stage">
      {shown.map((stop) => {
        const set = stageFor(stop);
        if (set === undefined) return null;
        return (
          <div
            key={stop}
            className={
              stop === live ? `${styles.set} ${styles.active}` : `${styles.set} ${styles.retiring}`
            }
            data-fg-set={stop}
          >
            {set.pieces.map((piece) => {
              // 帳冊列的比 design/ 交出來的多。缺的那一件就不放 —— 不頂替。
              const a = findWorldAsset(piece.asset);
              if (a === undefined) return null;
              return (
                <span
                  key={`${piece.asset}-${piece.side}`}
                  className={styles.piece}
                  data-fg-in={piece.from}
                  data-fg-side={piece.side}
                  data-fg-asset={piece.asset}
                  data-fg-sways={piece.sways === true ? '' : undefined}
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
        );
      })}
    </div>
  );
}
