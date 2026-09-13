'use client';

import { ConnectError } from '@connectrpc/connect';
import { BracketTree } from '@theatron/ui';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { activityApi } from '../../lib/api/activity';
import type { Match, RankInfo, Tournament } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { usePolling } from '../../lib/api/poll';

import { activeRound, toBracketRounds, winsNeeded } from './bracketView';

import styles from './BracketPage.module.css';

/**
 * 公開的對戰表。
 *
 * 看的人比打的人多,所以這一頁不要求登入、也不放任何操作 —— 它就是貼在牆上的
 * 那張對戰表,只是會自己更新。賽制與段位定義逐屆可調,一律跟伺服器要;
 * 對戰表本身每 10 秒重讀一次,對戰表不是秒級變動的東西,更頻繁只是在打伺服器。
 */

export interface BracketPageProps {
  slug: string;
}

const POLL_MS = 10_000;

export function BracketPage({ slug }: BracketPageProps) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [ranks, setRanks] = useState<RankInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [t, r] = await Promise.all([
          activityApi.tournament.getTournament({ slug }),
          activityApi.tournament.listRanks({ tournamentSlug: slug }),
        ]);
        setTournament(t.tournament ?? null);
        setRanks(r.ranks);
      } catch (err) {
        setError(ConnectError.from(err).message);
      }
    })();
  }, [slug]);

  const load = useCallback(
    () => activityApi.tournament.getBracket({ tournamentSlug: slug }),
    [slug],
  );
  const bracket = usePolling(load, POLL_MS);

  const hrefFor = useCallback((m: Match) => `/t/${slug}/m/${m.publicId}`, [slug]);
  const rounds = useMemo(
    () =>
      bracket.data === null
        ? []
        : toBracketRounds(bracket.data.rounds, bracket.data.players, {
            ranks,
            hrefFor,
            bestOf: tournament?.bestOf,
          }),
    [bracket.data, ranks, hrefFor, tournament?.bestOf],
  );
  const defaultRound = useMemo(
    () => (bracket.data === null ? undefined : activeRound(bracket.data.rounds)),
    [bracket.data],
  );

  if (error !== null && tournament === null) {
    return (
      <p className={styles.error} role="alert">
        {error}
      </p>
    );
  }
  if (tournament === null) {
    return <p className={styles.loading}>讀取賽事…</p>;
  }

  const bestOf = Math.max(tournament.bestOf, 1);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>百業試鋒 · 對戰表</p>
        <h1 className={styles.title}>{tournament.name}</h1>
        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>賽制</dt>
            <dd className={styles.mono}>
              {bestOf > 1 ? `${bestOf} 局 ${winsNeeded(bestOf)} 勝` : '單場定勝負'}
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>季軍戰</dt>
            <dd>{tournament.thirdPlaceMatch ? '有' : '無'}</dd>
          </div>
          <div className={styles.fact}>
            <dt>參賽</dt>
            <dd className={styles.mono}>{tournament.playerCount} 人</dd>
          </div>
        </dl>
      </header>

      {bracket.data === null ? (
        bracket.error === null ? (
          <p className={styles.loading}>讀取對戰表…</p>
        ) : (
          <p className={styles.error} role="alert">
            {bracket.error}
          </p>
        )
      ) : bracket.data.bracketPublished ? (
        <section className={styles.tree} aria-labelledby="tree">
          {/* 樹裡每一輪是 h3,這一層要有 h2 才不會跳級。 */}
          <h2 className={styles.h2} id="tree">
            晉級樹
          </h2>
          {/* 舊資料還在畫面上,更新失敗只是提醒,不蓋掉整張表。 */}
          {bracket.error === null ? null : (
            <p className={styles.stale} role="status">
              更新失敗,顯示的是上一次讀到的對戰表。會再試。
            </p>
          )}
          <BracketTree rounds={rounds} defaultRound={defaultRound} />
        </section>
      ) : (
        <section className={styles.empty} aria-label="對戰表還沒公布">
          <p className={styles.emptyLine}>對戰表還沒公布。</p>
          <p className={styles.emptyNote}>
            裁判確認抽籤結果的那一刻,晉級樹會直接出現在這裡,不用重新整理。等的時候可以先看段位怎麼分、讓武能買什麼。
          </p>
        </section>
      )}

      <nav className={styles.links} aria-label="相關頁面">
        <Link className={styles.link} href={`/t/${slug}`}>
          回賽事首頁
        </Link>
        <Link className={styles.link} href={`/t/${slug}/rules`}>
          規則與讓武項目
        </Link>
      </nav>
    </div>
  );
}
