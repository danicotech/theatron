'use client';

import { ConnectError } from '@connectrpc/connect';
import { ChapterHead, InkLink, InkTitle, PaperCard, PhaseTrack, SealStamp } from '@theatron/ui';
import { useEffect, useState } from 'react';

import { activityApi } from '../../lib/api/activity';
import type { Tournament } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { TournamentPhase } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { PHASES, phaseKey } from '../admin/phases';
import { inkMark } from './inkMarks';

import styles from './TournamentHome.module.css';

/**
 * 一屆賽事的公開門面 —— 這個世界裡它是一張**戰帖**。
 *
 * 這一頁要回答的只有一個問題:**我現在該做什麼。** 報名期就報名,
 * 評段期就等公告,開打了就看對戰表。所以行動是隨階段換的,不是六個
 * 一直擺在那裡讓人自己判斷哪一個現在有用。
 *
 * 版面借告示牆的構圖:左邊是說給人聽的話與可以走的路,右邊是貼上去的那張紙。
 * 事實(人數、BP、階段)只長在紙上一次 —— 章節頁首不再重複同一組數字。
 */

export interface TournamentHomeProps {
  slug: string;
}

/** 戰帖的題字。查清冊而不是寫死長寬比 —— 一換圖就對不上,而對不上就是破版。 */
const WAR_LETTER = inkMark('ink-war-letter');

export function TournamentHome({ slug }: TournamentHomeProps) {
  const [t, setT] = useState<Tournament | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 進站與沒進站在畫面上長得一樣,是使用者實際回報的問題。
  // 這一支失敗就是「沒進站」,不是錯誤 —— 這一頁本來就公開。
  useEffect(() => {
    void activityApi.signup
      .getMyPlayer({})
      .then((res) => {
        setMe(res.player?.displayName ?? null);
      })
      .catch(() => {
        setMe(null);
      });
  }, []);

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
  const bracketOpen =
    t.phase === TournamentPhase.DRAWING ||
    t.phase === TournamentPhase.IN_PROGRESS ||
    t.phase === TournamentPhase.FINISHED;

  return (
    <div className={styles.page}>
      <ChapterHead number="壹" eyebrow="百業試鋒" title={t.name} />

      <PhaseTrack steps={PHASES} current={phaseKey(t.phase)} />

      {/* 告示牆的構圖:左邊正文、右邊那張紙。窄的時候紙落到正文下面 ——
          先讀「現在該做什麼」,再看細目,順序不變。 */}
      <div className={styles.layout}>
        <section className={styles.now} aria-label="現在該做什麼">
          <p className={styles.nowLine}>{nowCopy(t.phase)}</p>
          <nav className={styles.links} aria-label="這一屆的其他頁">
            {me === null ? (
              <InkLink href={`/t/${slug}/login`}>我已報名,進站</InkLink>
            ) : (
              <InkLink href={`/t/${slug}/me`}>{`我的報名(${me})`}</InkLink>
            )}
            {/* 抽籤開始就有入口:確認前是「還沒公布」的空狀態,不是 404。 */}
            {bracketOpen ? <InkLink href={`/t/${slug}/bracket`}>對戰表</InkLink> : null}
            <InkLink href={`/t/${slug}/rules`}>規則與讓武項目</InkLink>
          </nav>
        </section>

        <PaperCard
          kicker="江湖令"
          index="THE INVITATION"
          headingLevel={2}
          title={<InkTitle {...WAR_LETTER} on="paper" size="lead" />}
          rows={[
            { label: '已報名', value: `${t.playerCount.toString()} 人`, mono: true },
            { label: '每差一段', value: `${t.bpPerRankGap.toString()} BP`, mono: true },
            { label: '賽制', value: t.thirdPlaceMatch ? '單淘汰 · 有季軍戰' : '單淘汰' },
          ]}
          note="段位差決定低段位的一方拿到多少讓武 BP,他用這些 BP 對高段位的一方施加正式比賽限制。讓武不是放水 —— 受限的一方仍須全力求勝。"
          action={
            signupOpen ? (
              /* 紙上唯一的朱紅。對比修正住在 PaperCard 的 --state-live,這裡不再算一次。 */
              <InkLink href={`/t/${slug}/signup`} tone="vermilion">
                報名參賽
              </InkLink>
            ) : (
              <span className={styles.paperClosed}>報名已截止</span>
            )
          }
          stamp={<SealStamp text="試鋒" />}
          tilt="right"
        />
      </div>
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
