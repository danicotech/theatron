'use client';

import { ConnectError } from '@connectrpc/connect';
import { Button, RankSigil } from '@theatron/ui';
import { useEffect, useState } from 'react';

import { activityApi } from '../../lib/api/activity';
import type { RankInfo } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { Rank } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import type { PlayerDossier } from '../../lib/api/gen/hestia/activity/v1/judge_pb';

import styles from './RankingPanel.module.css';

/**
 * 評段。裁判逐人看資料、給一個段位。
 *
 * 段位名稱**跟伺服器要**(ListRanks),不在前端寫死中文 —— 措辭存在
 * tournaments.config,逐屆可調(見 RankInfo 的 proto 註解)。
 *
 * 一次只評一個人:這一步的成本不在點擊次數,在判斷。把十個人排成一排
 * 讓人快速點完,只會讓評段變成填表。
 */

export interface RankingPanelProps {
  slug: string;
  ranks: RankInfo[];
  /** 評完一位就通知外面,讓總覽的人數跟著更新。 */
  onRanked: () => void;
}

function rankOf(ranks: RankInfo[], rank: Rank): RankInfo | undefined {
  return ranks.find((r) => r.rank === rank);
}

function rankLevel(ranks: RankInfo[], rank: Rank): number {
  const i = ranks.findIndex((r) => r.rank === rank);
  return i < 0 ? 0 : i + 1;
}

export function RankingPanel({ slug, ranks, onRanked }: RankingPanelProps) {
  const [players, setPlayers] = useState<PlayerDossier[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState('');
  const [picked, setPicked] = useState<Rank | null>(null);

  const current = players?.[0];

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await activityApi.judge.listUnranked({ tournamentSlug: slug });
        if (alive) setPlayers(res.players);
      } catch (err) {
        if (alive) setError(ConnectError.from(err).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  async function assign() {
    if (current === undefined || picked === null || pending) return;
    setPending(true);
    setError(null);
    try {
      await activityApi.judge.assignRank({
        playerPublicId: current.player?.publicId ?? '',
        rank: picked,
        note: note.trim(),
      });
      setPlayers((prev) => (prev === null ? prev : prev.slice(1)));
      setPicked(null);
      setNote('');
      onRanked();
    } catch (err) {
      setError(ConnectError.from(err).message);
    } finally {
      setPending(false);
    }
  }

  if (error !== null && players === null) {
    return (
      <p className={styles.error} role="alert">
        {error}
      </p>
    );
  }

  if (players === null) {
    return <p className={styles.loading}>讀取待評選手…</p>;
  }

  if (current === undefined) {
    return (
      <div className={styles.done}>
        <p className={styles.doneLine}>所有選手都評完了。</p>
        <p className={styles.doneNote}>
          接下來公布段位。公布之後、抽籤之前是留給異議的時間 —— 段位一旦進了抽籤就不能再改。
        </p>
      </div>
    );
  }

  const p = current.player;
  const selfRated = rankOf(ranks, current.selfRatedRank);
  const previous = rankOf(ranks, current.previousRank);

  return (
    <div className={styles.panel}>
      <p className={styles.remaining}>
        還有 <span className={styles.count}>{players.length}</span> 人未評
      </p>

      <article className={styles.dossier} aria-label={`選手 ${p?.displayName ?? ''}`}>
        <header className={styles.head}>
          <h3 className={styles.name}>{p?.displayName}</h3>
          <span className={styles.gameId}>{p?.gameId}</span>
        </header>

        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>自評</dt>
            <dd>
              {selfRated === undefined ? (
                <span className={styles.blank}>未填</span>
              ) : (
                <RankSigil
                  level={rankLevel(ranks, current.selfRatedRank)}
                  total={ranks.length}
                  name={selfRated.name}
                  size="sm"
                />
              )}
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>往屆</dt>
            <dd>
              {previous === undefined ? (
                <span className={styles.blank}>初次參賽</span>
              ) : (
                <RankSigil
                  level={rankLevel(ranks, current.previousRank)}
                  total={ranks.length}
                  name={previous.name}
                  size="sm"
                />
              )}
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>論劍</dt>
            <dd className={styles.mono}>
              {current.ladderRank === '' ? (
                <span className={styles.blank}>未填</span>
              ) : (
                `${current.ladderRank} · ${current.ladderScore}`
              )}
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>歷屆戰績</dt>
            <dd className={styles.mono}>
              {current.tournamentsPlayed} 屆 · {current.wins}勝 {current.losses}敗
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>Discord</dt>
            <dd>{current.discordName}</dd>
          </div>
        </dl>

        {current.artsNote === '' ? null : (
          <div className={styles.prose}>
            <span className={styles.proseLabel}>常用武學 / PVP 經驗</span>
            <p>{current.artsNote}</p>
          </div>
        )}
        {current.availabilityNote === '' ? null : (
          <div className={styles.prose}>
            <span className={styles.proseLabel}>可出賽時段 / 備註</span>
            <p>{current.availabilityNote}</p>
          </div>
        )}
      </article>

      <fieldset className={styles.pick} disabled={pending}>
        <legend className={styles.pickLegend}>評定段位</legend>
        <div className={styles.options}>
          {ranks.map((r, i) => (
            <button
              key={r.rank}
              type="button"
              className={[styles.option, picked === r.rank ? styles.picked : ''].join(' ')}
              aria-pressed={picked === r.rank}
              onClick={() => {
                setPicked(r.rank);
              }}
            >
              <RankSigil level={i + 1} total={ranks.length} name={r.name} title={r.title} />
            </button>
          ))}
        </div>

        <label className={styles.noteLabel} htmlFor="rank-note">
          評定理由
        </label>
        <textarea
          className={styles.note}
          id="rank-note"
          rows={2}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
          }}
          placeholder="進稽核紀錄,也是日後有人不服氣時的依據"
        />
      </fieldset>

      {error === null ? null : (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Button
        size="lg"
        loading={pending}
        disabled={picked === null}
        onClick={() => {
          void assign();
        }}
      >
        {picked === null ? '先選一個段位' : `評為 ${rankOf(ranks, picked)?.name ?? ''}`}
      </Button>
    </div>
  );
}
