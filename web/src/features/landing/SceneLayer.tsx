'use client';

import { useEffect, useRef, useState } from 'react';

import { chapterAfter, type ChapterId, type ScenePlate } from './chapters';
import styles from './SceneLayer.module.css';
import { useParallax } from './useParallax';
import { worldAsset } from './world';

export interface SceneLayerProps {
  /** 章節帳冊裡的場景表。3D 接手時換掉這個元件,這個 prop 就是接縫。 */
  plates: readonly ScenePlate[];
  active: ChapterId;
  reduced: boolean;
}

/**
 * 固定在整個視窗後面的環境層。
 *
 * kage 那一層是即時算出來的 WebGL 場景;在純 2D 這一版是四張背景板互相淡入淡出。
 * 對觀眾來說差別只在「它不會隨鏡頭轉」,所以補一個很慢的視差 —— 整頁捲到底
 * 也只走 4vh。動得比讀字的速度慢,眼睛才會把它當成遠景而不是另一塊在捲的內容。
 *
 * 板子是**看過才掛**,外加預先掛下一章的那張:全部一次載是 890KB,而第一屏
 * 只需要夜院那一張;但等到切章才開始下載,交叉淡出會淡到一塊空白上。
 */
export function SceneLayer({ plates, active, reduced }: SceneLayerProps) {
  const host = useRef<HTMLDivElement>(null);
  useParallax(host, reduced);

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
    <div className={styles.scene} ref={host} aria-hidden="true">
      {plates.map((p) => {
        const bg = worldAsset(p.plate);
        const live = p.chapter === active;
        if (!live && !mounted.includes(p.chapter)) return null;
        return (
          <div key={p.chapter} className={live ? `${styles.plate} ${styles.live}` : styles.plate}>
            <img
              className={styles.art}
              src={bg.file}
              alt=""
              width={bg.width}
              height={bg.height}
              decoding="async"
              {...(p.chapter === '00' ? {} : { loading: 'lazy' as const })}
              fetchPriority={live ? 'high' : 'low'}
            />
            {p.fx?.map((fx) => {
              const a = worldAsset(fx.asset);
              return (
                <img
                  key={fx.asset}
                  className={`${styles.fx} ${styles[fx.role]}`}
                  src={a.file}
                  alt=""
                  width={a.width}
                  height={a.height}
                  loading="lazy"
                  decoding="async"
                />
              );
            })}
          </div>
        );
      })}
      <div className={styles.scrim} />
    </div>
  );
}
