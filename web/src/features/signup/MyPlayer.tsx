'use client';

import { Code, ConnectError } from '@connectrpc/connect';
import { Button, RankSigil } from '@theatron/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { activityApi } from '../../lib/api/activity';
import type {
  Match,
  Player,
  RankInfo,
  Tournament,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';
import {
  PlayerStatus,
  Rank,
  TournamentPhase,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';
import type { MyRegistration } from '../../lib/api/gen/hestia/activity/v1/signup_pb';

import { readRegistration, RegistrationFields } from './RegistrationFields';

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
  | {
      kind: 'ready';
      player: Player;
      tournament: Tournament;
      match: Match | undefined;
      registration: MyRegistration | undefined;
    };

export function MyPlayer({ slug }: MyPlayerProps) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [ranks, setRanks] = useState<RankInfo[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selfRated, setSelfRated] = useState<Rank>(Rank.UNSPECIFIED);

  const load = useCallback(async () => {
    try {
      const res = await activityApi.signup.getMyPlayer({});
      const player = res.player;
      const tournament = res.tournament;
      if (player === undefined || tournament === undefined) {
        setState({ kind: 'anonymous' });
        return;
      }
      setState({
        kind: 'ready',
        player,
        tournament,
        match: res.currentMatch,
        registration: res.registration,
      });
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

  const { player, tournament, match, registration } = state;
  // 只有報名期能改。伺服器同樣擋一次 —— 這裡的判斷只是不要遞給人一顆
  // 必然失敗的按鈕,不是防線。
  const editable = tournament.phase === TournamentPhase.SIGNUP;

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await activityApi.signup.updateRegistration({
        registration: readRegistration(new FormData(e.currentTarget), selfRated),
      });
      setEditing(false);
      await load();
    } catch (err) {
      setSaveError(ConnectError.from(err).message);
    } finally {
      setSaving(false);
    }
  }
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

      <section className={styles.reg} aria-label="報名資料">
        <div className={styles.regHead}>
          <h2 className={styles.h2}>報名資料</h2>
          {editable && !editing ? (
            <Button
              size="sm"
              onClick={() => {
                setSelfRated(registration?.selfRatedRank ?? Rank.UNSPECIFIED);
                setSaveError(null);
                setEditing(true);
              }}
            >
              修改
            </Button>
          ) : null}
        </div>

        {editing ? (
          <form
            className={styles.form}
            onSubmit={(e) => {
              void save(e);
            }}
            noValidate
          >
            <fieldset className={styles.fields} disabled={saving}>
              <legend className={styles.srOnly}>報名資料</legend>
              <RegistrationFields
                ranks={ranks}
                selfRated={selfRated}
                onSelfRated={setSelfRated}
                defaults={registration}
                displayNameHelp="對戰表上要怎麼稱呼你。留空就用遊戲ID。"
              />
            </fieldset>

            {saveError === null ? null : (
              <p className={styles.error} role="alert">
                {saveError}
              </p>
            )}

            <div className={styles.formActions}>
              <Button type="submit" size="lg" loading={saving}>
                儲存
              </Button>
              <Button
                size="lg"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                }}
              >
                取消
              </Button>
            </div>
          </form>
        ) : (
          <>
            <dl className={styles.regList}>
              <RegRow label="Discord 名稱" value={registration?.discordName} />
              <RegRow label="自評段位" value={selfRatedName(ranks, registration?.selfRatedRank)} />
              <RegRow
                label="論劍"
                value={ladderText(registration?.ladderRank, registration?.ladderScore)}
              />
              <RegRow label="常用武學 / PVP 經驗" value={registration?.artsNote} multiline />
              <RegRow label="可出賽時段 / 備註" value={registration?.availabilityNote} multiline />
            </dl>
            {editable ? null : (
              <p className={styles.regNote}>
                報名已截止,這些內容不能再改 —— 御風羽正是照著它們評段。要更正請找御風羽。
              </p>
            )}
          </>
        )}
      </section>

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

/** 沒填的欄位要看得出「沒填」,不是一片空白讓人以為壞了。 */
function RegRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string | undefined;
  multiline?: boolean;
}) {
  const empty = value === undefined || value === '';
  return (
    <div className={styles.regRow}>
      <dt>{label}</dt>
      <dd className={[empty ? styles.blank : '', multiline ? styles.multiline : ''].join(' ')}>
        {empty ? '未填' : value}
      </dd>
    </div>
  );
}

function selfRatedName(ranks: RankInfo[], r: Rank | undefined): string {
  if (r === undefined || r === Rank.UNSPECIFIED) return '';
  return ranks.find((x) => x.rank === r)?.name ?? '';
}

function ladderText(rank: string | undefined, score: number | undefined): string {
  const parts = [rank ?? '', score === undefined || score === 0 ? '' : String(score)].filter(
    (x) => x !== '',
  );
  return parts.join(' · ');
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
