'use client';

import { useEffect, useRef, useState } from 'react';

import { STOP_IDS, type StopId } from './acts';
import styles from './SceneLayer.module.css';
import { useParallax } from './useParallax';
import { worldAsset } from './world';

/**
 * 沒有 WebGL、或使用者要求減少動態時的環境層。
 *
 * 3D 那一層是即時算出來的世界;這一層是它的降級路徑 —— 四張場景板互相淡入淡出。
 * 對觀眾來說差別只在「它不會隨鏡頭轉」,所以補一個很慢的視差:整頁捲到底也只走
 * 4vh。動得比讀字的速度慢,眼睛才會把它當成遠景,而不是另一塊在捲的內容。
 * (不想看到動的人連這個都沒有 —— useParallax 自己會關掉。)
 *
 * 序幕不在這裡:那一章有自己的靜態殘旗海報(StaticPoster),因為它要畫的是
 * 一個**事件**(旗被劃破),不是一個地方。
 *
 * 板子用 `plate-*`,那是 design/jianzhong 為這一版生的六張,色盤對得上。
 * 百業那一批雪景背景是另一個世界,不拿來頂替。
 */

/**
 * 哪一個定格點站在哪一張板子前面。
 *
 * 前兩幕是布幕的事(對劍、噴墨、劃破),它們有自己的靜態海報,不吃場景板;
 * 第三幕的四個場次各有一張專門為它生的板子。
 * `plate-approach`(半塌迴廊)留給第三幕的入場,在 format 之前。
 */
const PLATES: Readonly<Record<StopId, string | null>> = {
  prologue: null,
  challenge: null,
  format: 'plate-gate',
  prize: 'plate-hall',
  schedule: 'plate-wall',
  signup: 'plate-door',
};

/** 下一個定格點。先掛起來,交叉淡出才不會淡到一塊空白上。 */
function stopAfter(id: StopId): StopId | undefined {
  const i = STOP_IDS.indexOf(id);
  return i < 0 ? undefined : STOP_IDS[i + 1];
}

export interface SceneLayerProps {
  held: StopId | null;
  reduced: boolean;
}

export function SceneLayer({ held, reduced }: SceneLayerProps) {
  const host = useRef<HTMLDivElement>(null);
  useParallax(host, reduced);

  // 看過才掛,外加預先掛下一個定格點的那張:全部一次載是將近八百 KB,而第一屏
  // 一張都不需要;但等到切過去才開始下載,交叉淡出會淡到一塊空白上。
  const next = held === null ? undefined : stopAfter(held);
  const [mounted, setMounted] = useState<readonly StopId[]>([]);

  useEffect(() => {
    setMounted((m) => {
      const add = [held, next].filter(
        (id): id is StopId => id !== null && id !== undefined && !m.includes(id),
      );
      return add.length === 0 ? m : [...m, ...add];
    });
  }, [held, next]);

  return (
    <div className={styles.scene} ref={host} aria-hidden="true" data-testid="scene-layer">
      {mounted.map((stop) => {
        const id = PLATES[stop];
        if (id === null) return null;
        const bg = worldAsset(id);
        const live = stop === held;
        return (
          <div
            key={stop}
            className={live ? `${styles.plate} ${styles.live}` : styles.plate}
            data-plate-for={stop}
          >
            <img
              className={styles.art}
              src={bg.file}
              alt=""
              width={bg.width}
              height={bg.height}
              decoding="async"
              loading="lazy"
              fetchPriority={live ? 'high' : 'low'}
            />
          </div>
        );
      })}
      <div className={styles.scrim} />
    </div>
  );
}
