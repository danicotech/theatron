'use client';

import { ConnectError } from '@connectrpc/connect';
import { Button, RankSigil } from '@theatron/ui';
import { useCallback, useEffect, useState } from 'react';

import { activityApi } from '../../lib/api/activity';
import type { Player, RankInfo } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { Rank } from '../../lib/api/gen/hestia/activity/v1/common_pb';

import styles from './DrawPanel.module.css';

/**
 * 抽籤。系統隨機排,裁判可以整體重抽或交換兩個人的籤位,確認後鎖定。
 *
 * 借的是抽籤箱與號碼牌:籤位編號、名字落位。**確認是不可逆的**,
 * 所以那顆按鈕與「重抽」在視覺上分得很開,而且要二次確認 ——
 * 確認之後對戰表就公布出去了,改不回來。
 */

export interface DrawPanelProps {
  slug: string;
  ranks: RankInfo[];
  /** 確認完成後通知外面重新讀賽事(階段會前進)。 */
  onConfirmed: () => void;
}

function rankLevel(ranks: RankInfo[], rank: Rank): number {
  const i = ranks.findIndex((r) => r.rank === rank);
  return i < 0 ? 0 : i + 1;
}

function rankName(ranks: RankInfo[], rank: Rank): string {
  return ranks.find((r) => r.rank === rank)?.name ?? '';
}

export function DrawPanel({ slug, ranks, onConfirmed }: DrawPanelProps) {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [seed, setSeed] = useState<bigint | null>(null);
  const [byes, setByes] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<'draw' | 'swap' | 'confirm' | null>(null);
  const [confirming, setConfirming] = useState(false);

  const reload = useCallback(async () => {
    const res = await activityApi.tournament.listPlayers({ tournamentSlug: slug });
    setPlayers(res.players.filter((p) => p.seedNo > 0).sort((a, b) => a.seedNo - b.seedNo));
  }, [slug]);

  useEffect(() => {
    void reload().catch((err: unknown) => {
      setError(ConnectError.from(err).message);
    });
  }, [reload]);

  async function run(what: 'draw' | 'swap' | 'confirm', fn: () => Promise<void>) {
    if (pending !== null) return;
    setPending(what);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(ConnectError.from(err).message);
    } finally {
      setPending(null);
    }
  }

  const drawn = players !== null && players.length > 0;

  return (
    <div className={styles.panel}>
      <div className={styles.actions}>
        <Button
          loading={pending === 'draw'}
          onClick={() => {
            void run('draw', async () => {
              const res = await activityApi.judge.drawBracket({ tournamentSlug: slug, seed: 0n });
              setSeed(res.seed);
              setByes(new Set(res.byePlayerPublicIds));
              setSelected([]);
              setConfirming(false);
              await reload();
            });
          }}
        >
          {drawn ? '重抽' : '抽籤'}
        </Button>
        {seed === null ? null : (
          <p className={styles.seed}>
            種子 <span className={styles.mono}>{seed.toString()}</span>
            <span className={styles.seedNote}>
              同一個種子會排出同一張表,可以拿來向人證明沒有動手腳。
            </span>
          </p>
        )}
      </div>

      {players === null ? (
        <p className={styles.hint}>讀取籤位…</p>
      ) : !drawn ? (
        <p className={styles.hint}>還沒抽。按上面的「抽籤」排出這一屆的對戰表。</p>
      ) : (
        <>
          <p className={styles.swapHint}>
            {selected.length === 0
              ? '要交換籤位就點兩位選手。'
              : selected.length === 1
                ? '再點一位就交換。'
                : '交換中…'}
          </p>

          <ol className={styles.seats}>
            {players.map((p) => {
              const on = selected.includes(p.publicId);
              return (
                <li key={p.publicId}>
                  <button
                    type="button"
                    className={[styles.seat, on ? styles.selected : ''].join(' ')}
                    aria-pressed={on}
                    disabled={pending !== null}
                    onClick={() => {
                      const next = on
                        ? selected.filter((id) => id !== p.publicId)
                        : [...selected, p.publicId];
                      if (next.length < 2) {
                        setSelected(next);
                        return;
                      }
                      setSelected([]);
                      void run('swap', async () => {
                        await activityApi.judge.swapSeeds({
                          playerAPublicId: next[0] ?? '',
                          playerBPublicId: next[1] ?? '',
                          note: '裁判於抽籤階段交換籤位',
                        });
                        await reload();
                      });
                    }}
                  >
                    <span className={styles.seatNo}>{p.seedNo}</span>
                    <span className={styles.seatName}>{p.displayName}</span>
                    <RankSigil
                      level={rankLevel(ranks, p.rank)}
                      total={ranks.length}
                      name={rankName(ranks, p.rank)}
                      size="sm"
                    />
                    {byes.has(p.publicId) ? <span className={styles.bye}>輪空</span> : null}
                  </button>
                </li>
              );
            })}
          </ol>

          {error === null ? null : (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <div className={styles.confirm}>
            {confirming ? (
              <>
                <p className={styles.confirmAsk}>
                  確認之後對戰表就定了,不能再重抽或交換,而且會直接公布出去。
                </p>
                <div className={styles.confirmRow}>
                  <Button
                    variant="danger"
                    size="lg"
                    loading={pending === 'confirm'}
                    onClick={() => {
                      void run('confirm', async () => {
                        await activityApi.judge.confirmBracket({
                          tournamentSlug: slug,
                          confirm: true,
                        });
                        onConfirmed();
                      });
                    }}
                  >
                    確認這張對戰表
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => {
                      setConfirming(false);
                    }}
                  >
                    再看看
                  </Button>
                </div>
              </>
            ) : (
              <Button
                variant="danger"
                size="lg"
                onClick={() => {
                  setConfirming(true);
                }}
              >
                確認對戰表
              </Button>
            )}
          </div>
        </>
      )}

      {error === null || drawn ? null : (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
