'use client';

import { Code, ConnectError } from '@connectrpc/connect';
import {
  Button,
  ChapterHead,
  InkLink,
  InkTitle,
  PaperCard,
  PhaseTrack,
  SealStamp,
} from '@theatron/ui';
import { useCallback, useEffect, useState } from 'react';

import { activityApi } from '../../lib/api/activity';
import { platformApi } from '../../lib/api/client';
import type { RankInfo, Tournament } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { TournamentPhase } from '../../lib/api/gen/hestia/activity/v1/common_pb';

import { inkMark } from '../tournament/inkMarks';

import { DrawPanel } from './DrawPanel';
import { MatchList } from './MatchList';
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

/** 裁判台在這個世界裡是夜鴉閣 —— 記錄與判定的地方。 */
const CROW_MARK = inkMark('ink-night-crow');

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
      {/* 裁判台不在觀眾的導覽序列裡,印記用「裁」而不是編號。 */}
      <ChapterHead
        number="裁"
        eyebrow="裁判台"
        title={tournament.name}
        facts={[
          { label: '代號', value: tournament.slug, mono: true },
          { label: '報名人數', value: tournament.playerCount, mono: true },
          { label: '每差一段', value: `${tournament.bpPerRankGap.toString()} BP`, mono: true },
        ]}
        aside={<InkTitle {...CROW_MARK} size="mark" />}
      />

      <PhaseTrack steps={PHASES} current={phaseKey(phase)} />

      {viewer === 'anonymous' ? (
        // 擋在門口的是一張告示,不是一個錯誤。門房的話印在紙上。
        <section className={styles.wall} aria-label="需要登入">
          <PaperCard
            kicker="夜鴉閣"
            index="JUDGES ONLY"
            headingLevel={2}
            title="下面的動作要裁判身分。"
            note="評段、抽籤、判定勝負都會進稽核紀錄,所以必須記在一個平台帳號上。"
            stamp={<SealStamp text="憑印" />}
            tilt="none"
            action={
              /* 帶回程回到這一頁。少了它,裁判登入完會落在別處,得自己找路回來 ——
                 而他按登入的時候手上正有一件事要做。登入頁提供兩種方式;
                 回程的值兩邊都會再驗一次,不是這裡說了算。 */
              <InkLink href={`/judge/login?next=/judge/${slug}`} tone="vermilion">
                登入
              </InkLink>
            }
          />
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
          ) : phase === TournamentPhase.IN_PROGRESS ? (
            <MatchList slug={slug} ranks={ranks} tournament={tournament} />
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
    case TournamentPhase.FINISHED:
      return '這一屆結束了。';
    default:
      return '這個階段沒有需要裁判操作的事。';
  }
}
