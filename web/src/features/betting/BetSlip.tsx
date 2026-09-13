'use client';

import { Code, ConnectError } from '@connectrpc/connect';
import { Amount, Button, formatAmount } from '@theatron/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useState } from 'react';

import { activityApi } from '../../lib/api/activity';
import type { Bet } from '../../lib/api/gen/hestia/activity/v1/betting_pb';

import {
  notifyBetPlaced,
  parlayMultiplierMilli,
  potentialPayout,
  readSlip,
  replaceOdds,
  stakeAmount,
  useBetSlip,
  type SlipState,
} from './betSlipStore';
import { formatOdds } from './MarketBoard';
import { BetTicket } from './MyBets';

import styles from './BetSlip.module.css';

/**
 * 投注單。
 *
 * 手機上是底部 sheet:收合時只剩一條 bar(`3 關 · 4.08× · 可拿 408`),拇指在
 * 螢幕下方,所有博弈 app 都把注單放底部不是因為好看。桌機上是右側 dock,
 * 由父層給它一欄,它在欄裡 sticky —— 用 fixed 會蓋住主區的內容。
 *
 * 票根的結構:各腿之間是齒孔虛線,腿與金額之間是撕線。借的是排版,不是紙的材質。
 *
 * 送出分兩步。第一步「送出注單」只是攤開總結,冪等鍵在這一刻產生;第二步
 * 「確認下注」才動錢。中間如果投注單被改了(在賠率表上換了一腿),自動退回
 * 第一步 —— 同一把冪等鍵配上不同內容,伺服器會拒絕,而那時使用者以為自己在
 * 重送同一張單。
 */

export interface BetSlipProps {
  slug: string;
}

type Stage =
  | { kind: 'edit' }
  /** sig 是進入確認那一刻的投注單指紋;內容變了就不算同一張單。 */
  | { kind: 'confirm'; key: string; sig: string; notice: string | null }
  | { kind: 'placing'; key: string; sig: string }
  | { kind: 'placed'; bet: Bet; replayed: boolean };

type Failure = { kind: 'unauthenticated' } | { kind: 'message'; text: string };

function signatureOf(state: SlipState): string {
  const legs = state.legs.map((l) => `${l.marketPublicId}:${l.outcome}:${l.oddsMilli}`);
  return `${legs.join('|')}#${state.stake}`;
}

export function BetSlip({ slug }: BetSlipProps) {
  const slip = useBetSlip(slug);
  const pathname = usePathname();
  const bodyId = useId();
  const stakeId = useId();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: 'edit' });
  const [failure, setFailure] = useState<Failure | null>(null);

  const stake = stakeAmount(slip);
  const payout = potentialPayout(stake, slip.legs);
  const multiplier = parlayMultiplierMilli(slip.legs);
  const n = slip.legs.length;
  const sig = signatureOf(slip);

  // 確認畫面攤開的是「這一張」;內容一變就不是同一張了,退回去重看。
  if (stage.kind === 'confirm' && stage.sig !== sig) {
    setStage({ kind: 'edit' });
  }

  function toConfirm(notice: string | null) {
    setFailure(null);
    setStage({
      kind: 'confirm',
      key: crypto.randomUUID(),
      sig: signatureOf(readSlip(slug)),
      notice,
    });
  }

  async function refreshOdds(matchPublicIds: string[]) {
    try {
      const res = await activityApi.betting.getOdds({ matchPublicIds });
      replaceOdds(
        slug,
        res.odds.flatMap((mo) =>
          mo.markets.flatMap((m) =>
            m.outcomes.map((o) => ({
              marketPublicId: m.marketPublicId,
              outcome: o.outcome,
              label: o.label,
              oddsMilli: o.oddsMilli,
            })),
          ),
        ),
      );
    } catch {
      // 拿不到新賠率就留著舊的。再送一次還是會被伺服器擋下,不會多扣一毛錢。
    }
  }

  async function place() {
    if (stage.kind !== 'confirm') return;
    const { key, sig: confirmedSig } = stage;
    const legs = slip.legs;
    setStage({ kind: 'placing', key, sig: confirmedSig });
    setFailure(null);
    try {
      const res = await activityApi.betting.placeBet({
        tournamentSlug: slug,
        stake,
        legs: legs.map((l) => ({ marketPublicId: l.marketPublicId, outcome: l.outcome })),
        idempotencyKey: key,
        // 伺服器拿它比對自己算的;差太多就是賠率跑了,退回來讓人再看一眼。
        expectedPayout: payout,
      });
      if (res.bet === undefined) throw new Error('伺服器沒有回注單');
      slip.clear();
      notifyBetPlaced();
      setStage({ kind: 'placed', bet: res.bet, replayed: res.replayed });
    } catch (err) {
      const ce = ConnectError.from(err);
      if (ce.code === Code.Aborted && ce.metadata.get('hestia-error-reason') === 'bet_odds_moved') {
        await refreshOdds(legs.map((l) => l.matchPublicId));
        toConfirm('賠率變了,重新確認。');
        return;
      }
      setStage({ kind: 'edit' });
      setFailure(
        ce.code === Code.Unauthenticated
          ? { kind: 'unauthenticated' }
          : { kind: 'message', text: betErrorCopy(ce) },
      );
    }
  }

  const editing = stage.kind === 'edit';
  const barText =
    n === 0
      ? '投注單是空的 · 從賠率表挑一個結果'
      : `${n} 關 · ${formatOdds(multiplier)}× · 可拿 ${formatAmount(payout)}`;

  return (
    <>
      {/* 手機上 sheet 是 fixed 的,這個空白佔住它蓋掉的那一段,頁尾才不會被壓在下面。 */}
      <div className={styles.spacer} aria-hidden="true" />
      <aside className={[styles.slip, open ? styles.open : ''].join(' ')} aria-label="投注單">
        <button
          type="button"
          className={styles.bar}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => {
            setOpen(!open);
          }}
        >
          <span className={styles.barText}>{barText}</span>
          <span className={styles.caret} aria-hidden="true" />
        </button>

        <div id={bodyId} className={styles.body}>
          <header className={styles.head}>
            <span className={styles.eyebrow}>投注單</span>
            <span className={styles.count}>{n} 關</span>
          </header>

          {stage.kind === 'placed' ? (
            <div className={styles.placed}>
              <p className={styles.done} role="status">
                {stage.replayed ? '這張注單先前已成立,沒有重複扣款。' : '注單已成立。'}
              </p>
              <BetTicket bet={stage.bet} />
              <div className={styles.placedActions}>
                <Button
                  fullWidth
                  onClick={() => {
                    setStage({ kind: 'edit' });
                  }}
                >
                  再開一張
                </Button>
                <Link className={styles.link} href={`/t/${slug}/bets`}>
                  我的注單
                </Link>
              </div>
            </div>
          ) : (
            <>
              {n === 0 ? (
                <p className={styles.empty}>
                  從賠率表挑一個結果加進來。跨場可以串關,同一場只能押一腿。
                </p>
              ) : (
                <ul className={styles.legs}>
                  {slip.legs.map((l) => (
                    <li key={l.matchPublicId} className={styles.leg}>
                      <span className={styles.legText}>
                        <span className={styles.legMarket}>{l.marketTitle}</span>
                        <span className={styles.legLabel}>{l.label}</span>
                      </span>
                      <span className={styles.legOdds}>{formatOdds(l.oddsMilli)}</span>
                      {editing ? (
                        <button
                          type="button"
                          className={styles.remove}
                          aria-label={`移除 ${l.label}`}
                          onClick={() => {
                            slip.removeLeg(l.matchPublicId);
                          }}
                        >
                          移除
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              <div className={styles.tear} aria-hidden="true" />

              <div className={styles.stakeRow}>
                <label htmlFor={stakeId} className={styles.stakeLabel}>
                  本金
                </label>
                <input
                  id={stakeId}
                  className={styles.stakeInput}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  placeholder="0"
                  value={slip.stake}
                  disabled={!editing}
                  onChange={(e) => {
                    slip.setStake(e.target.value);
                  }}
                />
              </div>

              <dl className={styles.totals}>
                <div className={styles.total}>
                  <dt>總賠率</dt>
                  <dd className={styles.mono}>{formatOdds(multiplier)}×</dd>
                </div>
                <div className={styles.total}>
                  <dt>可拿</dt>
                  <dd>
                    <Amount value={payout} label="可拿" />
                  </dd>
                </div>
              </dl>

              {failure === null ? null : failure.kind === 'unauthenticated' ? (
                <p className={styles.error} role="alert">
                  下注要平台帳號。
                  <Link className={styles.inlineLink} href={signinHref(pathname)}>
                    登入
                  </Link>
                </p>
              ) : (
                <p className={styles.error} role="alert">
                  {failure.text}
                </p>
              )}

              {stage.kind === 'edit' ? (
                <Button
                  size="lg"
                  fullWidth
                  disabled={n === 0 || stake <= 0n}
                  onClick={() => {
                    toConfirm(null);
                  }}
                >
                  送出注單
                </Button>
              ) : (
                <div className={styles.confirm}>
                  {stage.kind === 'confirm' && stage.notice !== null ? (
                    <p className={styles.notice} role="status">
                      {stage.notice}
                    </p>
                  ) : null}
                  <p className={styles.confirmLine}>
                    押 <span className={styles.mono}>{formatAmount(stake)}</span>,可拿{' '}
                    <span className={styles.mono}>{formatAmount(payout)}</span>。送出後不能取消。
                  </p>
                  <Button
                    variant="money"
                    size="lg"
                    fullWidth
                    loading={stage.kind === 'placing'}
                    onClick={() => {
                      void place();
                    }}
                  >
                    確認下注 {formatAmount(stake)}
                  </Button>
                  <Button
                    fullWidth
                    disabled={stage.kind === 'placing'}
                    onClick={() => {
                      setStage({ kind: 'edit' });
                    }}
                  >
                    回去改
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function signinHref(pathname: string): string {
  return `/login?redirect=${encodeURIComponent(pathname)}`;
}

/** 依 reason 分支,不比對訊息文字(proto/README.md)。每一句都要說得出下一步。 */
function betErrorCopy(err: ConnectError): string {
  switch (err.metadata.get('hestia-error-reason')) {
    case 'bet_closed':
    case 'market_closed':
      return '這場已封盤,不能再下注。把那一腿移掉再送。';
    case 'bet_self_bet':
      return '選手不能對自己參與的場次下注。把那一腿移掉再送。';
    case 'bet_stake_too_large':
      return '超過單筆下注上限,降低本金再送。';
    case 'bet_duplicate_match_in_parlay':
      return '同一場只能押一腿。';
    case 'bet_outcome_invalid':
      return '這個結果已不在盤口上,把那一腿移掉再送。';
    case 'insufficient_balance':
      return '代幣不足。';
    default:
      return err.message;
  }
}
