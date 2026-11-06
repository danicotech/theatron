'use client';

import { ConnectError } from '@connectrpc/connect';
import { Button } from '@theatron/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { activityApi } from '../../lib/api/activity';
import { TournamentPhase } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { HelpTip } from '../chrome/HelpTip';
import { ConnectionStatus } from '../realtime/ConnectionStatus';
import { tournamentRealtime } from '../realtime/tournamentRealtime';
import { useTournamentRealtime } from '../realtime/useTournamentRealtime';
import { PlayerAvatarManager } from './PlayerAvatarManager';
import { DrawPanel } from './DrawPanel';
import { MatchConsole } from './MatchConsole';
import { MatchList } from './MatchList';
import { RegistrationRoster } from './RegistrationRoster';
import { RankingPanel } from './RankingPanel';
import { nextPhase, phaseLabel } from './phases';
import styles from './ScheduleManagement.module.css';

export function ScheduleManagement({ slug }: { slug: string }) {
  const sync = useTournamentRealtime(slug);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<TournamentPhase | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const changed = useCallback(() => tournamentRealtime(slug).reconnect(), [slug]);
  const selectMatch = useCallback((id: string) => setMatchId(id), []);
  useEffect(() => {
    heading.current?.focus({ preventScroll: false });
  }, [matchId]);
  useEffect(() => {
    setConfirming(null);
  }, [sync.tournament?.phase]);

  const tournament = sync.tournament;
  if (!tournament) return <ConnectionStatus slug={slug} state={sync} />;
  const phase = tournament.phase;
  // Publishing the draw has its own server operation; generic phase advancement cannot replace it.
  const next = phase === TournamentPhase.DRAWING ? undefined : nextPhase(phase);
  async function advance() {
    if (!next || confirming !== next.phase || sync.status !== 'ready' || pending) return;
    setPending(true);
    setError('');
    try {
      await activityApi.judge.advancePhase({
        tournamentSlug: slug,
        toPhase: next.phase,
        note: '管理者於賽程更新賽事階段',
      });
      setConfirming(null);
      changed();
    } catch (err) {
      setError(ConnectError.from(err).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={styles.workspace} aria-label="賽程管理">
      <ConnectionStatus slug={slug} state={sync} />
      <header className={styles.heading}>
        <div>
          <h2 ref={heading} tabIndex={-1}>
            {matchId ? '管理單場對局' : '賽程管理'}
          </h2>
          <p>
            {tournament.name} · {phaseLabel(phase)}
          </p>
        </div>
      </header>
      {matchId ? (
        <MatchConsole
          key={matchId}
          slug={slug}
          matchId={matchId}
          onBack={() => setMatchId(null)}
          onSelectMatch={selectMatch}
          onChanged={changed}
        />
      ) : (
        <>
          <div className={styles.facts}>
            <span>
              報名人數 <strong>{tournament.playerCount}</strong>
            </span>
            <span>
              賽制 <strong>{tournament.bestOf}</strong> 戰{' '}
              <strong>{Math.floor(tournament.bestOf / 2) + 1}</strong> 勝
            </span>
            <span>
              每差一段 <strong>{tournament.bpPerRankGap.toString()}</strong> BP
            </span>
          </div>
          {(phase === TournamentPhase.SIGNUP || phase === TournamentPhase.SIGNUP_CLOSED) && (
            <RegistrationRoster slug={slug} />
          )}
          {phase === TournamentPhase.RANKING && (
            <RankingPanel slug={slug} ranks={sync.ranks} onRanked={changed} />
          )}
          {phase === TournamentPhase.RANKED && <p>段位已公布，開始抽籤後即可安排選手籤位。</p>}
          {phase === TournamentPhase.DRAWING && (
            <DrawPanel slug={slug} ranks={sync.ranks} onConfirmed={changed} onChanged={changed} />
          )}
          {(phase === TournamentPhase.IN_PROGRESS || phase === TournamentPhase.FINISHED) && (
            <MatchList
              slug={slug}
              ranks={sync.ranks}
              tournament={tournament}
              onSelectMatch={selectMatch}
            />
          )}
          <PlayerAvatarManager slug={slug} />
          {next && (
            <section className={styles.phase} aria-label="賽事階段操作">
              <h3>
                賽事階段
                <HelpTip
                  label="賽事階段"
                  text="階段只能往前推進。抽籤公布與每場開賽、回合結束各自確認，未完成的必要條件會由系統檢查。"
                />
              </h3>
              {confirming === next.phase ? (
                <>
                  <p>
                    確定將「{phaseLabel(phase)}」改為「{next.label}」？此操作無法復原。
                  </p>
                  <div className={styles.actions}>
                    <Button
                      variant="danger"
                      loading={pending}
                      disabled={pending || sync.status !== 'ready'}
                      onClick={() => void advance()}
                    >
                      確認{next.label}
                    </Button>
                    <Button disabled={pending} onClick={() => setConfirming(null)}>
                      取消
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  variant="primary"
                  disabled={sync.status !== 'ready'}
                  onClick={() => setConfirming(next.phase)}
                >
                  {next.phase === TournamentPhase.FINISHED ? '結束本屆賽事' : `進入${next.label}`}
                </Button>
              )}
              {error && (
                <p role="alert" className={styles.error}>
                  {error}
                </p>
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}
