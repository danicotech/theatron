'use client';

import { useCallback, useId } from 'react';
import { activityApi } from '../../lib/api/activity';
import { usePolling } from '../../lib/api/poll';
import { MarketBoard } from './MarketBoard';
import styles from './DuelBettingBridge.module.css';

/** Pick a real published match inside the betting window; never changes a wager itself. */
export function ArenaMarkets({
  slug,
  matchId,
  onMatch,
  selectedOutcome,
  returnTo,
}: {
  slug: string;
  matchId: string;
  onMatch: (id: string) => void;
  selectedOutcome?: 'p1' | 'p2' | undefined;
  returnTo: string;
}) {
  const id = useId();
  const load = useCallback(
    () => activityApi.tournament.getBracket({ tournamentSlug: slug }),
    [slug],
  );
  const { data, error, reload } = usePolling(load, 10_000);
  const matches = data?.rounds.flatMap((round) => round.matches) ?? [];
  const players = new Map(data?.players.map((player) => [player.publicId, player.displayName]));
  const selected = matches.find((match) => match.publicId === matchId);
  return (
    <section aria-label="選場下注">
      <label htmlFor={id} className={styles.matchLabel}>
        觀局場次
      </label>
      <select
        id={id}
        className={styles.matchSelect}
        value={matchId}
        onChange={(event) => onMatch(event.target.value)}
      >
        <option value="">選擇場次</option>
        {matches.map((match, index) => (
          <option key={match.publicId} value={match.publicId}>
            第 {index + 1} 場 · {players.get(match.p1PlayerPublicId) || '席位待定'} 對{' '}
            {players.get(match.p2PlayerPublicId) || '席位待定'}
          </option>
        ))}
      </select>
      {selected ? (
        <p className={styles.matchSummary}>
          {players.get(selected.p1PlayerPublicId) || '席位待定'} 對{' '}
          {players.get(selected.p2PlayerPublicId) || '席位待定'}
        </p>
      ) : null}
      {error ? (
        <p role="alert">
          場次讀取失敗。
          <button type="button" onClick={() => void reload()}>
            重新讀取
          </button>
        </p>
      ) : !data ? (
        <p role="status">讀取觀局場次…</p>
      ) : !matches.length ? (
        <p role="status">賽程尚未公布，開盤後即可在此選場下注。</p>
      ) : !matchId ? (
        <p role="status">請選擇觀局場次。</p>
      ) : null}
      {matchId && (!data || matches.some((match) => match.publicId === matchId)) ? (
        <MarketBoard
          key={matchId}
          slug={slug}
          matchPublicId={matchId}
          selectedOutcome={selectedOutcome}
          returnTo={returnTo}
        />
      ) : null}
      {data && matchId && !matches.some((match) => match.publicId === matchId) ? (
        <p role="status">此場次已不在公開賽程，請重新選擇。</p>
      ) : null}
    </section>
  );
}
