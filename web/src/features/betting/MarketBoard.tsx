'use client';

import { Code, ConnectError } from '@connectrpc/connect';
import { Button, formatAmount } from '@theatron/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { activityApi } from '../../lib/api/activity';
import { platformApi } from '../../lib/api/client';
import {
  MarketKind,
  MarketStatus,
  type MarketOdds,
  type OutcomeOdds,
} from '../../lib/api/gen/hestia/activity/v1/betting_pb';
import { usePolling } from '../../lib/api/poll';

import { useBetSlip } from './betSlipStore';

import styles from './MarketBoard.module.css';

/**
 * 一場比賽的賠率表:每個盤口一塊,每個結果一列 —— 票數、賠率、投票、加入投注單。
 *
 * 借的是運彩投注站紙本賠率單的**行列紀律**:等寬數字右對齊、細線分隔、直角欄位,
 * 所有盤口共用同一套欄寬,整張表的賠率才會排成一條直線。不是泛黃紙張。
 *
 * 賠率每 5 秒重讀。票數會動、賠率會跟著動,所以數字一律 tabular-nums:
 * 1.43 變成 1.52 的時候整欄不能左右晃。
 *
 * 投票之後先用回應裡那一個盤口蓋掉畫面,再整份重讀。回應是投完那一刻的真相,
 * 重讀是更新的真相;兩者之間不做樂觀更新 —— 賠率是錢的前身,不猜。
 */

export interface MarketBoardProps {
  slug: string;
  matchPublicId: string;
  /** Validated player side from the arena. Only highlights MATCH_WINNER. */
  selectedOutcome?: 'p1' | 'p2' | undefined;
}

/** 賠率顯示成兩位小數:1430 → 1.43。捨去不四捨五入,與派彩的整數捨去同方向。 */
export function formatOdds(oddsMilli: bigint): string {
  return formatAmount(oddsMilli / 10n, { scale: 2, grouping: false });
}

/** 盤口的名稱。契約只給 kind 與 round_no,名稱由這裡組;結果的名稱則永遠來自伺服器。 */
export function marketKindLabel(kind: MarketKind, roundNo: number): string {
  switch (kind) {
    case MarketKind.MATCH_WINNER:
      return '整場勝負';
    case MarketKind.ROUND_WINNER:
      return `第 ${roundNo} 回合勝負`;
    case MarketKind.DURATION:
      return `第 ${roundNo} 回合時長`;
    case MarketKind.SCORE:
      return '比分';
    default:
      return '盤口';
  }
}

/** 已不能動的盤口要說清楚是哪一種「不能動」:封盤是在等結果,作廢是錢會退。 */
function statusWord(m: MarketOdds): string | null {
  switch (m.status) {
    case MarketStatus.CLOSED:
      return '已封盤';
    case MarketStatus.SETTLED:
      return '已結算';
    case MarketStatus.VOID:
      return '作廢退款';
    default:
      return m.openForBets ? null : '已封盤';
  }
}

/** 整場、比分在前(一眼要看的),逐回合的盤口在後、依回合排。 */
const KIND_ORDER: Record<number, number> = {
  [MarketKind.MATCH_WINNER]: 0,
  [MarketKind.SCORE]: 1,
  [MarketKind.ROUND_WINNER]: 2,
  [MarketKind.DURATION]: 3,
};

function sortMarkets(markets: readonly MarketOdds[]): MarketOdds[] {
  return [...markets].sort((a, b) => {
    const ka = KIND_ORDER[a.kind] ?? 9;
    const kb = KIND_ORDER[b.kind] ?? 9;
    if (ka !== kb) return ka - kb;
    return a.roundNo - b.roundNo;
  });
}

type Viewer = 'loading' | 'anonymous' | 'signed-in';

export function MarketBoard({ slug, matchPublicId, selectedOutcome }: MarketBoardProps) {
  const pathname = usePathname();
  const slip = useBetSlip(slug);
  const board = useRef<HTMLElement>(null);
  const focusedSelection = useRef('');

  const load = useCallback(async () => {
    const res = await activityApi.betting.getOdds({ matchPublicIds: [matchPublicId] });
    return res.odds.find((o) => o.matchPublicId === matchPublicId)?.markets ?? [];
  }, [matchPublicId]);
  const { data, error, reload } = usePolling(load, 5000);

  useEffect(() => {
    const selection = `${matchPublicId}:${selectedOutcome ?? ''}`;
    if (!selectedOutcome || focusedSelection.current === selection) return;
    const row = board.current?.querySelector<HTMLElement>('[data-arena-selected]');
    if (!row) return;
    focusedSelection.current = selection;
    row.focus({ preventScroll: true });
    row.scrollIntoView?.({ block: 'nearest' });
  }, [data, matchPublicId, selectedOutcome]);

  // 投完票拿到的那一個盤口。重讀完成就丟掉 —— 重讀的結果至少一樣新。
  const [patch, setPatch] = useState<MarketOdds | null>(null);
  const [viewer, setViewer] = useState<Viewer>('loading');
  const [busy, setBusy] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);

  // 投票要平台帳號。沒登入的人看到的不是灰掉的按鈕,是一條通往登入的路。
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

  async function vote(market: MarketOdds, outcome: string) {
    if (busy !== null) return;
    setBusy(market.marketPublicId);
    setVoteError(null);
    try {
      const res = await activityApi.betting.vote({
        marketPublicId: market.marketPublicId,
        outcome,
      });
      if (res.odds !== undefined) setPatch(res.odds);
      void reload().then(() => {
        setPatch(null);
      });
    } catch (err) {
      const ce = ConnectError.from(err);
      if (ce.code === Code.Unauthenticated) {
        setViewer('anonymous');
      } else {
        setVoteError(voteErrorCopy(ce));
      }
    } finally {
      setBusy(null);
    }
  }

  if (error !== null && data === null) {
    return (
      <p className={styles.error} role="alert">
        {error}
      </p>
    );
  }
  if (data === null) {
    return <p className={styles.muted}>讀取賠率…</p>;
  }

  const markets = sortMarkets(
    data.map((m) => (patch !== null && patch.marketPublicId === m.marketPublicId ? patch : m)),
  );

  if (markets.length === 0) {
    return <p className={styles.muted}>這場還沒開盤。開盤後回來投票、押注。</p>;
  }

  const signinHref = `/login?redirect=${encodeURIComponent(pathname)}`;

  return (
    <section ref={board} className={styles.board} aria-label="賠率表">
      {/* 欄位標題只出現一次:各盤口共用同一套欄寬,標題在最上面就夠了。 */}
      <div className={styles.columns} aria-hidden="true">
        <span className={styles.colLabel}>賠率表</span>
        <span className={styles.colVotes}>票</span>
        <span className={styles.colOdds}>賠率</span>
      </div>

      {markets.map((m) => {
        const word = statusWord(m);
        const inert = word !== null;
        const title = marketKindLabel(m.kind, m.roundNo);
        const slipLeg = slip.legs.find((l) => l.matchPublicId === m.matchPublicId);
        return (
          <section
            key={m.marketPublicId}
            className={[styles.market, inert ? styles.inert : ''].join(' ')}
            aria-label={title}
          >
            <header className={styles.marketHead}>
              <h3 className={styles.marketTitle}>{title}</h3>
              {word === null ? null : <span className={styles.status}>{word}</span>}
            </header>
            <ul className={styles.rows}>
              {m.outcomes.map((o) => (
                <OutcomeRow
                  key={o.outcome}
                  outcome={o}
                  title={title}
                  inert={inert}
                  mine={m.myVote === o.outcome}
                  selected={m.kind === MarketKind.MATCH_WINNER && selectedOutcome === o.outcome}
                  viewer={viewer}
                  signinHref={signinHref}
                  busy={busy === m.marketPublicId}
                  onVote={() => {
                    void vote(m, o.outcome);
                  }}
                  slipState={
                    slipLeg === undefined
                      ? 'absent'
                      : slipLeg.marketPublicId === m.marketPublicId && slipLeg.outcome === o.outcome
                        ? 'this'
                        : 'other'
                  }
                  onSlip={() => {
                    if (
                      slipLeg !== undefined &&
                      slipLeg.marketPublicId === m.marketPublicId &&
                      slipLeg.outcome === o.outcome
                    ) {
                      slip.removeLeg(m.matchPublicId);
                      return;
                    }
                    slip.addLeg({
                      matchPublicId: m.matchPublicId,
                      marketPublicId: m.marketPublicId,
                      outcome: o.outcome,
                      label: o.label,
                      oddsMilli: o.oddsMilli,
                      marketTitle: title,
                    });
                  }}
                />
              ))}
            </ul>
          </section>
        );
      })}

      {voteError === null ? null : (
        <p className={styles.error} role="alert">
          {voteError}
        </p>
      )}
      {error === null ? null : <p className={styles.stale}>賠率更新失敗,顯示的是上一次的數字。</p>}
    </section>
  );
}

interface OutcomeRowProps {
  outcome: OutcomeOdds;
  title: string;
  inert: boolean;
  mine: boolean;
  selected: boolean;
  viewer: Viewer;
  signinHref: string;
  busy: boolean;
  onVote: () => void;
  /** 投注單裡這一場的腿:沒有 / 就是這個結果 / 是同場的另一個結果。 */
  slipState: 'absent' | 'this' | 'other';
  onSlip: () => void;
}

function OutcomeRow({
  outcome,
  title,
  inert,
  mine,
  selected,
  viewer,
  signinHref,
  busy,
  onVote,
  slipState,
  onSlip,
}: OutcomeRowProps) {
  const name = `${title} ${outcome.label}`;
  return (
    <li
      className={[styles.row, mine ? styles.mine : '', selected ? styles.selected : ''].join(' ')}
      data-arena-selected={selected ? '' : undefined}
      tabIndex={selected ? -1 : undefined}
      aria-label={selected ? `${name}，首頁所選選手` : undefined}
    >
      <span className={styles.label}>
        {outcome.label}
        {selected ? <small className={styles.selectionWord}>首頁所選</small> : null}
      </span>
      <span className={styles.votes}>{outcome.votes}</span>
      <span className={styles.odds}>{formatOdds(outcome.oddsMilli)}</span>
      {inert ? null : (
        <div className={styles.actions}>
          {viewer === 'anonymous' ? (
            <Link className={styles.signin} href={signinHref}>
              登入後投票
            </Link>
          ) : (
            <Button
              size="sm"
              aria-pressed={mine}
              aria-label={`投 ${name}`}
              disabled={busy}
              onClick={onVote}
            >
              {mine ? '已投' : '投票'}
            </Button>
          )}
          {/* 一場只能一腿(伺服器規則)。同場已有別的結果時按鈕直說「換成這個」,
              不讓人以為是加了第二腿。 */}
          <Button
            size="sm"
            aria-pressed={slipState === 'this'}
            aria-label={`${slipCopy(slipState)} ${name}`}
            onClick={onSlip}
          >
            {slipCopy(slipState)}
          </Button>
        </div>
      )}
      {mine && inert ? <span className={styles.mineWord}>我投了這個</span> : null}
    </li>
  );
}

function slipCopy(state: 'absent' | 'this' | 'other'): string {
  switch (state) {
    case 'this':
      return '從投注單移除';
    case 'other':
      return '換成這個';
    default:
      return '加入投注單';
  }
}

function voteErrorCopy(err: ConnectError): string {
  switch (err.metadata.get('hestia-error-reason')) {
    case 'vote_closed':
      return '這場已不開放投票。';
    case 'bet_outcome_invalid':
      return '這個結果已不在盤口上,賠率表會在下一次更新時修正。';
    default:
      return err.message;
  }
}
