'use client';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { ConnectError } from '@connectrpc/connect';
import { ChapterHead, InkLink, RankSigil, SectionHead } from '@theatron/ui';
import { useCallback, useEffect, useState } from 'react';

import { activityApi } from '../../lib/api/activity';
import type {
  Match,
  MatchRound,
  Player,
  RankInfo,
  Tournament,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';
import {
  MatchKind,
  MatchResultKind,
  MatchStatus,
  Rank,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { usePolling } from '../../lib/api/poll';
import { MarketBoard } from '../betting';

import { currentRoundNo, RANK_TOTAL, rankLevel, rankName, winsNeeded } from './bracketView';
import { HandicapNotice } from './HandicapNotice';
import { formatDuration, RoundTimer } from './RoundTimer';

import styles from './MatchPage.module.css';

/**
 * 一場比賽的公開頁。
 *
 * 觀眾在這裡看三件事:誰對誰(以及誰有多少 BP)、打到哪了、封盤後的讓武內容。
 * 場次狀態 5 秒重讀一次 —— 回合開始與結束是這一頁最需要即時的事,
 * 但秒數本身不靠輪詢,由 RoundTimer 用 started_at 自己算。
 * 讓武公示 10 秒重讀:封盤是一次性事件,封盤後內容只有裁判代退才會變。
 */

export interface MatchPageProps {
  slug: string;
  matchId: string;
  selectedPlayerId?: string;
}

const MATCH_POLL_MS = 5_000;
const HANDICAP_POLL_MS = 10_000;

export function MatchPage(props: MatchPageProps) {
  // A route change starts a new set of polling requests. Old responses must not
  // replace the selected match or retain the previous activity's format.
  return <MatchContent key={`${props.slug}:${props.matchId}`} {...props} />;
}

function MatchContent({ slug, matchId, selectedPlayerId = '' }: MatchPageProps) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [ranks, setRanks] = useState<RankInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const request = new AbortController();
    void (async () => {
      try {
        const [t, r] = await Promise.all([
          activityApi.tournament.getTournament({ slug }, { signal: request.signal }),
          activityApi.tournament.listRanks({ tournamentSlug: slug }, { signal: request.signal }),
        ]);
        if (request.signal.aborted) return;
        setTournament(t.tournament ?? null);
        setRanks(r.ranks);
      } catch (err) {
        if (!request.signal.aborted) setError(ConnectError.from(err).message);
      }
    })();
    return () => request.abort();
  }, [slug]);

  const loadMatch = useCallback(
    () => activityApi.tournament.getMatch({ matchPublicId: matchId }),
    [matchId],
  );
  const match = usePolling(loadMatch, MATCH_POLL_MS);

  const loadHandicaps = useCallback(
    () => activityApi.handicap.getMatchHandicaps({ matchPublicId: matchId }),
    [matchId],
  );
  const handicaps = usePolling(loadHandicaps, HANDICAP_POLL_MS);
  const loadedMatchId = match.data?.match?.publicId;
  useEffect(() => {
    // The anchor is created after the public match request; honor the initial deep link then.
    if (loadedMatchId && window.location.hash === '#markets') {
      document.getElementById('markets')?.scrollIntoView?.({ block: 'start' });
    }
  }, [loadedMatchId]);

  if (match.data === null) {
    const msg = match.error ?? error;
    if (msg !== null) {
      return (
        <p className={styles.error} role="alert">
          {msg}
        </p>
      );
    }
    return <p className={styles.loading}>讀取場次…</p>;
  }

  const m = match.data.match;
  if (m === undefined) {
    return (
      <p className={styles.error} role="alert">
        這一場不存在。
      </p>
    );
  }

  const p1 = match.data.p1;
  const p2 = match.data.p2;
  const selectedPlayer = [p1, p2].find(
    (player) =>
      player?.publicId === selectedPlayerId &&
      selectedPlayerId !== '' &&
      (selectedPlayerId === m.p1PlayerPublicId || selectedPlayerId === m.p2PlayerPublicId),
  );
  const budget = match.data.handicapBudget;
  const holderId = match.data.handicapHolderPublicId;
  const holder = p1?.publicId === holderId ? p1 : p2?.publicId === holderId ? p2 : undefined;
  const constrained = holder === undefined ? undefined : holder === p1 ? p2 : p1;
  const live = m.status === MatchStatus.LIVE;
  const done = m.status === MatchStatus.DONE;
  const bestOf = Math.max(tournament?.bestOf ?? 1, 1);
  const third = m.kind === MatchKind.THIRD_PLACE;

  return (
    <div className={styles.page}>
      {/* 場次頁是對戰表(貳)底下的一頁,印記沿用。狀態行是 live region,放在引言的位置。 */}
      <ChapterHead
        number="貳"
        eyebrow="百業試鋒 · 對戰"
        title={third ? '季軍戰' : `第 ${m.round} 輪 · 第 ${m.slot + 1} 場`}
        lede={
          <span className={[styles.status, live ? styles.statusLive : ''].join(' ')} role="status">
            {live ? <span className={styles.liveDot} aria-hidden="true" /> : null}
            {statusCopy(m, budget, nameOf(m.winnerPlayerPublicId, p1, p2))}
          </span>
        }
      />

      {/* 記分板:對峙的左右構圖,中間是比分。名字是這一區唯一的大字。 */}
      <section className={styles.board} aria-label="對戰雙方">
        <Side
          player={p1}
          ranks={ranks}
          won={done && p1 !== undefined && m.winnerPlayerPublicId === p1.publicId}
          bp={holder !== undefined && holder === p1 ? budget : undefined}
          align="start"
        />
        <div className={styles.score}>
          <span className={styles.scoreLine}>
            <span>{m.p1RoundWins}</span>
            <span className={styles.colon}>:</span>
            <span>{m.p2RoundWins}</span>
          </span>
          {/* 賽制沒讀到就不寫:寫「單場定勝負」是在猜,猜錯比空著糟。 */}
          {tournament === null ? null : (
            <span className={styles.format}>
              {bestOf > 1 ? `${bestOf} 局 ${winsNeeded(bestOf)} 勝` : '單場定勝負'}
            </span>
          )}
        </div>
        <Side
          player={p2}
          ranks={ranks}
          won={done && p2 !== undefined && m.winnerPlayerPublicId === p2.publicId}
          bp={holder !== undefined && holder === p2 ? budget : undefined}
          align="end"
        />
        {budget === 0n ? <p className={styles.noHandicap}>同段對決,本場無讓武。</p> : null}
      </section>

      {/* 盤口緊接在對峙構圖之後:觀眾看完「誰對誰、誰有 BP」下一件事就是押誰。
          投注單在版面的另一欄(路由層放 BetSlip),這裡只有盤口。 */}
      <div id="markets" data-selected-player={selectedPlayer?.publicId}>
        {selectedPlayer === undefined ? null : (
          <p className={styles.note}>
            已選擇選手：<strong>{selectedPlayer.displayName}</strong>
            。請確認盤口，再加入投注單。
          </p>
        )}
        <MarketBoard
          slug={slug}
          matchPublicId={m.publicId}
          selectedOutcome={
            selectedPlayer === undefined
              ? undefined
              : selectedPlayer.publicId === m.p1PlayerPublicId
                ? 'p1'
                : 'p2'
          }
        />
      </div>

      {m.streamUrl === '' ? null : (
        <a
          className={[styles.stream, live ? styles.streamLive : ''].join(' ')}
          href={m.streamUrl}
          target="_blank"
          rel="noreferrer"
        >
          {live ? <span className={styles.liveDot} aria-hidden="true" /> : null}
          {live ? '直播中 · 看直播' : '看直播'}
        </a>
      )}

      <section className={styles.section} aria-labelledby="rounds">
        <SectionHead id="rounds" en="THE ROUNDS">
          回合
        </SectionHead>
        {m.rounds.length === 0 ? (
          <p className={styles.note}>
            {done
              ? '這一場沒有打過任何回合。'
              : '還沒開打。裁判按下「正式決鬥開始」後,每個回合的勝者與時長會記在這裡。'}
          </p>
        ) : (
          // 表格直角、數字等寬右對齊 —— 記分板借的是賠率單的對齊紀律。
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">回合</th>
                <th scope="col">勝者</th>
                <th scope="col" className={styles.numCol}>
                  時長
                </th>
              </tr>
            </thead>
            <tbody>
              {m.rounds.map((r) => (
                <RoundRow key={r.roundNo} round={r} p1={p1} p2={p2} />
              ))}
            </tbody>
          </table>
        )}
      </section>

      {budget === 0n || holder === undefined ? null : (
        <HandicapNotice
          handicaps={handicaps.data?.handicaps ?? null}
          error={handicaps.error}
          holderName={holder.displayName}
          constrainedName={constrained?.displayName ?? '對手'}
          budget={budget}
        />
      )}

      <nav className={styles.links} aria-label="相關頁面">
        <InkLink href={`/t/${slug}/bracket`}>回對戰表</InkLink>
        <InkLink href={`/t/${slug}/rules`}>規則與讓武項目</InkLink>
      </nav>
    </div>
  );
}

function Side({
  player,
  ranks,
  won,
  bp,
  align,
}: {
  player: Player | undefined;
  ranks: RankInfo[];
  won: boolean;
  /** 這一方持有的讓武 BP;不是持有方就不給。 */
  bp: bigint | undefined;
  align: 'start' | 'end';
}) {
  const classes = [styles.side, align === 'end' ? styles.sideEnd : ''];
  if (player === undefined) {
    // 空位不是錯誤,是「上一輪還沒打完」。
    return (
      <div className={[...classes, styles.pending].join(' ')}>
        <p className={styles.name}>待定</p>
      </div>
    );
  }
  if (won) classes.push(styles.won);
  return (
    <div className={classes.join(' ')}>
      <p className={styles.name}>{player.displayName}</p>
      <div className={styles.meta}>
        {player.rank === Rank.UNSPECIFIED ? null : (
          <RankSigil
            level={rankLevel(player.rank)}
            total={RANK_TOTAL}
            name={rankName(ranks, player.rank)}
            size="sm"
          />
        )}
        {player.seedNo > 0 ? <span className={styles.seed}>籤 {player.seedNo}</span> : null}
      </div>
      {bp === undefined ? null : <span className={styles.bp}>讓武 {bp.toString()} BP</span>}
    </div>
  );
}

function RoundRow({
  round,
  p1,
  p2,
}: {
  round: MatchRound;
  p1: Player | undefined;
  p2: Player | undefined;
}) {
  const finished = round.finishedAt;
  const open = finished === undefined;
  return (
    <tr>
      <th scope="row" className={styles.roundNo}>
        第 {round.roundNo} 回合
      </th>
      <td className={open ? styles.liveCell : undefined}>
        {open ? '進行中' : nameOf(round.winnerPlayerPublicId, p1, p2)}
      </td>
      <td className={styles.numCol}>
        {round.startedAt === undefined ? (
          '—'
        ) : finished === undefined ? (
          <RoundTimer startedAt={round.startedAt} />
        ) : (
          formatDuration(timestampMs(finished) - timestampMs(round.startedAt))
        )}
      </td>
    </tr>
  );
}

function nameOf(publicId: string, p1: Player | undefined, p2: Player | undefined): string {
  if (publicId === '') return '';
  if (p1?.publicId === publicId) return p1.displayName;
  if (p2?.publicId === publicId) return p2.displayName;
  return publicId;
}

/** 每個狀態只講一件事:現在在等什麼。詞彙用這個世界的:開盤、封盤、開打。 */
function statusCopy(m: Match, budget: bigint, winner: string): string {
  switch (m.status) {
    case MatchStatus.PENDING:
      return '等上一輪分出勝負,對手到齊才開盤。';
    case MatchStatus.READY:
      if (budget === 0n) return '備戰中,等開打。';
      return m.handicapOpen ? '讓武選購中。' : '等裁判開盤讓武。';
    case MatchStatus.LOCKED:
      return '讓武已封盤,等開打。';
    case MatchStatus.LIVE:
      return `比賽中,第 ${currentRoundNo(m)} 回合。`;
    case MatchStatus.DONE:
      if (winner === '') return '已結束。';
      return m.resultKind === MatchResultKind.WALKOVER
        ? `${winner} 不戰而勝。`
        : `${winner} 勝出。`;
    default:
      return '';
  }
}
