'use client';

import { Code, ConnectError } from '@connectrpc/connect';
import { Button, PhaseTrack } from '@theatron/ui';
import { useCallback, useEffect, useState } from 'react';

import { activityApi } from '../../lib/api/activity';
import { platformApi } from '../../lib/api/client';
import type { RankInfo, Tournament } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { TournamentPhase } from '../../lib/api/gen/hestia/activity/v1/common_pb';

import { DrawPanel } from './DrawPanel';
import { nextPhase, PHASES, phaseKey } from './phases';
import { RankingPanel } from './RankingPanel';

import styles from './JudgeConsole.module.css';

/**
 * 一屆賽事的裁判台。
 *
 * 階段決定這一頁現在給什麼:報名期沒有東西可評,抽完籤之前沒有對戰表可看。
 * 把所有功能同時攤開只會讓人問「我現在該按哪一個」—— 而這個系統最初的
 * 痛點就是「怕說明不夠清楚讓參加者混亂」,對裁判同樣適用。
 *
 * 階段限制由伺服器驗證(requirePhase),這裡的取捨只是不要讓人按下必然失敗的鍵。
 */

type Viewer = 'loading' | 'anonymous' | 'signed-in';

export interface JudgeConsoleProps {
  slug: string;
}

export function JudgeConsole({ slug }: JudgeConsoleProps) {
  const [viewer, setViewer] = useState<Viewer>('loading');
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [ranks, setRanks] = useState<RankInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  const load = useCallback(async () => {
    const [t, r] = await Promise.all([
      activityApi.tournament.getTournament({ slug }),
      activityApi.tournament.listRanks({ tournamentSlug: slug }),
    ]);
    setTournament(t.tournament ?? null);
    setRanks(r.ranks);
  }, [slug]);

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
    void load().catch((err: unknown) => {
      setError(ConnectError.from(err).message);
    });
  }, [load]);

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

  const phase = tournament.phase;
  const next = nextPhase(phase);

  async function advance() {
    if (next === undefined || advancing) return;
    setAdvancing(true);
    setError(null);
    try {
      await activityApi.judge.advancePhase({
        tournamentSlug: slug,
        toPhase: next.phase,
        note: '',
      });
      await load();
    } catch (err) {
      setError(ConnectError.from(err).message);
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div className={styles.console}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>裁判台</p>
        <h1 className={styles.title}>{tournament.name}</h1>
        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>代號</dt>
            <dd className={styles.mono}>{tournament.slug}</dd>
          </div>
          <div className={styles.fact}>
            <dt>報名人數</dt>
            <dd className={styles.mono}>{tournament.playerCount}</dd>
          </div>
          <div className={styles.fact}>
            <dt>每差一段</dt>
            <dd className={styles.mono}>{tournament.bpPerRankGap.toString()} BP</dd>
          </div>
        </dl>
      </header>

      <PhaseTrack steps={PHASES} current={phaseKey(phase)} />

      {viewer === 'anonymous' ? (
        <section className={styles.wall} aria-label="需要登入">
          <p className={styles.wallLine}>下面的動作要裁判身分。</p>
          <p className={styles.wallNote}>
            評段、抽籤、判定勝負都會進稽核紀錄,所以必須記在一個平台帳號上。
          </p>
          {/* 帶 redirect 回到這一頁。少了它,裁判登入完會落在站台首頁,
              得自己找路回來 —— 而他按登入的時候手上正有一件事要做。
              值由伺服器的 CleanRedirect 驗(只收站內相對路徑),不是這裡說了算。 */}
          <a
            className={styles.signin}
            href={`/api/auth/discord/start?redirect=${encodeURIComponent(`/judge/${slug}`)}`}
          >
            用 Discord 登入
          </a>
        </section>
      ) : (
        <section className={styles.panel} aria-label={`${phaseLabelOf(phase)}的操作`}>
          {phase === TournamentPhase.RANKING ? (
            <RankingPanel
              slug={slug}
              ranks={ranks}
              onRanked={() => {
                void load();
              }}
            />
          ) : phase === TournamentPhase.DRAWING ? (
            <DrawPanel
              slug={slug}
              ranks={ranks}
              onConfirmed={() => {
                void load();
              }}
            />
          ) : (
            <p className={styles.idle}>{idleCopy(phase)}</p>
          )}
        </section>
      )}

      {error === null ? null : (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {viewer === 'anonymous' || next === undefined ? null : (
        <footer className={styles.advance}>
          <Button
            size="lg"
            loading={advancing}
            onClick={() => {
              void advance();
            }}
          >
            推進到「{next.label}」
          </Button>
          <p className={styles.advanceNote}>
            階段只往前走。走不走得動由伺服器判斷 —— 例如還有人沒評段就不能開始抽籤。
          </p>
        </footer>
      )}
    </div>
  );
}

function phaseLabelOf(phase: TournamentPhase): string {
  return PHASES.find((p) => p.phase === phase)?.label ?? '這個階段';
}

/** 沒有專屬面板的階段,說清楚現在在等什麼。空狀態是邀請動作,不是道歉。 */
function idleCopy(phase: TournamentPhase): string {
  switch (phase) {
    case TournamentPhase.SIGNUP:
      return '報名開著,等選手填表。人數滿意了就截止報名。';
    case TournamentPhase.SIGNUP_CLOSED:
      return '報名已截止。接下來逐人評定段位。';
    case TournamentPhase.RANKED:
      return '段位已公布。這段時間留給異議 —— 一旦開始抽籤,段位就不能再改。';
    case TournamentPhase.IN_PROGRESS:
      return '比賽進行中。開盤、封盤、判定勝負在各場次的頁面操作。';
    case TournamentPhase.FINISHED:
      return '這一屆結束了。';
    default:
      return '這個階段沒有需要裁判操作的事。';
  }
}
