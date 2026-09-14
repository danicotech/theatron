'use client';

import { useRef, type CSSProperties } from 'react';
import { SealStamp } from '@theatron/ui';

import { CONTENT, isPlaceholder, TBA } from '../content';
import { usePrefersReducedMotion } from '../usePrefersReducedMotion';
import { useEnterState } from '../useEnterState';
import styles from './PrizeWall.module.css';

/** 名次的印面字。超過這些就用序號 —— 不編第八名叫什麼。 */
const RANK_SEALS = ['首座', '次座', '三座', '入圍'];

/**
 * 第四章〈朱印〉:紅印逐一蓋上剝漆的木牆,一顆印是一項獎賞。
 *
 * 「逐一」是編排,不是內容:清單本身是一份完整的 `<ol>`,伺服器端就畫好了。
 * 沒有 JS 的人看到的是四顆已經蓋好的印,少的只是蓋下去那一下。
 *
 * 蓋印的動作刻意做成**先大、砸下、彈一下、暈開**四拍,而不是淡入:
 * 印章是被壓上去的,壓的力道是它跟貼紙的差別。每顆之間隔一拍,
 * 所以讀起來是有人一顆一顆蓋,不是四顆同時出現。
 */
export function PrizeWall() {
  const host = useRef<HTMLOListElement>(null);
  const state = useEnterState(host, usePrefersReducedMotion());

  const empty = CONTENT.prizes.every(isPlaceholder);
  const prizes = empty ? [TBA] : CONTENT.prizes;

  return (
    <ol className={styles.wall} ref={host} data-state={state} data-testid="prize-wall">
      {prizes.map((prize, i) => (
        <li
          className={styles.row}
          key={`${prize}-${i}`}
          style={{ '--stamp-index': i } as CSSProperties}
        >
          <span className={styles.stamp}>
            <SealStamp text={RANK_SEALS[i] ?? String(i + 1)} />
          </span>
          <span className={styles.detail}>
            <b className={styles.rank}>{RANK_SEALS[i] ?? `第 ${i + 1} 名`}</b>
            <span className={styles.award}>{prize}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
