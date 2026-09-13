'use client';

import { timestampDate, type Timestamp } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  Amount,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  ChapterHead,
  type AmountTone,
} from '@theatron/ui';
import Link from 'next/link';
import { useCallback, useEffect } from 'react';

import { activityApi } from '../../lib/api/activity';
import {
  BetStatus,
  LegResult,
  type Bet,
  type BetLeg,
} from '../../lib/api/gen/hestia/activity/v1/betting_pb';
import { usePolling } from '../../lib/api/poll';

import { onBetPlaced } from './betSlipStore';
import { formatOdds, marketKindLabel } from './MarketBoard';

import styles from './MyBets.module.css';

/**
 * 我的注單:一張一張票根。
 *
 * 票根的結構直接用 Card:標頭是全大寫小字 + 右側狀態,腿在票身,
 * 底部齒孔虛線之後是金額。不另外發明一種卡。
 *
 * 每 15 秒重讀 —— 結算是別人做的事,自己看不到動作。同一頁下注成功會
 * 立刻補讀一次(betSlipStore 的廣播),不用等下一個 tick。
 */

export interface MyBetsProps {
  slug: string;
}

type Loaded = { kind: 'anonymous' } | { kind: 'ready'; bets: Bet[] };

export function MyBets({ slug }: MyBetsProps) {
  const load = useCallback(async (): Promise<Loaded> => {
    try {
      const res = await activityApi.betting.listMyBets({ tournamentSlug: slug });
      return { kind: 'ready', bets: res.bets };
    } catch (err) {
      const ce = ConnectError.from(err);
      if (ce.code === Code.Unauthenticated) return { kind: 'anonymous' };
      throw ce;
    }
  }, [slug]);
  const { data, error, reload } = usePolling(load, 15000);

  useEffect(
    () =>
      onBetPlaced(() => {
        void reload();
      }),
    [reload],
  );

  return (
    <div className={styles.page}>
      <ChapterHead number="肆" eyebrow="百業試鋒" title="我的注單" />
      {body()}
    </div>
  );

  function body() {
    if (data === null) {
      return error === null ? (
        <p className={styles.muted}>讀取注單…</p>
      ) : (
        <p className={styles.error} role="alert">
          {error}
        </p>
      );
    }
    if (data.kind === 'anonymous') {
      return (
        <div className={styles.wall}>
          <p className={styles.wallLine}>注單記在平台帳號上,先登入。</p>
          <Link
            className={styles.link}
            href={`/login?redirect=${encodeURIComponent(`/t/${slug}/bets`)}`}
          >
            登入
          </Link>
        </div>
      );
    }
    if (data.bets.length === 0) {
      return (
        <div className={styles.wall}>
          <p className={styles.wallLine}>還沒有注單。到對戰表挑一場,從賠率表加進投注單。</p>
          <Link className={styles.link} href={`/t/${slug}/bracket`}>
            對戰表
          </Link>
        </div>
      );
    }
    return (
      <ul className={styles.list}>
        {data.bets.map((bet) => (
          <li key={bet.publicId}>
            <BetTicket bet={bet} />
          </li>
        ))}
      </ul>
    );
  }
}

/** 一張票根。投注單成功後也顯示同一張,使用者在兩個地方看到的是同一個東西。 */
export function BetTicket({ bet }: { bet: Bet }) {
  const s = ticketStatus(bet);
  return (
    <Card aria-label={`注單 ${bet.publicId}`}>
      <CardHeader
        label={<span className={styles.ticketNo}>{bet.publicId}</span>}
        aside={<span className={[styles.status, styles[s.tone]].join(' ')}>{s.word}</span>}
      />
      <CardBody>
        <ul className={styles.legs}>
          {bet.legs.map((leg) => (
            <LegRow key={leg.marketPublicId} leg={leg} />
          ))}
        </ul>
      </CardBody>
      <CardFooter>
        <dl className={styles.totals}>
          <div className={styles.total}>
            <dt>本金</dt>
            <dd>
              <Amount value={bet.stake} tone="neutral" size="sm" label="本金" />
            </dd>
          </div>
          <div className={styles.total}>
            <dt>{s.payoutLabel}</dt>
            <dd>
              <Amount value={s.payoutValue} tone={s.payoutTone} label={s.payoutLabel} />
            </dd>
          </div>
        </dl>
        {bet.payoutRecalculated ? (
          <p className={styles.note}>有一腿因棄賽不成立,派彩已按其餘各腿的鎖定賠率重算。</p>
        ) : null}
        <p className={styles.when}>
          <When ts={bet.createdAt} /> 下注
          {bet.settledAt === undefined ? null : (
            <>
              {' · '}
              <When ts={bet.settledAt} /> 結算
            </>
          )}
        </p>
      </CardFooter>
    </Card>
  );
}

function LegRow({ leg }: { leg: BetLeg }) {
  const result = legResultWord(leg.result);
  return (
    <li className={styles.leg}>
      <span className={styles.legMatch}>{leg.matchLabel}</span>
      <span className={styles.legPick}>
        <span className={styles.legMarket}>{marketKindLabel(leg.kind, leg.roundNo)}</span>
        <span className={styles.legOutcome}>{leg.outcomeLabel}</span>
      </span>
      <span className={styles.legOdds}>{formatOdds(leg.oddsMilli)}</span>
      {result === null ? null : (
        <span className={[styles.legResult, styles[result.tone]].join(' ')}>{result.word}</span>
      )}
    </li>
  );
}

type Tone = 'open' | 'won' | 'lost' | 'void';

interface TicketStatus {
  word: string;
  tone: Tone;
  payoutLabel: string;
  payoutValue: bigint;
  payoutTone: AmountTone;
}

/**
 * 狀態字與金額怎麼顯示是同一件事:中了才有派彩,作廢是退本金。
 * 顏色照職責:薄荷是贏、玫瑰是輸、金色是還在路上的錢。
 */
function ticketStatus(bet: Bet): TicketStatus {
  switch (bet.status) {
    case BetStatus.WON:
      return {
        word: '中獎',
        tone: 'won',
        payoutLabel: '派彩',
        payoutValue: bet.potentialPayout,
        payoutTone: 'win',
      };
    case BetStatus.LOST:
      return {
        word: '未中',
        tone: 'lost',
        payoutLabel: '派彩',
        payoutValue: 0n,
        payoutTone: 'muted',
      };
    case BetStatus.VOID:
      return {
        word: '作廢退款',
        tone: 'void',
        payoutLabel: '退款',
        payoutValue: bet.stake,
        payoutTone: 'neutral',
      };
    default:
      return {
        word: '未結',
        tone: 'open',
        payoutLabel: '可拿',
        payoutValue: bet.potentialPayout,
        payoutTone: 'money',
      };
  }
}

/** 待定不出字:整張票已經說了「未結」,每一腿再說一次是噪音。 */
function legResultWord(r: LegResult): { word: string; tone: Tone } | null {
  switch (r) {
    case LegResult.WON:
      return { word: '中', tone: 'won' };
    case LegResult.LOST:
      return { word: '未中', tone: 'lost' };
    case LegResult.VOID:
      return { word: '不成立', tone: 'void' };
    default:
      return null;
  }
}

const whenFormat = new Intl.DateTimeFormat('zh-TW', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function When({ ts }: { ts: Timestamp | undefined }) {
  if (ts === undefined) return null;
  const d = timestampDate(ts);
  return (
    <time className={styles.mono} dateTime={d.toISOString()}>
      {whenFormat.format(d)}
    </time>
  );
}
