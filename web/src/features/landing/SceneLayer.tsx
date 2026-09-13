'use client';

import { useEffect, useRef, useState } from 'react';

import { chapterAfter, type ChapterId } from './chapters';
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

/** 哪一章站在哪一張板子前面。六張板子配六章,一章一張。 */
const PLATES: Readonly<Record<ChapterId, string | null>> = {
  // 序幕有自己的海報,不吃板子。
  '01': null,
  '02': 'plate-gate',
  '03': 'plate-hall',
  '04': 'plate-wall',
  '05': 'plate-plum',
  '06': 'plate-door',
  '07': 'plate-approach',
};

export interface SceneLayerProps {
  active: ChapterId;
  reduced: boolean;
}

export function SceneLayer({ active, reduced }: SceneLayerProps) {
  const host = useRef<HTMLDivElement>(null);
  useParallax(host, reduced);

  // 看過才掛,外加預先掛下一章的那張:全部一次載是將近八百 KB,而第一屏
  // 一張都不需要;但等到切章才開始下載,交叉淡出會淡到一塊空白上。
  const next = chapterAfter(active);
  const [mounted, setMounted] = useState<readonly ChapterId[]>(() =>
    next === undefined ? [active] : [active, next],
  );

  useEffect(() => {
    setMounted((m) => {
      const add = [active, next].filter(
        (id): id is ChapterId => id !== undefined && !m.includes(id),
      );
      return add.length === 0 ? m : [...m, ...add];
    });
  }, [active, next]);

  return (
    <div className={styles.scene} ref={host} aria-hidden="true" data-testid="scene-layer">
      {mounted.map((chapter) => {
        const id = PLATES[chapter];
        if (id === null) return null;
        const bg = worldAsset(id);
        const live = chapter === active;
        return (
          <div
            key={chapter}
            className={live ? `${styles.plate} ${styles.live}` : styles.plate}
            data-plate-for={chapter}
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
