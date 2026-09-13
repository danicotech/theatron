'use client';

import { Code, ConnectError } from '@connectrpc/connect';
import { Button, RankSigil } from '@theatron/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { activityApi } from '../../lib/api/activity';
import { platformApi } from '../../lib/api/client';
import type {
  Match,
  MatchHandicaps,
  Player,
  RankInfo,
  Tournament,
  Violation,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';
import {
  MatchKind,
  MatchResultKind,
  MatchStatus,
  Rank,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';
import type { SetupChecklistEntry } from '../../lib/api/gen/hestia/activity/v1/judge_pb';
import { usePolling } from '../../lib/api/poll';
import { currentRoundNo, RANK_TOTAL, rankLevel, rankName } from '../bracket/bracketView';

import { HandicapReview } from './HandicapReview';
import { RoundControls, RoundHistory } from './RoundControls';
import { SetupChecklist } from './SetupChecklist';
import { ViolationPanel, type ViolationRecord } from './ViolationPanel';

import styles from './MatchConsole.module.css';

/**
 * 一場比賽的裁判頁。
 *
 * 裁判是站在場邊拿著手機操作的,所以這一頁的結構是「現在按哪一顆」:
 * 頁首說明這是哪一場、狀態到哪;接著永遠只有**一個**下一步;
 * 其餘(讓武內容、回合紀錄、違規、直播連結)是支援資訊,排在後面。
 * 棄賽放最底下,而且與其他東西分開 —— 它會判對手不戰而勝並退掉所有注單。
 *
 * 動線(schemas/20「裁判動線」):
 *   一場一次:開盤 → 封盤前檢視 / 代退 → 封盤 → 設定確認
 *   每回合一次:正式決鬥開始 → 判定回合勝者
 *   一場一次:整場勝者由回合推導 → 晉級 / 派彩 / 季軍戰
 *
 * 每一步能不能走由伺服器判斷;這裡的取捨只是不讓人按下必然失敗的鍵。
 */

type Viewer = 'loading' | 'anonymous' | 'signed-in';

export interface MatchConsoleProps {
  slug: string;
  matchId: string;
}

/** 這一頁一次輪詢拿到的全部。分開輪詢會讓場次與清單各自落後半拍。 */
interface MatchView {
  match: Match;
  p1: Player | undefined;
  p2: Player | undefined;
  budget: bigint;
  holderId: string;
  handicaps: MatchHandicaps | null;
  checklist: SetupChecklistEntry[];
  violations: Violation[];
}

/**
 * 頁面上的「下一步」。與 MatchStatus 不是一對一:LOCKED 分成「還沒確認設定」與
 * 「確認了、等開打」,LIVE 分成「回合進行中」與「回合結束、等下一回合」。
 */
type Stage = 'waiting' | 'open' | 'lock' | 'setup' | 'start' | 'round' | 'next' | 'done';

export function stageOf(m: Match): Stage {
  switch (m.status) {
    case MatchStatus.PENDING:
      return m.p1PlayerPublicId === '' || m.p2PlayerPublicId === '' ? 'waiting' : 'open';
    case MatchStatus.READY:
      return 'lock';
    case MatchStatus.LOCKED:
      return m.setupConfirmedAt === undefined ? 'setup' : 'start';
    case MatchStatus.LIVE:
      return m.rounds.some((r) => r.finishedAt === undefined) ? 'round' : 'next';
    case MatchStatus.DONE:
      return 'done';
    default:
      return 'waiting';
  }
}

export function MatchConsole({ slug, matchId }: MatchConsoleProps) {
  const [viewer, setViewer] = useState<Viewer>('loading');
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [ranks, setRanks] = useState<RankInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<'lock' | 'withdraw' | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [withdrawNote, setWithdrawNote] = useState('');
  // 定案那一刻伺服器回的「因此成形的場次」。之後輪詢不會再給,所以留在本地。
  const [advanced, setAdvanced] = useState<Match[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        await platformApi.me.getProfile({});
        setViewer('signed-in');
      } catch (err) {
        setViewer(ConnectError.from(err).code === Code.Unauthenticated ? 'anonymous' : 'signed-in');
      }
    })();
  }, []);

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

  const load = useCallback(async (): Promise<MatchView> => {
    const res = await activityApi.tournament.getMatch({ matchPublicId: matchId });
    const match = res.match;
    if (match === undefined) throw new ConnectError('場次不存在', Code.NotFound);
    const view: MatchView = {
      match,
      p1: res.p1,
      p2: res.p2,
      budget: res.handicapBudget,
      holderId: res.handicapHolderPublicId,
      handicaps: null,
      checklist: [],
      violations: [],
    };
    // 下面三支要裁判權限。沒登入就只看場次 —— 登入牆會接手。
    if (viewer !== 'signed-in' || match.status === MatchStatus.PENDING) return view;
    const [h, s, v] = await Promise.all([
      activityApi.judge.reviewHandicap({ matchPublicId: matchId }),
      activityApi.judge.reviewSetup({ matchPublicId: matchId }),
      activityApi.judge.listViolations({ matchPublicId: matchId }),
    ]);
    view.handicaps = h.handicaps ?? null;
    view.checklist = s.checklist;
    view.violations = v.violations;
    return view;
  }, [matchId, viewer]);

  const polled = usePolling(load, 5000);
  const view = polled.data;

  async function run(what: string, fn: () => Promise<void>) {
    if (pending !== null) return;
    setPending(what);
    setError(null);
    try {
      await fn();
      await polled.reload();
    } catch (err) {
      const e = ConnectError.from(err);
      if (e.code === Code.Unauthenticated) setViewer('anonymous');
      setError(e.message);
    } finally {
      setPending(null);
    }
  }

  if (view === null) {
    return polled.error === null ? (
      <p className={styles.loading}>讀取場次…</p>
    ) : (
      <p className={styles.error} role="alert">
        {polled.error}
      </p>
    );
  }

  const { match, p1, p2 } = view;
  const stage = stageOf(match);
  const bestOf = tournament?.bestOf ?? 1;
  const nameOf = (id: string) =>
    id === p1?.publicId ? p1.displayName : id === p2?.publicId ? p2.displayName : id;
  const opponentOf = (id: string) =>
    id === match.p1PlayerPublicId ? match.p2PlayerPublicId : match.p1PlayerPublicId;
  const holder =
    view.holderId === p1?.publicId ? p1 : view.holderId === p2?.publicId ? p2 : undefined;
  const shownError = error ?? polled.error;

  return (
    <div className={styles.console}>
      <header>
        <div className={styles.topline}>
          <Link className={styles.back} href={`/judge/${slug}`}>
            ← 裁判台
          </Link>
          <p className={styles.eyebrow}>
            {match.kind === MatchKind.THIRD_PLACE
              ? '季軍戰'
              : `第 ${match.round} 輪 · 第 ${match.slot + 1} 場`}
          </p>
        </div>

        {/* 整組是一個標題:「李璃 對 A冷」。兩個 h1 各放一個名字會讓標題失去「這一場」的意思。 */}
        <h1 className={styles.versus}>
          <Side
            player={p1}
            id={match.p1PlayerPublicId}
            match={match}
            ranks={ranks}
            holderId={view.holderId}
            budget={view.budget}
          />
          {bestOf > 1 && match.rounds.length > 0 ? (
            <span
              className={styles.score}
              aria-label={`比分 ${match.p1RoundWins} 比 ${match.p2RoundWins}`}
            >
              {match.p1RoundWins} : {match.p2RoundWins}
            </span>
          ) : (
            <span className={styles.vs}>對</span>
          )}
          <Side
            right
            player={p2}
            id={match.p2PlayerPublicId}
            match={match}
            ranks={ranks}
            holderId={view.holderId}
            budget={view.budget}
          />
        </h1>

        <p className={styles.status}>
          {statusLine(match)}
          {holder === undefined ? '' : `。${holder.displayName} 持 ${view.budget.toString()} BP`}
        </p>
      </header>

      {viewer === 'anonymous' ? (
        <section className={styles.wall} aria-label="需要登入">
          <p className={styles.wallLine}>下面的動作要裁判身分。</p>
          <p className={styles.wallNote}>
            開盤、封盤、判定勝負都會進稽核紀錄,所以必須記在一個平台帳號上。
          </p>
          {/* 帶回程回到這一場:裁判按登入的時候手上正有一件事要做。 */}
          <Link className={styles.signin} href={`/judge/login?next=/judge/${slug}/m/${matchId}`}>
            登入
          </Link>
        </section>
      ) : (
        <>
          <section aria-label="下一步">
            {stage === 'waiting' ? (
              <div className={styles.primary}>
                <p className={styles.primaryCopy}>上一輪還沒分出勝負。對手確定之後才能開盤。</p>
              </div>
            ) : stage === 'open' ? (
              <div className={styles.primary}>
                <p className={styles.primaryCopy}>
                  {view.budget === 0n
                    ? '同段對決,本場沒有讓武。開盤之後觀眾就能開始下注。'
                    : `開盤之後,${nameOf(view.holderId)} 就能開始用 BP 選讓武,觀眾也能開始下注。`}
                </p>
                <div className={styles.actions}>
                  <Button
                    size="lg"
                    loading={pending === 'open'}
                    onClick={() => {
                      void run('open', async () => {
                        await activityApi.judge.openHandicap({ matchPublicId: matchId });
                      });
                    }}
                  >
                    開盤
                  </Button>
                </div>
              </div>
            ) : stage === 'lock' ? (
              <div className={styles.primary}>
                <p className={styles.primaryCopy}>
                  {view.budget === 0n
                    ? '本場沒有讓武,直接封盤就能進到設定確認。'
                    : `${nameOf(view.holderId)} 還在選讓武。封盤之後內容公開、發公告,需要抽選的項目在這一刻抽 —— 封了就不能再改。`}
                </p>
                {confirming === 'lock' ? (
                  <>
                    <p className={styles.ask}>確定封盤?封盤不可逆。</p>
                    <div className={styles.actions}>
                      <Button
                        variant="danger"
                        size="lg"
                        loading={pending === 'lock'}
                        onClick={() => {
                          void run('lock', async () => {
                            await activityApi.judge.lockHandicap({
                              matchPublicId: matchId,
                              confirm: true,
                            });
                            setConfirming(null);
                          });
                        }}
                      >
                        確定封盤
                      </Button>
                      <Button
                        size="lg"
                        onClick={() => {
                          setConfirming(null);
                        }}
                      >
                        再看看
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className={styles.actions}>
                    <Button
                      variant="danger"
                      size="lg"
                      onClick={() => {
                        setConfirming('lock');
                      }}
                    >
                      封盤
                    </Button>
                  </div>
                )}
              </div>
            ) : stage === 'setup' ? (
              <div className={styles.primary}>
                <p className={styles.primaryCopy}>
                  逐項核對場上的設定。整張清單一次確認,確認之後才能開打。
                </p>
                <SetupChecklist
                  entries={view.checklist}
                  confirm={{
                    pending: pending === 'setup',
                    onConfirm: () => {
                      void run('setup', async () => {
                        await activityApi.judge.confirmSetup({ matchPublicId: matchId });
                      });
                    },
                  }}
                />
              </div>
            ) : stage === 'done' ? (
              <div className={styles.primary}>
                <p className={styles.primaryCopy}>
                  {match.winnerPlayerPublicId === ''
                    ? '這場已結束。'
                    : `${nameOf(match.winnerPlayerPublicId)} 勝${
                        match.resultKind === MatchResultKind.WALKOVER
                          ? ',對手棄賽,不戰而勝,注單已退款'
                          : ''
                      }。`}
                </p>
                {advanced.length === 0 ? null : (
                  <>
                    <p className={styles.hint}>因此成形的場次:</p>
                    <ul className={styles.links}>
                      {advanced.map((m) => (
                        <li key={m.publicId}>
                          <Link className={styles.link} href={`/judge/${slug}/m/${m.publicId}`}>
                            {m.kind === MatchKind.THIRD_PLACE
                              ? '季軍戰'
                              : `第 ${m.round} 輪 · 第 ${m.slot + 1} 場`}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ) : (
              <RoundControls
                match={match}
                p1={p1}
                p2={p2}
                bestOf={bestOf}
                pending={pending === 'round'}
                onStart={() => {
                  void run('round', async () => {
                    await activityApi.judge.startRound({ matchPublicId: matchId });
                  });
                }}
                onFinish={(roundNo, winnerPlayerPublicId, note) => {
                  void run('round', async () => {
                    const res = await activityApi.judge.finishRound({
                      matchPublicId: matchId,
                      roundNo,
                      winnerPlayerPublicId,
                      confirm: true,
                      note,
                    });
                    if (res.matchDecided) setAdvanced(res.advancedMatches);
                  });
                }}
              />
            )}
          </section>

          {shownError === null ? null : (
            <p className={styles.error} role="alert">
              {shownError}
            </p>
          )}

          {stage === 'lock' ? (
            <section className={styles.panel} aria-label="讓武內容">
              <h2 className={styles.panelTitle}>讓武內容(封盤前只有裁判與施加者看得到)</h2>
              <HandicapReview
                handicaps={view.handicaps}
                holder={holder}
                budget={view.budget}
                pending={pending === 'refund'}
                onRefund={(selectionPublicId, reason) => {
                  void run('refund', async () => {
                    await activityApi.judge.refundSelection({ selectionPublicId, reason });
                  });
                }}
              />
            </section>
          ) : null}

          {(stage === 'start' || stage === 'round' || stage === 'next' || stage === 'done') &&
          view.checklist.length > 0 ? (
            <section className={styles.panel} aria-label="開賽前設定">
              <h2 className={styles.panelTitle}>開賽前設定(已確認)</h2>
              <SetupChecklist entries={view.checklist} />
            </section>
          ) : null}

          {match.rounds.length === 0 ? null : (
            <section className={styles.panel} aria-label="回合紀錄">
              <h2 className={styles.panelTitle}>回合紀錄</h2>
              <RoundHistory match={match} p1={p1} p2={p2} />
            </section>
          )}

          {stage === 'waiting' || stage === 'open' || stage === 'lock' ? null : (
            <section className={styles.panel} aria-label="違規">
              <h2 className={styles.panelTitle}>違規</h2>
              <ViolationPanel
                match={match}
                p1={p1}
                p2={p2}
                violations={view.violations}
                selections={view.handicaps?.selections ?? []}
                pending={pending === 'violation'}
                onRecord={(v: ViolationRecord) => {
                  void run('violation', async () => {
                    await activityApi.judge.recordViolation({ matchPublicId: matchId, ...v });
                  });
                }}
              />
            </section>
          )}

          <section className={styles.panel} aria-label="直播連結">
            <h2 className={styles.panelTitle}>直播連結</h2>
            <form
              className={styles.fieldset}
              onSubmit={(e) => {
                e.preventDefault();
                void run('stream', async () => {
                  await activityApi.judge.setStreamUrl({
                    matchPublicId: matchId,
                    streamUrl: (streamUrl ?? match.streamUrl).trim(),
                  });
                  setStreamUrl(null);
                });
              }}
            >
              <label className={styles.label}>
                對戰表上標 LIVE 的場次會直接連到這裡。留空就是清掉。
                <input
                  className={styles.field}
                  type="url"
                  inputMode="url"
                  value={streamUrl ?? match.streamUrl}
                  disabled={pending !== null}
                  onChange={(e) => {
                    setStreamUrl(e.target.value);
                  }}
                />
              </label>
              <div className={styles.actions}>
                <Button
                  type="submit"
                  loading={pending === 'stream'}
                  disabled={streamUrl === null || streamUrl.trim() === match.streamUrl}
                >
                  儲存直播連結
                </Button>
              </div>
            </form>
          </section>

          {stage === 'done' || stage === 'waiting' ? null : (
            <section className={styles.danger} aria-label="棄賽">
              <h2 className={styles.dangerTitle}>棄賽</h2>
              <p className={styles.hint}>
                對手不戰而勝,這場所有注單作廢退款。不可逆 —— 選手臨時退出才用這裡。
              </p>
              <div className={styles.pickRow} role="group" aria-label="棄賽的選手">
                {[p1, p2].map((p, i) =>
                  p === undefined ? null : (
                    <button
                      key={p.publicId}
                      type="button"
                      className={[
                        styles.pick,
                        withdrawing === p.publicId ? styles.picked : '',
                      ].join(' ')}
                      aria-pressed={withdrawing === p.publicId}
                      disabled={pending !== null}
                      onClick={() => {
                        setWithdrawing(withdrawing === p.publicId ? null : p.publicId);
                        setConfirming(null);
                      }}
                    >
                      {p.displayName}
                      <span className={styles.mono}>{i === 0 ? 'P1' : 'P2'}</span>
                    </button>
                  ),
                )}
              </div>
              {withdrawing === null ? null : (
                <>
                  <label className={styles.label}>
                    為什麼棄賽(進稽核紀錄)
                    <textarea
                      className={styles.field}
                      rows={2}
                      value={withdrawNote}
                      disabled={pending !== null}
                      onChange={(e) => {
                        setWithdrawNote(e.target.value);
                      }}
                    />
                  </label>
                  {confirming === 'withdraw' ? (
                    <>
                      <p className={styles.ask}>
                        確定讓 {nameOf(withdrawing)} 棄賽?{nameOf(opponentOf(withdrawing))}
                        不戰而勝,注單全部退款。不可逆。
                      </p>
                      <div className={styles.actions}>
                        <Button
                          variant="danger"
                          size="lg"
                          loading={pending === 'withdraw'}
                          onClick={() => {
                            void run('withdraw', async () => {
                              await activityApi.judge.withdrawPlayer({
                                playerPublicId: withdrawing,
                                note: withdrawNote.trim(),
                                confirm: true,
                              });
                              setWithdrawing(null);
                              setWithdrawNote('');
                              setConfirming(null);
                            });
                          }}
                        >
                          確定讓 {nameOf(withdrawing)} 棄賽
                        </Button>
                        <Button
                          size="lg"
                          onClick={() => {
                            setConfirming(null);
                          }}
                        >
                          再看看
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className={styles.actions}>
                      <Button
                        variant="danger"
                        size="lg"
                        disabled={withdrawNote.trim() === ''}
                        onClick={() => {
                          setConfirming('withdraw');
                        }}
                      >
                        讓 {nameOf(withdrawing)} 棄賽
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Side({
  player,
  id,
  match,
  ranks,
  holderId,
  budget,
  right = false,
}: {
  player: Player | undefined;
  id: string;
  match: Match;
  ranks: RankInfo[];
  holderId: string;
  budget: bigint;
  right?: boolean;
}) {
  const won = match.status === MatchStatus.DONE && id !== '' && match.winnerPlayerPublicId === id;
  return (
    <span className={[styles.side, right ? styles.sideRight : ''].join(' ')}>
      <span className={[styles.name, won ? styles.won : ''].join(' ')}>
        {id === '' ? '待定' : (player?.displayName ?? id)}
      </span>
      {player === undefined || player.rank === Rank.UNSPECIFIED ? null : (
        <RankSigil
          level={rankLevel(player.rank)}
          total={RANK_TOTAL}
          name={rankName(ranks, player.rank)}
          size="sm"
        />
      )}
      {id !== '' && id === holderId ? (
        <span className={styles.tag}>{budget.toString()} BP</span>
      ) : null}
    </span>
  );
}

/** 一句話說現在到哪。狀態詞用場上的語言(開盤、封盤、開打),不用狀態機的名字。 */
function statusLine(m: Match): string {
  switch (m.status) {
    case MatchStatus.PENDING:
      return m.p1PlayerPublicId === '' || m.p2PlayerPublicId === '' ? '等上一輪' : '尚未開盤';
    case MatchStatus.READY:
      return '已開盤,讓武選購中';
    case MatchStatus.LOCKED:
      return m.setupConfirmedAt === undefined ? '已封盤,等設定確認' : '設定已確認,等開打';
    case MatchStatus.LIVE:
      return `開打中,第 ${currentRoundNo(m)} 回合`;
    case MatchStatus.DONE:
      return '已完賽';
    default:
      return '';
  }
}
