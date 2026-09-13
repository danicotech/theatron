'use client';

import { timestampMs, type Timestamp } from '@bufbuild/protobuf/wkt';
import { useEffect, useState } from 'react';

import styles from './RoundTimer.module.css';

/**
 * 進行中回合的計時。
 *
 * 伺服器不存倒數狀態,計時是衍生值:now() − started_at(MatchRound 的 proto 註解)。
 * 直播頁與裁判頁看的是同一個 started_at,所以兩邊的數字對得上,
 * 差的只有各自時鐘的誤差。
 *
 * 跳動的數字**不受** prefers-reduced-motion 影響 —— 那個偏好關的是裝飾動態,
 * 計時器變化是資訊本身,停住就是錯的。
 */

/** mm:ss。回合以分鐘計,沒有小時位;超過 99 分就讓它變三位數,不截斷。 */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function RoundTimer({ startedAt }: { startedAt: Timestamp }) {
  const start = timestampMs(startedAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [start]);

  const elapsed = Math.max(0, now - start);
  return (
    <time className={styles.timer} dateTime={`PT${Math.floor(elapsed / 1000)}S`}>
      {formatDuration(elapsed)}
    </time>
  );
}
