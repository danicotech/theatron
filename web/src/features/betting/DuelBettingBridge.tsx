'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpTip } from '../chrome/HelpTip';
import { BetSlip } from './BetSlip';
import { ArenaMarkets } from './ArenaMarkets';
import { MyBets } from './MyBets';
import styles from './DuelBettingBridge.module.css';

type Panel = { kind: 'bets' } | { kind: 'markets'; matchId: string; outcome?: 'p1' | 'p2' };
type Context = { matchId?: string; p1?: string; p2?: string };

/** Formal API data only. The lab owns match selection; this window owns betting UI. */
export function DuelBettingBridge() {
  const slug = (process.env.NEXT_PUBLIC_TOURNAMENT_SLUG ?? '').trim();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const context = useRef<Context>({});

  useEffect(() => {
    setHost(document.body);
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const query = new URLSearchParams(location.search);
    let pending = query.get('panel');
    if (pending === 'markets' && !query.get('match')) {
      setPanel({ kind: 'markets', matchId: '' });
      pending = null;
    }
    if (pending === 'bets') {
      setPanel({ kind: 'bets' });
      pending = null;
    }
    document.addEventListener(
      'lunjian:duel-context',
      (event) => {
        const current = (event as CustomEvent<Context>).detail;
        context.current = current;
        if (
          pending === 'markets' &&
          current.matchId &&
          (!query.get('match') || query.get('match') === current.matchId)
        ) {
          const player = query.get('player');
          setPanel({
            kind: 'markets',
            matchId: current.matchId,
            ...(player === current.p1
              ? { outcome: 'p1' }
              : player === current.p2
                ? { outcome: 'p2' }
                : {}),
          });
          pending = null;
        }
      },
      options,
    );
    document.addEventListener(
      'click',
      (event) => {
        if (!(event.target instanceof Element)) return;
        const button = event.target.closest<HTMLElement>(
          '[data-duel-my-bets],[data-duel-markets],[data-duel-lobby]',
        );
        if (!button || button.hasAttribute('data-duel-center')) return;
        trigger.current = button;
        event.preventDefault();
        if (button.hasAttribute('data-duel-lobby'))
          setPanel({ kind: 'markets', matchId: context.current.matchId || '' });
        else if (button.hasAttribute('data-duel-my-bets')) setPanel({ kind: 'bets' });
        else if (
          button.dataset.duelMarkets &&
          button.dataset.duelMarkets === context.current.matchId
        ) {
          const side = button.dataset.outcome;
          setPanel({
            kind: 'markets',
            matchId: button.dataset.duelMarkets,
            ...(side === 'p1' || side === 'p2' ? { outcome: side } : {}),
          });
        }
      },
      options,
    );
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!panel || !dialog.current) return;
    const node = dialog.current;
    node.showModal();
    node.querySelector<HTMLButtonElement>('[aria-label="關閉注單視窗"]')?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Lab chapter shortcuts must not switch the stage while a window has focus.
    const keys = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') event.stopPropagation();
    };
    node.addEventListener('keydown', keys);
    return () => {
      node.removeEventListener('keydown', keys);
      node.close();
      document.body.style.overflow = previousOverflow;
      const target = trigger.current?.isConnected
        ? trigger.current
        : document.querySelector<HTMLElement>('[data-duel-lobby]');
      target?.focus({ preventScroll: true });
    };
  }, [!!panel, host]);

  function close() {
    setPanel(null);
    const url = new URL(location.href);
    url.searchParams.delete('panel');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }
  if (!host || !panel) return null;
  const returnTo =
    panel.kind === 'bets'
      ? '/?panel=bets#duel'
      : `/?${panel.matchId ? 'match=' + encodeURIComponent(panel.matchId) + '&' : ''}panel=markets#duel`;
  return createPortal(
    <dialog
      ref={dialog}
      data-panel={panel.kind}
      className={styles.window}
      aria-labelledby="arena-bets-title"
      onCancel={close}
    >
      <header className={styles.header}>
        <h2 id="arena-bets-title">
          觀局雅集
          <HelpTip
            label={panel.kind === 'bets' ? '觀局紀錄' : '觀局雅集'}
            text={
              panel.kind === 'bets'
                ? '此處與會員專區顯示同一份已成立注單，結算後會自動更新。'
                : '從賠率表挑一個結果加進來。跨場可以串關，同一場只能押一腿。'
            }
          />
        </h2>
        <button type="button" className={styles.close} onClick={close} aria-label="關閉注單視窗">
          ×
        </button>
      </header>
      <div className={styles.content}>
        <nav className={styles.actions} aria-label="觀局功能">
          <button
            type="button"
            aria-pressed={panel.kind === 'markets'}
            onClick={() => setPanel({ kind: 'markets', matchId: context.current.matchId || '' })}
          >
            選場下注
          </button>
          <button
            type="button"
            aria-pressed={panel.kind === 'bets'}
            onClick={() => setPanel({ kind: 'bets' })}
          >
            觀局紀錄
          </button>
        </nav>
        {!slug ? (
          <p role="status">賽事尚未設定。</p>
        ) : panel.kind === 'bets' ? (
          <MyBets
            slug={slug}
            embedded
            onBetting={() => setPanel({ kind: 'markets', matchId: context.current.matchId || '' })}
            returnTo={returnTo}
          />
        ) : (
          <>
            <div className={styles.markets}>
              <ArenaMarkets
                slug={slug}
                matchId={panel.matchId}
                onMatch={(matchId) => {
                  context.current = { matchId };
                  setPanel({ kind: 'markets', matchId });
                }}
                selectedOutcome={panel.outcome}
                returnTo={returnTo}
              />
              <BetSlip
                slug={slug}
                onMyBets={() => setPanel({ kind: 'bets' })}
                returnTo={returnTo}
              />
            </div>
          </>
        )}
      </div>
    </dialog>,
    host,
  );
}
