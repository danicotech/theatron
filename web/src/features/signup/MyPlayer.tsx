'use client';

import { Code, ConnectError } from '@connectrpc/connect';
import { RankSigil } from '@theatron/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { activityApi } from '../../lib/api/activity';
import type {
  Match,
  Player,
  RankInfo,
  Tournament,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { PlayerStatus, TournamentPhase } from '../../lib/api/gen/hestia/activity/v1/common_pb';

import styles from './MyPlayer.module.css';

/**
 * 我的報名。
 *
 * 進站之後第一個要回答的問題是「我是誰、我現在該等什麼」。沒有這一頁,
 * 進站成功與沒進站在畫面上長得一模一樣 —— 那是使用者實際回報的問題。
 *
 * 身分從 session 來(GetMyPlayer 不收 slug):選手 session 綁一屆,
 * 所以「我是誰」與「哪一屆」是同一件事。
 */

export interface MyPlayerProps {
  slug: string;
}

type State =
  | { kind: 'loading' }
  | { kind: 'anonymous' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; player: Player; tournament: Tournament; match: Match | undefined };

export function MyPlayer({ slug }: MyPlayerProps) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [ranks, setRanks] = useState<RankInfo[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await activityApi.signup.getMyPlayer({});
      const player = res.player;
      const tournament = res.tournament;
      if (player === undefined || tournament === undefined) {
        setState({ kind: 'anonymous' });
        return;
      }
      setState({ kind: 'ready', player, tournament, match: res.currentMatch });
    } catch (err) {
      const ce = ConnectError.from(err);
      setState(
        ce.code === Code.Unauthenticated
          ? { kind: 'anonymous' }
          : { kind: 'error', message: ce.message },
      );
    }
  }, []);

  useEffect(() => {
    void load();
    void activityApi.tournament
      .listRanks({ tournamentSlug: slug })
      .then((r) => {
        setRanks(r.ranks);
      })
      .catch(() => {
        setRanks([]);
      });
  }, [load, slug]);

  if (state.kind === 'loading') {
    return <p className={styles.muted}>讀取中…</p>;
  }

  if (state.kind === 'anonymous') {
    return (
      <div className={styles.wall}>
        <p className={styles.wallLine}>你還沒進站。</p>
        <div className={styles.wallLinks}>
          <Link className={styles.link} href={`/t/${slug}/login`}>
            用遊戲ID 進站
          </Link>
          <Link className={styles.link} href={`/t/${slug}/signup`}>
            還沒報名
          </Link>
        </div>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <p className={styles.error} role="alert">
        {state.message}
      </p>
    );
  }

  const { player, tournament, match } = state;
  const rankIndex = ranks.findIndex((r) => r.rank === player.rank);
  const rankInfo = rankIndex < 0 ? undefined : ranks[rankIndex];

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>我的報名</p>
        <h1 className={styles.name}>{player.displayName}</h1>
        <p className={styles.gameId}>{player.gameId}</p>
      </header>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>段位</dt>
          <dd>
            <RankSigil
              level={rankIndex + 1}
              total={ranks.length === 0 ? 4 : ranks.length}
              name={rankInfo?.name ?? ''}
              title={rankInfo?.title}
              size="sm"
            />
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>狀態</dt>
          <dd>{statusLabel(player.status)}</dd>
        </div>
        {player.seedNo === 0 ? null : (
          <div className={styles.fact}>
            <dt>籤位</dt>
            <dd className={styles.mono}>{player.seedNo}</dd>
          </div>
        )}
      </dl>

      <section className={styles.now} aria-label="現在該做什麼">
        <p className={styles.nowLine}>{nextStep(tournament.phase, player, match)}</p>
        <div className={styles.wallLinks}>
          <Link className={styles.link} href={`/t/${slug}`}>
            賽事頁
          </Link>
          <Link className={styles.link} href={`/t/${slug}/rules`}>
            規則與讓武項目
          </Link>
        </div>
      </section>
    </div>
  );
}

function statusLabel(s: PlayerStatus): string {
  switch (s) {
    case PlayerStatus.ACTIVE:
      return '參賽中';
    case PlayerStatus.ELIMINATED:
      return '已淘汰';
    case PlayerStatus.WITHDRAWN:
      return '已棄賽';
    default:
      return '未知';
  }
}

/** 只講一件事:你現在在等什麼,或該做什麼。 */
function nextStep(phase: TournamentPhase, player: Player, match: Match | undefined): string {
  if (player.status === PlayerStatus.WITHDRAWN) {
    return '你已經棄賽,不會再被排進對戰表。';
  }
  if (player.status === PlayerStatus.ELIMINATED) {
    return '你這一屆的賽程結束了。對戰表仍然看得到,下一屆再來。';
  }
  switch (phase) {
    case TournamentPhase.SIGNUP:
      return '報名已收到。接下來等報名截止,御風羽才開始評段。';
    case TournamentPhase.SIGNUP_CLOSED:
    case TournamentPhase.RANKING:
      return '報名已截止,御風羽正在評段。段位會在抽籤之前一次公布。';
    case TournamentPhase.RANKED:
      return '段位已公布。對段位有異議,請在抽籤開始前找御風羽 —— 抽籤之後就不能改了。';
    case TournamentPhase.DRAWING:
      return '抽籤中。對戰表確認後你會看到自己的籤位與對手。';
    case TournamentPhase.IN_PROGRESS:
      return match === undefined
        ? '比賽進行中,等你的下一場排定。'
        : `你的下一場是第 ${match.round} 輪第 ${match.slot + 1} 場。${
            match.handicapOpen ? '讓武已開盤,可以開始選。' : '讓武還沒開盤,等御風羽公告。'
          }`;
    case TournamentPhase.FINISHED:
      return '這一屆結束了。';
    default:
      return '';
  }
}
