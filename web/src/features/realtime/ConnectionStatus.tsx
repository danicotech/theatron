'use client';
import { Button } from '@theatron/ui';
import { tournamentRealtime, type TournamentSnapshot } from './tournamentRealtime';

export function ConnectionStatus({ slug, state }: { slug: string; state: TournamentSnapshot }) {
  const label =
    state.status === 'ready'
      ? '已同步'
      : state.status === 'connecting'
        ? '正在連線…'
        : state.status === 'syncing'
          ? '正在同步賽事資料…'
          : state.status === 'reconnecting'
            ? '連線中斷，正在重新同步；暫停送出。'
            : (state.error ?? '賽事資料讀取失敗');
  return (
    <div>
      <p role="status" aria-live="polite">
        {label}
      </p>
      {state.status === 'error' ? (
        <Button onClick={() => tournamentRealtime(slug).reconnect()}>重新連線</Button>
      ) : null}
    </div>
  );
}
