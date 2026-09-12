'use client';

import { ConnectError } from '@connectrpc/connect';
import { PhaseTrack } from '@theatron/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { activityApi } from '../../lib/api/activity';
import type { Tournament } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { TournamentPhase } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { PHASES, phaseKey } from '../admin/phases';

import styles from './TournamentHome.module.css';

/**
 * 一屆賽事的公開門面。
 *
 * 這一頁要回答的只有一個問題:**我現在該做什麼。** 報名期就報名,
 * 評段期就等公告,開打了就看對戰表。所以行動是隨階段換的,不是六個
 * 一直擺在那裡讓人自己判斷哪一個現在有用。
 */

export interface TournamentHomeProps {
  slug: string;
}

export function TournamentHome({ slug }: TournamentHomeProps) {
  const [t, setT] = useState<Tournament | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void activityApi.tournament
      .getTournament({ slug })
      .then((res) => {
        setT(res.tournament ?? null);
      })
      .catch((err: unknown) => {
        setError(ConnectError.from(err).message);
      });
  }, [slug]);

  if (error !== null) {
    return (
      <p className={styles.error} role="alert">
        {error}
      </p>
    );
  }
  if (t === null) {
    return <p className={styles.loading}>讀取賽事…</p>;
  }

  const signupOpen = t.phase === TournamentPhase.SIGNUP;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>百業試鋒</p>
        <h1 className={styles.title}>{t.name}</h1>
        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>已報名</dt>
            <dd className={styles.mono}>{t.playerCount}</dd>
          </div>
          <div className={styles.fact}>
            <dt>每差一段</dt>
            <dd className={styles.mono}>{t.bpPerRankGap.toString()} BP</dd>
          </div>
        </dl>
      </header>

      <PhaseTrack steps={PHASES} current={phaseKey(t.phase)} />

      <section className={styles.now} aria-label="現在該做什麼">
        <p className={styles.nowLine}>{nowCopy(t.phase)}</p>
        <div className={styles.links}>
          {signupOpen ? (
            <Link className={styles.primary} href={`/t/${slug}/signup`}>
              報名參賽
            </Link>
          ) : null}
          <Link className={styles.link} href={`/t/${slug}/login`}>
            我已報名,進站
          </Link>
          <Link className={styles.link} href={`/t/${slug}/rules`}>
            規則與讓武項目
          </Link>
        </div>
      </section>
    </div>
  );
}

/** 每個階段只講一件事:現在在等什麼、你能做什麼。空狀態是邀請,不是道歉。 */
function nowCopy(phase: TournamentPhase): string {
  switch (phase) {
    case TournamentPhase.SIGNUP:
      return '報名開著。填一個遊戲ID 就算報名,其餘欄位是給御風羽評段用的材料。';
    case TournamentPhase.SIGNUP_CLOSED:
      return '報名已截止。御風羽正在逐人評定段位。';
    case TournamentPhase.RANKING:
      return '評段中。段位會在抽籤之前一次公布,有異議可以在那之後提。';
    case TournamentPhase.RANKED:
      return '段位已公布。有異議請在抽籤前向御風羽提 —— 抽籤之後就不能改了。';
    case TournamentPhase.DRAWING:
      return '抽籤中。對戰表確認後就會公布。';
    case TournamentPhase.IN_PROGRESS:
      return '比賽進行中。低段位的一方在開賽前用 BP 選讓武,封盤後雙方與觀眾都看得到。';
    case TournamentPhase.FINISHED:
      return '這一屆已經結束。';
    default:
      return '這一屆還沒開始。';
  }
}
