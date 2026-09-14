'use client';

import { ConnectError } from '@connectrpc/connect';
import { BracketTree, ChapterHead, InkLink, InkTitle, PaperCard, SectionHead } from '@theatron/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { activityApi } from '../../lib/api/activity';
import type { Match, RankInfo, Tournament } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { usePolling } from '../../lib/api/poll';
import { inkMark } from '../tournament/inkMarks';

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

const SCHEDULE_MARK = inkMark('ink-schedule');

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
      <ChapterHead
        number="貳"
        eyebrow="百業試鋒 · 對戰表"
        title={tournament.name}
        facts={[
          {
            label: '賽制',
            value: bestOf > 1 ? `${bestOf} 局 ${winsNeeded(bestOf)} 勝` : '單場定勝負',
            mono: true,
          },
          { label: '季軍戰', value: tournament.thirdPlaceMatch ? '有' : '無' },
          { label: '參賽', value: `${tournament.playerCount} 人`, mono: true },
        ]}
        aside={<InkTitle {...SCHEDULE_MARK} size="mark" />}
      />

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
          <SectionHead id="tree" en="THE BRACKET">
            晉級樹
          </SectionHead>
          {/* 舊資料還在畫面上,更新失敗只是提醒,不蓋掉整張表。 */}
          {bracket.error === null ? null : (
            <p className={styles.stale} role="status">
              更新失敗,顯示的是上一次讀到的對戰表。會再試。
            </p>
          )}
          <BracketTree rounds={rounds} defaultRound={defaultRound} />
        </section>
      ) : (
        // 空狀態是邀請,不是道歉 —— 而在這個世界裡,「還沒公布」本身就是一張告示。
        // 這一張沒有印:印是最後蓋的,而抽籤還沒定下來。
        <section className={styles.empty} aria-label="對戰表還沒公布">
          <PaperCard
            kicker="江湖令"
            index="BRACKET / PENDING"
            headingLevel={2}
            title="對戰表還沒公布。"
            note="裁判確認抽籤結果的那一刻,晉級樹會直接出現在這裡,不用重新整理。等的時候可以先看段位怎麼分、讓武能買什麼。"
            tilt="left"
          />
        </section>
      )}

      <nav className={styles.links} aria-label="相關頁面">
        <InkLink href={`/t/${slug}`}>回賽事首頁</InkLink>
        <InkLink href={`/t/${slug}/rules`}>規則與讓武項目</InkLink>
      </nav>
    </div>
  );
}
