'use client';

import { BuildCard } from '../signup/BuildCard';
import { create } from '@bufbuild/protobuf';
import { MemberOverview } from '../member/MemberOverview';
import type { MemberProfile } from '../../lib/api/gen/hestia/platform/v1/auth_pb';
import { SelectedLoadout } from './SelectedLoadout';
import { CharacterConfigSchema } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { MyRegistrationSchema } from '../../lib/api/gen/hestia/activity/v1/signup_pb';
import { MemberShell, type MemberView } from '../member/MemberShell';
import { PersonalArmory } from '../member/PersonalArmory';
import { MemberAccess, MemberStatus } from '../member/MemberAccess';
import { PlayerLogin } from './PlayerLogin';
import { Code, ConnectError } from '@connectrpc/connect';
import { Button, ChapterHead, RankSigil } from '@theatron/ui';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { useTournamentRealtime } from '../realtime/useTournamentRealtime';
import { ConnectionStatus } from '../realtime/ConnectionStatus';
import { tournamentRealtime } from '../realtime/tournamentRealtime';
import { memberLogout } from '../../lib/api/memberSession';
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
  view?: MemberView | 'all';
  member?: MemberProfile | undefined;
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

export function MyPlayer({ slug, view = 'all', member }: MyPlayerProps) {
  const sync = useTournamentRealtime(slug);
  const request = useRef<AbortController | null>(null);
  const handledLoadoutReturn = useRef(false);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [ranks, setRanks] = useState<RankInfo[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [acceptedVersion, setAcceptedVersion] = useState('');
  const [selfRated, setSelfRated] = useState<Rank>(Rank.UNSPECIFIED);

  const load = useCallback(async () => {
    request.current?.abort();
    const current = new AbortController();
    request.current = current;
    try {
      const res = await activityApi.signup.getMyPlayer({}, { signal: current.signal });
      if (current.signal.aborted) return;
      const player = res.player;
      const tournament = res.tournament;
      if (player === undefined || tournament === undefined || tournament.slug !== slug) {
        setState({ kind: 'anonymous' });
        return;
      }
      if (
        !handledLoadoutReturn.current &&
        new URLSearchParams(location.search).has('loadoutRole')
      ) {
        handledLoadoutReturn.current = true;
        setEditing(true);
        setSelfRated(res.registration?.selfRatedRank ?? Rank.UNSPECIFIED);
      }
      setState({
        kind: 'ready',
        player,
        tournament,
        match: res.currentMatch,
        registration: res.registration,
      });
    } catch (err) {
      if (current.signal.aborted) return;
      const ce = ConnectError.from(err);
      setState(
        ce.code === Code.Unauthenticated
          ? { kind: 'anonymous' }
          : { kind: 'error', message: ce.rawMessage },
      );
    }
  }, [slug]);

  useEffect(() => {
    if (sync.revision > 0) void load();
  }, [sync.revision, load]);
  useEffect(() => () => request.current?.abort(), [slug]);

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
    const pending = (
      <p className={styles.muted} role="status">
        正在確認登入狀態…
      </p>
    );
    return view === 'all' ? pending : <MemberStatus>{pending}</MemberStatus>;
  }

  if (state.kind === 'anonymous') {
    if (view !== 'all')
      return (
        <MemberAccess slug={slug} mode="login">
          <PlayerLogin slug={slug} onSuccess={load} />
        </MemberAccess>
      );
    return (
      <div className={styles.wall}>
        <p className={styles.wallLine}>你還沒進站。</p>
        <div className={styles.wallLinks}>
          <Link className={styles.link} href={`/t/${slug}/login`}>
            登入會員
          </Link>
          <Link className={styles.link} href={`/t/${slug}/signup`}>
            還沒報名
          </Link>
        </div>
      </div>
    );
  }

  if (state.kind === 'error') {
    if (view !== 'all')
      return (
        <MemberStatus>
          <p role="alert">{state.message}</p>
          <Button onClick={() => void load()}>重新確認登入狀態</Button>
        </MemberStatus>
      );
    return (
      <p className={styles.error} role="alert">
        {state.message}
      </p>
    );
  }

  const { player, tournament, match, registration } = state;
  // 個人武庫隨時可編輯；參賽配置在開賽前可換，個人評段資料仍於報名截止鎖定。
  const phase = sync.tournament?.phase ?? tournament.phase;
  const beforeStart = [
    TournamentPhase.SIGNUP,
    TournamentPhase.SIGNUP_CLOSED,
    TournamentPhase.RANKING,
    TournamentPhase.RANKED,
    TournamentPhase.DRAWING,
  ].includes(phase);
  const editable =
    sync.status === 'ready' &&
    (view === 'character' ? beforeStart : phase === TournamentPhase.SIGNUP);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || !editable) return;
    setSaving(true);
    setSaveError(null);
    try {
      const values = readRegistration(
        new FormData(e.currentTarget),
        selfRated,
        sync.tournament?.rulesVersion ?? tournament.rulesVersion,
      );
      values.ladderScore = registration?.ladderScore ?? 0;
      if (view === 'registration') values.character = registration?.character;
      const characterUpdate = create(MyRegistrationSchema, registration);
      characterUpdate.character = values.character;
      characterUpdate.acceptedRulesVersion = values.acceptedRulesVersion;
      // UpdateRegistration replaces the full record; a character edit must preserve personal fields.
      await activityApi.signup.updateRegistration({
        registration: view === 'character' ? characterUpdate : values,
      });
      setEditing(false);
      tournamentRealtime(slug).invalidate();
      await load();
      setSaved(true);
    } catch (err) {
      setSaveError(ConnectError.from(err).rawMessage);
    } finally {
      setSaving(false);
    }
  }
  const rankIndex = ranks.findIndex((r) => r.rank === player.rank);
  const rankInfo = rankIndex < 0 ? undefined : ranks[rankIndex];

  const loggedOut = () => {
    request.current?.abort();
    setEditing(false);
    setState({ kind: 'anonymous' });
  };
  if (view === 'overview')
    return (
      <MemberShell
        slug={slug}
        view={view}
        tournamentName={tournament.name}
        onLogout={loggedOut}
        canManage={member?.canManage}
      >
        <MemberOverview
          member={member}
          displayName={player.displayName}
          gameId={player.gameId}
          enrolled
          rankName={rankInfo?.name ?? '未評定'}
        />
      </MemberShell>
    );
  const content = (
    <div className={styles.page}>
      <div className={styles.connection}>
        <ConnectionStatus slug={slug} state={sync} />
      </div>
      <div className={styles.account}>
        {/* 「我的」不在導覽序列裡,印記用「我」。遊戲ID 是名字的副標,不是另一則事實,
          所以放在引言位而不是下面的事實列 —— 它識別的是標題上的那個人。 */}
        {view === 'all' ? (
          <ChapterHead
            number="我"
            eyebrow="我的報名"
            title={player.displayName}
            lede={<span className={styles.gameId}>{player.gameId}</span>}
          />
        ) : (
          <div className={styles.identity}>
            <h3>{player.displayName}</h3>
            <p className={styles.gameId}>{player.gameId}</p>
          </div>
        )}
        {view === 'all' ? (
          <Button
            onClick={() => {
              void memberLogout()
                .then(() => {
                  request.current?.abort();
                  setEditing(false);
                  setState({ kind: 'anonymous' });
                })
                .catch((err: unknown) => setSaveError(ConnectError.from(err).rawMessage));
            }}
          >
            {view === 'all' ? '離站' : '登出'}
          </Button>
        ) : null}
      </div>
      {saved ? (
        <p className={styles.saved} role="status">
          已儲存，資料已更新。
        </p>
      ) : null}
      {!editing && saveError ? (
        <p className={styles.error} role="alert">
          {saveError}
        </p>
      ) : null}

      {view === 'all' ? (
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
      ) : null}

      <section className={styles.reg} aria-label="報名資料">
        <div className={styles.regHead}>
          <h2 className={styles.h2}>{view === 'character' ? '已保存配置' : '參賽資料'}</h2>
          {editable && !editing ? (
            <Button
              size="sm"
              onClick={() => {
                setSelfRated(registration?.selfRatedRank ?? Rank.UNSPECIFIED);
                setSaveError(null);
                setSaved(false);
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
          >
            <fieldset className={styles.fields} disabled={saving || !editable}>
              <legend className={styles.srOnly}>報名資料</legend>
              <RegistrationFields
                slug={slug}
                memberId={player.userPublicId}
                characterOnly={view === 'character'}
                personalOnly={view === 'registration'}
                rulesVersion={sync.tournament?.rulesVersion ?? tournament.rulesVersion}
                rulesHref="/#rules"
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
              <Button
                variant="primary"
                type="submit"
                size="lg"
                loading={saving}
                disabled={!editable}
              >
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
              {view !== 'registration' ? (
                <>
                  <div>
                    <dt>流派</dt>
                    <dd>
                      <BuildCard name={registration?.character?.style} />
                    </dd>
                  </div>
                  <RegRow label="武器" value={registration?.character?.weapon} />
                  <RegRow label="裝備" value={registration?.character?.equipment} multiline />
                  <RegRow label="武學" value={registration?.character?.arts} multiline />
                </>
              ) : null}
              {view !== 'character' ? (
                <>
                  <RegRow
                    label="規則確認"
                    value={
                      registration?.acceptedRulesVersion
                        ? '已確認版本 ' +
                          registration.acceptedRulesVersion +
                          (registration.acceptedRulesVersion ===
                          (sync.tournament?.rulesVersion ?? tournament.rulesVersion)
                            ? ''
                            : '（需確認新版）')
                        : '尚未確認，請修改報名資料補上'
                    }
                  />
                  <RegRow
                    label="確認時間"
                    value={
                      registration?.rulesAcceptedAt
                        ? new Date(
                            Number(registration.rulesAcceptedAt.seconds) * 1000,
                          ).toLocaleString('zh-TW')
                        : undefined
                    }
                  />
                  <RegRow label="Discord 名稱" value={registration?.discordName} />
                  <RegRow
                    label="自評段位"
                    value={selfRatedName(ranks, registration?.selfRatedRank)}
                  />
                  <RegRow label="論劍段位" value={registration?.ladderRank} />
                  <RegRow label="常用武學" value={registration?.artsNote} multiline />
                  <RegRow label="可出賽時段" value={registration?.availabilityNote} multiline />
                </>
              ) : null}
            </dl>
            {editable ? null : (
              <p className={styles.regNote}>
                {sync.status !== 'ready'
                  ? '正在重新確認賽事狀態，連線恢復後才能修改。'
                  : view === 'character'
                    ? '比賽已開始，本屆參賽配置已鎖定。個人武庫仍可編輯，不會改動本屆配置。'
                    : '報名已截止，參賽資料已鎖定。'}
              </p>
            )}
          </>
        )}
      </section>
      {view === 'registration' ? (
        <Link className={styles.link} href={'/t/' + slug + '/me?view=character'}>
          查看角色配置
        </Link>
      ) : null}
      {view === 'all' ? (
        <section className={styles.now} aria-label="現在該做什麼">
          <p className={styles.nowLine}>{nextStep(tournament.phase, player, match)}</p>
          <div className={styles.wallLinks}>
            <Link className={styles.link} href="/">
              賽事頁
            </Link>
            <Link className={styles.link} href="/#rules">
              規則與讓武項目
            </Link>
            {tournament.phase === TournamentPhase.IN_PROGRESS && match !== undefined ? (
              <>
                <Link className={styles.link} href={`/t/${slug}/me/handicap`}>
                  本場讓武
                </Link>
                <Link
                  className={styles.link}
                  href={`/?match=${encodeURIComponent(match.publicId)}#duel`}
                >
                  這一場
                </Link>
              </>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
  if (view === 'character') {
    const rulesVersion = sync.tournament?.rulesVersion ?? tournament.rulesVersion;
    const needsConsent = !!rulesVersion && registration?.acceptedRulesVersion !== rulesVersion;
    return (
      <MemberShell
        slug={slug}
        view={view}
        tournamentName={tournament.name}
        onLogout={loggedOut}
        canManage={member?.canManage}
      >
        <PersonalArmory
          slug={slug}
          memberId={player.userPublicId}
          rankName={rankInfo?.name ?? '未評定'}
          ladderRank={registration?.ladderRank}
          matchId={match?.publicId}
          playerId={player.publicId}
          revision={sync.revision}
        >
          <SelectedLoadout
            compact
            slug={slug}
            memberId={player.userPublicId}
            defaults={registration?.character}
            locked={!editable}
            lockedLabel={beforeStart ? '連線恢復後即可確認參賽配置' : '本屆參賽配置已鎖定'}
            confirmLabel="確認更新參賽配置"
            onConfirm={async (character) => {
              if (!editable) throw new Error('目前無法修改參賽配置');
              if (needsConsent && acceptedVersion !== rulesVersion)
                throw new Error('請先確認本屆規則');
              const update = create(MyRegistrationSchema, registration);
              update.character = create(CharacterConfigSchema, character);
              update.acceptedRulesVersion = rulesVersion;
              await activityApi.signup.updateRegistration({ registration: update });
              tournamentRealtime(slug).invalidate();
              await load();
            }}
          />
          {needsConsent && editable ? (
            <label>
              <input
                type="checkbox"
                checked={acceptedVersion === rulesVersion}
                onChange={(e) => setAcceptedVersion(e.target.checked ? rulesVersion : '')}
              />{' '}
              我已閱讀並同意 <Link href="/#rules">本屆規則</Link>
            </label>
          ) : null}
        </PersonalArmory>
      </MemberShell>
    );
  }
  return view === 'all' ? (
    content
  ) : (
    <MemberShell
      slug={slug}
      view={view}
      tournamentName={tournament.name}
      onLogout={loggedOut}
      canManage={member?.canManage}
    >
      {content}
    </MemberShell>
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
