'use client';

import { ConnectError } from '@connectrpc/connect';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 定時重讀。
 *
 * 目前正式頁面的既有讀取方式，尚未接上 WatchService 串流。
 * 2026-10-12 使用者要求所有正式賽事變更即時同步；切換後端環境後遷移，
 * 接入位置及驗收見 docs/REALTIME_INTEGRATION.md。輪詢不是最終同步方案。
 * 分頁不在前景時停下來 —— 一個掛在背景的對戰表不該每幾秒打一次伺服器。
 *
 * `load` 要用 useCallback 包住,不然每次 render 都會重新開始計時。
 */
export interface Polled<T> {
  data: T | null;
  /** 最近一次失敗的訊息;成功一次就清掉。 */
  error: string | null;
  /** 立刻重讀一次(例如自己剛做了一個動作)。 */
  reload: () => Promise<void>;
}

export function usePolling<T>(load: () => Promise<T>, intervalMs: number): Polled<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 卸載後不再 setState;輪詢的回應可能在離開頁面之後才到。
  const alive = useRef(true);

  const reload = useCallback(async () => {
    try {
      const next = await load();
      if (!alive.current) return;
      setData(next);
      setError(null);
    } catch (err) {
      if (!alive.current) return;
      setError(ConnectError.from(err).message);
    }
  }, [load]);

  useEffect(() => {
    alive.current = true;
    void reload();
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void reload();
    };
    const id = setInterval(tick, intervalMs);
    // 回到前景時馬上補一次,不用等下一個 tick。
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive.current = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload, intervalMs]);

  return { data, error, reload };
}
