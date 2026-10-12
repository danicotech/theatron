'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  defaultSnapshot,
  marketOdds,
  money,
  oddsText,
  payout,
  settlementPreview,
  uid,
} from './engine';
import {
  discordLocal,
  execute,
  loginLocal,
  readState,
  register,
  saveSession,
  session,
  subscribe,
} from './database';
import type { Command, Leg, Market, Match, Prize, Snapshot, State, Tournament } from './model';
import styles from './Sportsbook.module.css';
import { MatchTools } from './MatchTools';
import { ParticipantBp } from './ParticipantBp';
import { Participation, EnrollmentAdmin } from './Participation';
import { ManagerOperations } from './ManagerOperations';
import { MyCeremonyPrizes } from './MyCeremonyPrizes';
import { commandFeedback, confirmLabel, isDangerous } from './interaction';
import { combinations, exactOdds, singlesQuote, ticketQuote } from './tickets';

export function Modal({
  title,
  children,
  onClose,
  wide = false,
  paper = false,
  dossier = false,
  busy = false,
  alert = false,
  returnFocus,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  paper?: boolean;
  dossier?: boolean;
  busy?: boolean;
  alert?: boolean;
  returnFocus?: () => HTMLElement | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const scrollMotion = useRef<Animation[]>([]);
  const closing = useRef(false);
  const backdropDown = useRef(false);
  const animateScroll = (reverse = false) => {
    const d = ref.current;
    if (!paper || !d?.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
      return null;
    scrollMotion.current.forEach((a) => a.cancel());
    const distance = Math.max(0, d.clientHeight - 92);
    const frames = [{ clipPath: `inset(0 0 ${distance}px 0)` }, { clipPath: 'inset(0 0 0px 0)' }];
    const rollFrames = [
      { transform: `translateY(-${distance}px)` },
      { transform: 'translateY(0px)' },
    ];
    const options = {
      duration: reverse ? 380 : 560,
      easing: 'cubic-bezier(.22,.61,.36,1)',
      fill: 'both' as FillMode,
    };
    const motion = d.animate(reverse ? [...frames].reverse() : frames, options);
    const roller = d.lastElementChild!.animate(
      reverse ? [...rollFrames].reverse() : rollFrames,
      options,
    );
    scrollMotion.current = [motion, roller];
    return motion;
  };
  const close = () => {
    if (busy || closing.current) return;
    closing.current = true;
    const motion = animateScroll(true);
    if (motion) motion.onfinish = onClose;
    else onClose();
  };
  useEffect(() => {
    const d = ref.current!,
      owner = d.parentElement,
      previous = document.activeElement as HTMLElement | null;
    d.showModal();
    closing.current = false;
    animateScroll();
    return () => {
      scrollMotion.current.forEach((a) => a.cancel());
      d.close();
      if (previous?.isConnected) previous.focus();
      else (returnFocus?.() || owner?.querySelector<HTMLElement>('main'))?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`${styles.modal} ${wide ? styles.wide : ''} ${paper ? styles.paper : ''} ${dossier ? styles.dossierModal : ''}`}
      role={alert ? 'alertdialog' : 'dialog'}
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        close();
      }}
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        backdropDown.current =
          (paper || dossier) &&
          e.target === e.currentTarget &&
          (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
      }}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        if (
          backdropDown.current &&
          e.target === e.currentTarget &&
          (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        )
          close();
        backdropDown.current = false;
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {paper && (
        <div className={styles.scrollRod} aria-hidden="true">
          <div className={styles.scrollAxle} />
          <div className={styles.scrollRoll}>
            <div className={styles.scrollEnd} />
            <div className={styles.scrollEnd} />
          </div>
        </div>
      )}
      <header>
        <h2 id={titleId}>{title}</h2>
        <button type="button" aria-label="關閉視窗" disabled={busy} onClick={close}>
          {paper ? '返回' : '×'}
        </button>
      </header>
      <fieldset disabled={busy} className={styles.modalBody}>
        {children}
      </fieldset>
      {paper && (
        <div className={styles.scrollRod} aria-hidden="true">
          <div className={styles.scrollAxle} />
          <div className={styles.scrollRoll}>
            <div className={styles.scrollEnd} />
            <div className={styles.scrollEnd} />
          </div>
        </div>
      )}
    </dialog>
  );
}
const val = (f: FormData, key: string) => {
  const value = f.get(key);
  return typeof value === 'string' ? value : '';
};
const date = (time: number) => new Date(time).toLocaleString('zh-TW');
const statusText: Record<string, string> = {
  open: '可下注',
  closed: '已封盤',
  settled: '已結算',
  void: '作廢退款',
  won: '中獎',
  lost: '未中獎',
  partial: '部分作廢退款',
  pending: '待審核',
  approved: '已核准',
  delivered: '已發放',
  cancelled: '已取消',
  upcoming: '比賽前',
  live: '比賽中',
  done: '已結束',
};
function combinationText(legs: Leg[], markets: Market[]) {
  const results = legs.map((l) => {
    const m = markets.find((m) => m.id === l.marketId);
    return m?.status === 'void'
      ? 'void'
      : m?.status === 'settled'
        ? m.result === l.outcome
          ? 'won'
          : 'lost'
        : 'pending';
  });
  return results.includes('lost')
    ? '未中獎'
    : results.includes('pending')
      ? '待結果'
      : results.every((x) => x === 'void')
        ? '全部作廢，退本組本金'
        : '中獎';
}
function oddInput(text: string) {
  if (!/^\d+(\.\d{1,3})?$/.test(text)) throw new Error('賠率請填數字，最多三位小數。');
  const [a, b = ''] = text.split('.');
  return String(BigInt(a!) * 1000n + BigInt(b.padEnd(3, '0')));
}
function eventHref(e: Tournament, m: Match) {
  return `/?preview=1&stage=3d&sportsEvent=${encodeURIComponent(e.id)}&match=${encodeURIComponent(m.id)}#duel`;
}
function participationRestriction(event: Tournament | undefined, userId: string, market: Market) {
  const playerId = event?.links[userId];
  if (!playerId) return '';
  if (market.kind === 'place') return '參賽者不能投注本屆名次盤。';
  const match = event.matches.find((m) => m.id === market.matchId);
  return match && [match.p1, match.p2].includes(playerId)
    ? '不能投注自己參與的場次。可切換其他場次觀局。'
    : '';
}
type Props = {
  sourceSnapshot?: Snapshot | undefined;
  initialEventId?: string | undefined;
  initialMatchId?: string | undefined;
  initialOutcome?: string | undefined;
  embedded?: boolean | undefined;
  registrationOnly?: boolean | undefined;
  scrollForm?: boolean;
  onRegistrationReady?: ((ready: boolean) => void) | undefined;
  memberOnly?: boolean;
  authPurpose?: 'loadout' | undefined;
};
export function Sportsbook({
  sourceSnapshot,
  initialEventId = '',
  initialMatchId = '',
  initialOutcome = '',
  embedded = false,
  registrationOnly = false,
  scrollForm = false,
  onRegistrationReady,
  memberOnly = false,
  authPurpose,
}: Props) {
  const [state, setState] = useState<State>(),
    [userId, setUserId] = useState(''),
    [eventId, setEventId] = useState(initialEventId),
    [matchId, setMatchId] = useState(initialMatchId);
  const [tab, setTab] = useState(
      memberOnly ? '會員總覽' : registrationOnly ? '我的參賽' : '投注區',
    ),
    [notice, setNotice] = useState(''),
    [failure, setFailure] = useState(''),
    [busy, setBusy] = useState(false),
    [lastAction, setLastAction] = useState<Command | null>(null),
    [auth, setAuth] = useState(false),
    [authMode, setAuthMode] = useState('登入');
  const [managerAccess, setManagerAccess] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const pendingRegistrationConsent = useRef('');
  const [registrationConsent, setRegistrationConsent] = useState<{
    eventId: string;
    userId: string;
  } | null>(null);
  useEffect(() => {
    setManagerAccess(new URLSearchParams(location.search).get('mode') === 'manage');
  }, []);
  const [independent, setIndependent] = useState(true);
  const [sizes, setSizes] = useState<number[] | null>(null),
    [pack, setPack] = useState(false),
    [oddsPolicy, setOddsPolicy] = useState<'strict' | 'higher'>('strict');
  const [legs, setLegs] = useState<Leg[]>([]),
    [stake, setStake] = useState(''),
    [slipOpen, setSlipOpen] = useState(false),
    [draftReady, setDraftReady] = useState('');
  const [slipSettings, setSlipSettings] = useState(false);
  const [marketGroup, setMarketGroup] = useState('match');
  const [dossierPlayer, setDossierPlayer] = useState('');
  const [demoDossiers, setDemoDossiers] = useState<{
    profiles: {
      build?: { name: string; image: string; familyImage: string };
      title: string;
      rank: string;
      epithet: string;
      mainArt: string;
      weapons: string;
      bpReceived: { name: string; target: string; cost: number; effect: string }[];
      sections: {
        title: string;
        kind: string;
        items: { name: string; image: string; note: string; stats: [string, string][] }[];
      }[];
    }[];
  } | null>(null);
  useEffect(() => {
    if (!dossierPlayer) return;
    const controller = new AbortController();
    fetch('/lunjian/dossier-demo.json', { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('load');
        return r.json();
      })
      .then((data: NonNullable<typeof demoDossiers>) => {
        if (Array.isArray(data.profiles)) setDemoDossiers(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [dossierPlayer]);
  useEffect(() => {
    // Returning to a board starts with its choices visible, without discarding the draft.
    setSlipOpen(false);
  }, [tab, eventId, marketGroup]);
  const [slipFits, setSlipFits] = useState(false);
  const [slipError, setSlipError] = useState('');
  const slipErrorRef = useRef<HTMLParagraphElement>(null);
  const slipRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const focusMatch = useRef(false);
  useEffect(() => {
    if (focusMatch.current && tab === '投注區' && marketGroup === 'match') {
      focusMatch.current = false;
      mainRef.current?.focus();
      mainRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }, [tab, matchId]);
  useEffect(() => {
    if (slipError) slipErrorRef.current?.focus();
  }, [slipError]);
  useEffect(() => {
    setSlipError('');
  }, [userId, eventId]);
  const stateLoaded = !!state;
  useEffect(() => {
    const panel = slipRef.current;
    if (!panel) return;
    const measure = () =>
      setSlipFits(panel.getBoundingClientRect().height <= window.innerHeight - 40);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(panel);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [stateLoaded, tab]);
  const [confirm, setConfirm] = useState<{
      command: Command;
      key: string;
      title: string;
      description: string;
      details?: string[];
    } | null>(null),
    [editMarket, setEditMarket] = useState<string | null>(null),
    [editMatch, setEditMatch] = useState<string | null>(null),
    [editPrize, setEditPrize] = useState<Prize | null>(null);
  const marketErrorRef = useRef<HTMLParagraphElement>(null);
  const matchErrorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (failure && editMarket) marketErrorRef.current?.focus();
  }, [failure, editMarket]);
  useEffect(() => {
    if (failure && editMatch) matchErrorRef.current?.focus();
  }, [failure, editMatch]);
  const alive = useRef(true),
    readVersion = useRef(0),
    pending = useRef(false);
  const refresh = useCallback(async () => {
    const v = ++readVersion.current;
    try {
      const s = await readState();
      if (alive.current && v === readVersion.current) setState(s);
    } catch (e) {
      if (alive.current) setFailure(e instanceof Error ? e.message : '資料讀取失敗。');
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    setUserId(session());
    void refresh();
    const off = subscribe(() => void refresh());
    const focus = () => {
      setUserId(session());
      void refresh();
    };
    window.addEventListener('focus', focus);
    window.addEventListener('lunjian:sports-session', focus);
    return () => {
      alive.current = false;
      off();
      window.removeEventListener('focus', focus);
      window.removeEventListener('lunjian:sports-session', focus);
    };
  }, [refresh]);
  const current = state?.members.find((u) => u.id === userId && !u.anonymous),
    event = state?.events.find((e) => e.id === eventId),
    selected = event?.matches.find((m) => m.id === matchId);
  useEffect(() => {
    onRegistrationReady?.(!!state || !!failure);
  }, [state, failure, onRegistrationReady]);
  useEffect(() => {
    if (embedded || registrationOnly) return;
    const query = new URLSearchParams(location.search);
    if (query.get('event')) setEventId(query.get('event')!);
    if (query.get('tab') === 'participation') setTab('我的參賽');
    if (query.get('mode') === 'manage') setTab('管理');
  }, [embedded, registrationOnly]);
  useEffect(() => {
    if (state?.members.some((u) => u.id === userId && u.anonymous)) {
      saveSession('');
      setUserId('');
      setNotice('已切回檢視模式；報名與投注請使用會員帳號。舊試玩資料已保留。');
    }
  }, [state, userId]);
  useEffect(() => {
    if (!eventId && !sourceSnapshot && state?.events.length) setEventId(state.events.at(-1)!.id);
  }, [eventId, sourceSnapshot, state]);
  useEffect(() => {
    if (event && !event.matches.some((m) => m.id === matchId))
      setMatchId(
        event.matches.find((m) => !m.bye && m.status !== 'done')?.id || event.matches[0]?.id || '',
      );
  }, [event, matchId]);
  useEffect(() => {
    if (embedded && event)
      document.dispatchEvent(
        new CustomEvent('lunjian:sports-select', { detail: { eventId: event.id } }),
      );
  }, [embedded, event]);
  useEffect(() => {
    if (!state || !confirm || confirm.command.type !== 'ticket' || busy) return;
    const quoted = confirm.command.legs;
    const changed = quoted.some((l) => {
      const m = state.markets.find((m) => m.id === l.marketId);
      const live = m ? marketOdds(m)[l.outcome] : undefined;
      return (
        !m ||
        m.status !== 'open' ||
        !live ||
        (live !== l.odds &&
          !(
            confirm.command.type === 'ticket' &&
            confirm.command.oddsPolicy === 'higher' &&
            BigInt(live) >= BigInt(l.odds)
          ))
      );
    });
    if (!changed) return;
    setLegs(
      quoted.map((l) => {
        const m = state.markets.find((m) => m.id === l.marketId);
        return m ? { ...l, odds: marketOdds(m)[l.outcome] || l.odds } : l;
      }),
    );
    setConfirm(null);
    setSlipOpen(true);
    setFailure('');
    setSlipError('盤口或賠率已更新，摘要已重算；請檢查注單並重新確認。');
  }, [state, confirm, busy]);
  const draftKey = `lunjian-sports-slip:${userId}:${eventId}`;
  useEffect(() => {
    setConfirm(null);
    setSlipSettings(false);
    setSlipOpen(false);
    setDraftReady('');
    setSizes(null);
    setIndependent(true);
    setPack(false);
    setOddsPolicy('strict');
    setLegs([]);
    setStake('');
    if (userId && eventId) {
      try {
        const saved = JSON.parse(localStorage.getItem(draftKey) || 'null') as {
          legs?: Leg[];
          stake?: string;
          sizes?: number[];
          pack?: boolean;
          independent?: boolean;
          oddsPolicy?: string;
        } | null;
        if (
          Array.isArray(saved?.legs) &&
          saved.legs.length <= 64 &&
          saved.legs.every(
            (l) =>
              typeof l.marketId === 'string' &&
              typeof l.outcome === 'string' &&
              /^\d+$/.test(l.odds) &&
              typeof l.label === 'string',
          )
        ) {
          setLegs(saved.legs);
          setIndependent(saved.independent !== false);
          setPack(saved.pack === true);
          setOddsPolicy(saved.oddsPolicy === 'higher' ? 'higher' : 'strict');
          if (
            Array.isArray(saved.sizes) &&
            saved.sizes.every((n) => Number.isInteger(n) && n >= 1 && n <= 12)
          )
            setSizes(saved.sizes);
          setStake(/^\d*$/.test(saved.stake || '') ? saved.stake || '' : '');
        }
      } catch {
        /* A damaged draft never affects committed funds. */
      }
    }
    setDraftReady(draftKey);
  }, [userId, eventId, draftKey]);
  useEffect(() => {
    if (draftReady !== draftKey || !userId || !eventId) return;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ legs, stake, sizes, pack, oddsPolicy, independent }),
      );
    } catch {
      setNotice('注單草稿無法儲存；已成立的交易仍保存在本機資料庫。');
    }
  }, [legs, stake, sizes, pack, oddsPolicy, independent, draftKey, draftReady, userId, eventId]);
  function rememberMode(manage: boolean) {
    if (embedded) return;
    const url = new URL(location.href);
    if (manage) url.searchParams.set('mode', 'manage');
    else url.searchParams.delete('mode');
    url.searchParams.delete('tab');
    history.replaceState(null, '', url);
  }
  function chooseEvent(id: string) {
    setEventId(id);
    setConfirm(null);
    setEditMatch(null);
    setEditMarket(null);
    if (!embedded) {
      const url = new URL(location.href);
      if (id) url.searchParams.set('event', id);
      else url.searchParams.delete('event');
      for (const key of ['arts', 'artsUser']) url.searchParams.delete(key);
      history.replaceState(null, '', url);
    }
  }
  async function run(command: Command, key = uid()): Promise<boolean> {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setFailure('');
    setNotice('');
    setLastAction(command);
    try {
      const result = await execute(command, key);
      if (!alive.current) return true;
      if (command.type === 'create' || command.type === 'activity-create') {
        chooseEvent(result);
        rememberMode(true);
        setMatchId(initialMatchId);
        setTab('管理');
      }
      if (command.type === 'ticket') {
        setLegs([]);
        setStake('');
        setTab('我的注單');
      }
      await refresh();
      setNotice(commandFeedback(command));
      return true;
    } catch (e) {
      if (alive.current) setFailure(e instanceof Error ? e.message : '操作失敗。');
      if (command.type === 'ticket') await refresh();
      return false;
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function ask(command: Command, title: string, description: string, details?: string[]) {
    setFailure('');
    setConfirm({ command, title, description, key: uid(), ...(details ? { details } : {}) });
  }
  function add(m: Market, outcome: string) {
    setSlipError('');
    if (!current) {
      setAuth(true);
      return;
    }
    const restriction = participationRestriction(event, userId, m);
    if (restriction) {
      setSlipError(restriction);
      return;
    }
    const quote = marketOdds(m)[outcome]!;
    const next: Leg = {
      marketId: m.id,
      outcome,
      odds: quote,
      label: `${m.matchId ? m.matchId + ' · ' : ''}${m.title} · ${m.options.find((o) => o.id === outcome)!.label}`,
    };
    setConfirm(null);
    setSizes(null);
    setLegs((old) => {
      if (old.some((l) => l.marketId === m.id && l.outcome === outcome))
        return old.filter((l) => !(l.marketId === m.id && l.outcome === outcome));
      if (independent) {
        const kept = old.filter((l) => l.marketId !== m.id);
        if (kept.length >= 64) {
          setFailure('最多同時選擇 64 個盤口。');
          return old;
        }
        return [...kept, next];
      }
      if (m.kind === 'place') return [next];
      const valid = old.filter((l) => {
        const previous = state!.markets.find((p) => p.id === l.marketId);
        return (
          previous &&
          previous.kind !== 'place' &&
          (previous.matchId !== m.matchId || (pack && previous.id === m.id))
        );
      });
      if (new Set([...valid, next].map((l) => l.marketId)).size > 12 || valid.length >= 64) {
        setFailure('最多 12 場、64 個包牌選項。');
        return old;
      }
      return [...valid, next];
    });
  }
  function refreshQuotes() {
    if (!state) return;
    setLegs((old) =>
      old.map((l) => {
        const m = state.markets.find((m) => m.id === l.marketId);
        return m ? { ...l, odds: marketOdds(m)[l.outcome] || l.odds } : l;
      }),
    );
    setConfirm(null);
    setNotice('已更新賠率，請重新確認注單。');
  }
  const matchCount = new Set(
    legs.map((l) => state?.markets.find((m) => m.id === l.marketId)?.matchId || l.marketId),
  ).size;
  const selectedSizes = sizes ?? (matchCount ? [matchCount] : []);
  let quote: ReturnType<typeof ticketQuote> | undefined;
  let quoteError = '';
  let selectedCombinations: Leg[][] = [];
  try {
    if (state && legs.length)
      selectedCombinations = independent
        ? legs.map((l) => [l])
        : combinations(state.markets, legs, selectedSizes);
    if (state && legs.length && stake)
      quote = independent
        ? singlesQuote(state.markets, legs, stake)
        : ticketQuote(state.markets, legs, selectedSizes, stake);
  } catch (e) {
    quoteError = (e as Error).message;
  }
  const quoteTotal = quote?.maximum || '0';
  function checkBet() {
    if (!event || !current || !state) return;
    setSlipError('');
    try {
      const q = independent
        ? singlesQuote(state.markets, legs, stake)
        : ticketQuote(state.markets, legs, selectedSizes, stake);
      if (BigInt(q.cost) > BigInt(current.balance)) throw new Error('可用點數不足。');
      for (const l of legs) {
        const m = state.markets.find((m) => m.id === l.marketId),
          live = m ? marketOdds(m)[l.outcome] : undefined;
        if (!m || m.status !== 'open') throw new Error('注單包含已封盤的選項，請移除。');
        const restriction = participationRestriction(event, userId, m);
        if (restriction) throw new Error(restriction);
        if (
          !live ||
          (live !== l.odds && !(oddsPolicy === 'higher' && BigInt(live) >= BigInt(l.odds)))
        ) {
          refreshQuotes();
          throw new Error('賠率已更新，請再次檢查注單。');
        }
      }
      ask(
        {
          type: 'ticket',
          independent,
          userId,
          eventId,
          unitStake: stake,
          legs,
          sizes: selectedSizes,
          oddsPolicy,
        },
        '確認本機下注',
        `${independent ? '各盤獨立建單、獨立結算。' : ''}每組 ${money(stake)} 點 × ${q.count} 組，總本金 ${money(q.cost)} 點。${q.count === 1 ? '總賠率 ' + exactOdds(legs) + ' 倍。' : ''}${independent ? '各筆全中返還合計（可能無法同時命中）' : '最高返還'} ${money(q.maximum)} 點（含本金），最高淨損益 ${money(String(BigInt(q.maximum) - BigInt(q.cost)))} 點。${oddsPolicy === 'higher' ? '允許成交時採較高賠率。' : '不接受賠率變動。'}確認後不可撤回。`,
      );
    } catch (e) {
      setSlipError((e as Error).message);
    }
  }
  const activeMarket = state?.markets.find((m) => m.id === editMarket),
    activeMatch = event?.matches.find((m) => m.id === editMatch);
  const marketLineLocked =
    !!activeMarket &&
    !!state?.bets.some((bet) => bet.legs.some((leg) => leg.marketId === activeMarket.id));
  const name = (id: string) => event?.players.find((p) => p.id === id)?.name || '待前場勝者';
  async function authentication(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending.current) return;
    const f = new FormData(e.currentTarget);
    pending.current = true;
    setBusy(true);
    setFailure('');
    try {
      const id =
        authMode === '註冊'
          ? await register(val(f, 'login'), val(f, 'password'), val(f, 'nickname'))
          : authMode === 'Discord 模擬'
            ? await discordLocal(val(f, 'discord'), val(f, 'nickname'))
            : await loginLocal(val(f, 'login'), val(f, 'password'));
      if (!alive.current) return;
      if (pendingRegistrationConsent.current) {
        setRegistrationConsent({ eventId: pendingRegistrationConsent.current, userId: id });
        pendingRegistrationConsent.current = '';
      }
      saveSession(id);
      setUserId(id);
      setAuth(false);
      await refresh();
      if (alive.current) setNotice('已登入本機試玩會員。');
    } catch (e) {
      if (alive.current) setFailure((e as Error).message);
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const authenticationForm = (
    <>
      <div className={styles.actions}>
        {(managerAccess ? ['登入', '註冊', 'Discord 模擬'] : ['登入', '註冊']).map((x) => (
          <button
            key={x}
            aria-pressed={authMode === x}
            onClick={() => {
              setAuthMode(x);
              setFailure('');
            }}
          >
            {x}
          </button>
        ))}
      </div>
      <p>僅在此瀏覽器試玩，請勿輸入真實服務的密碼。新會員獲得 1,000 點一次。</p>
      <form onSubmit={(e) => void authentication(e)} key={authMode}>
        {authMode === 'Discord 模擬' ? (
          <label>
            模擬 Discord 身分
            <input name="discord" required maxLength={80} />
          </label>
        ) : (
          <>
            <label>
              帳號
              <input name="login" required minLength={3} maxLength={32} autoComplete="username" />
            </label>
            <label>
              密碼
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete={authMode === '註冊' ? 'new-password' : 'current-password'}
              />
            </label>
          </>
        )}
        {authMode !== '登入' && (
          <label>
            暱稱
            <input name="nickname" maxLength={40} required />
          </label>
        )}
        {failure && (
          <p role="alert" className={styles.error}>
            {failure}
          </p>
        )}
        <button className={styles.primary} disabled={busy} aria-busy={busy || undefined}>
          {busy
            ? '處理中…'
            : authMode === '註冊'
              ? '註冊並領取 1,000 點'
              : authMode === 'Discord 模擬'
                ? '模擬登入／首次建立會員'
                : '登入'}
        </button>
      </form>
    </>
  );
  if (memberOnly && !current)
    return (
      <div className={styles.app} data-embedded={embedded}>
        <p className={styles.eyebrow}>百業試鋒 · 會員專區</p>
        <h2>{authPurpose === 'loadout' ? '登入後設定武學配置' : '一席之名，從此相識。'}</h2>
        <p>
          {authPurpose === 'loadout'
            ? '使用會員帳號建立自己的武學配置，完成後可帶回報名資料。'
            : '登入後管理報名、角色、注單與點數紀錄。'}
        </p>
        {!state ? (
          <p role="status">
            {failure || '正在讀取會員資料…'}{' '}
            <button onClick={() => void refresh()}>重新讀取</button>
          </p>
        ) : (
          <fieldset className={styles.memberAuth} disabled={busy} aria-busy={busy || undefined}>
            {authenticationForm}
          </fieldset>
        )}
      </div>
    );
  const Content = scrollForm ? 'section' : 'main';
  const focusedRegistration = registrationOnly && tab === '我的參賽';
  return (
    <div
      className={`${styles.app} ${!memberOnly && !scrollForm ? styles.paper : ''}`}
      data-embedded={embedded}
      data-scroll-form={scrollForm}
    >
      {(!scrollForm || current) && (
        <header className={styles.header}>
          {!scrollForm && !embedded && (
            <div>
              <p className={styles.eyebrow}>百業試鋒 · 體驗版</p>
              <h1>{memberOnly ? '會員專區' : focusedRegistration ? '報名赴約' : '觀局雅集'}</h1>
              {focusedRegistration && event && <p>{event.name}</p>}
            </div>
          )}
          <div className={styles.actions}>
            {current ? (
              <>
                <span>
                  {current.name}
                  {!scrollForm && (
                    <>
                      {' '}
                      · <strong>{money(current.balance)} 點</strong>
                    </>
                  )}
                </span>
                <button
                  disabled={busy}
                  onClick={() => {
                    saveSession('');
                    setUserId('');
                    setAuthMode('登入');
                    if (memberOnly) setTab('會員總覽');
                    setLegs([]);
                    setStake('');
                    setConfirm(null);
                  }}
                >
                  登出
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setAuth(true)}>
                  {scrollForm ? '登入／註冊' : '登入／註冊領 1,000 點'}
                </button>
              </>
            )}
            {!embedded && (
              <a
                href={`/?preview=1&stage=3d${event ? `&sportsEvent=${encodeURIComponent(event.id)}` : ''}#schedule`}
              >
                返回賽程 ↗
              </a>
            )}
          </div>
        </header>
      )}
      {!scrollForm && (
        <p className={styles.banner}>
          {focusedRegistration ? '填寫名帖，赴約參賽。' : '體驗版 · 點數與獎品均為示範。'}
        </p>
      )}
      {!focusedRegistration && (
        <>
          {!memberOnly && managerAccess && (
            <div className={styles.actions} role="group" aria-label="操作模式">
              <button
                disabled={busy}
                aria-pressed={tab !== '管理'}
                onClick={() => {
                  setTab('投注區');
                  rememberMode(false);
                  setEditMatch(null);
                  setEditMarket(null);
                  setEditPrize(null);
                  setConfirm(null);
                }}
              >
                檢視模式
              </button>
              <button
                disabled={busy}
                aria-pressed={tab === '管理'}
                onClick={() => {
                  setTab('管理');
                  rememberMode(true);
                  setSlipSettings(false);
                  setConfirm(null);
                }}
              >
                管理模式
              </button>
            </div>
          )}
          <div className={styles.toolbar}>
            <label>
              活動
              <select
                disabled={busy}
                value={eventId}
                onChange={(e) => {
                  chooseEvent(e.target.value);
                  setMatchId('');
                }}
              >
                <option value="">選擇賽事</option>
                {state?.events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ·{' '}
                    {e.registration && !e.registration.published
                      ? `${e.registration.entries.filter((x) => x.status === 'confirmed').length}/${e.registration.capacity} 人報名`
                      : `${e.players.length} 人`}
                  </option>
                ))}
              </select>
            </label>

            {managerAccess &&
              tab === '管理' &&
              event &&
              state?.markets.some(
                (m) => m.eventId === eventId && m.status === 'open' && m.mode === 'popular',
              ) && (
                <button disabled={busy} onClick={() => void run({ type: 'fixed-event', eventId })}>
                  本屆切換固定報價
                </button>
              )}
            {managerAccess && tab === '管理' && sourceSnapshot && !event && (
              <button
                className={styles.primary}
                disabled={busy}
                onClick={() =>
                  void run({
                    type: 'create',
                    name: `百業試鋒 · ${new Date().toLocaleTimeString('zh-TW')}`,
                    snapshot: sourceSnapshot,
                  })
                }
              >
                以目前賽程建立試玩
              </button>
            )}
          </div>
          <nav className={styles.tabs} aria-label={memberOnly ? '會員功能' : '觀局雅集'}>
            {(memberOnly
              ? ['會員總覽', '我的參賽', '我的注單', '點數紀錄', '獎品兌換', '我的獎品']
              : tab === '管理'
                ? []
                : ['投注區', '我的注單', '我的參賽', '點數紀錄', '獎品兌換', '我的獎品']
            ).map((t) => (
              <button
                disabled={busy}
                key={t}
                aria-current={tab === t ? 'page' : undefined}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
            <button type="button" onClick={() => setToolsOpen(true)}>
              對局小工具
            </button>
          </nav>
        </>
      )}
      {toolsOpen && (
        <Modal title="對局小工具" onClose={() => setToolsOpen(false)}>
          <MatchTools />
        </Modal>
      )}
      <p role="status" className={styles.notice}>
        {notice}
      </p>
      {failure && (
        <p role="alert" className={styles.error}>
          {failure}
        </p>
      )}
      {!state ? (
        <p>
          正在讀取本機資料… <button onClick={() => void refresh()}>重新讀取</button>
        </p>
      ) : (
        <div
          className={styles.layout}
          data-reading={!(tab === '投注區') || (!event?.matches.length && !legs.length)}
        >
          <Content ref={mainRef} tabIndex={-1}>
            {memberOnly && tab === '會員總覽' && current && (
              <section>
                <h2>{current.name}，別來無恙。</h2>
                <p>
                  可用點數 <strong>{money(current.balance)} 點</strong>
                </p>
                <div className={styles.actions}>
                  <button onClick={() => setTab('我的參賽')}>我的報名與角色</button>
                  <button onClick={() => setTab('我的注單')}>查看我的注單</button>
                </div>
                <h3>我的參賽活動</h3>
                {state.events.filter((e) =>
                  e.registration?.entries.some((x) => x.userId === userId),
                ).length === 0 && <p>尚未留下名帖。從首頁報名書卷開始，設定自己的角色。</p>}
                {state.events
                  .filter((e) => e.registration?.entries.some((x) => x.userId === userId))
                  .map((e) => (
                    <p key={e.id}>
                      <button
                        onClick={() => {
                          chooseEvent(e.id);
                          setTab('我的參賽');
                        }}
                      >
                        {e.name}
                      </button>
                    </p>
                  ))}
                <a href="/#register">前往報名書卷 ↗</a>
                <h3>赴擂觀局</h3>
                <p>先到比武選擇對局，再開啟觀局雅集。將沿用這個會員帳號與點數。</p>
                <a
                  href={`/?${event ? `preview=1&sportsEvent=${encodeURIComponent(event.id)}&` : ''}stage=3d#duel`}
                >
                  前往比武 ↗
                </a>
              </section>
            )}
            {tab === '我的參賽' &&
              (event ? (
                <Participation
                  scrollForm={scrollForm}
                  submissionError={failure}
                  key={`${event.id}:${userId}`}
                  initialRulesAccepted={
                    registrationConsent?.eventId === event.id &&
                    registrationConsent?.userId === userId
                  }
                  event={event}
                  member={current}
                  busy={busy}
                  run={run}
                  login={() => {
                    pendingRegistrationConsent.current = event.id;
                    setAuth(true);
                  }}
                  onMatch={(id) => {
                    if (scrollForm || memberOnly) {
                      document.dispatchEvent(
                        new CustomEvent('lunjian:sports-open', {
                          detail: { eventId, matchId: id },
                        }),
                      );
                      return;
                    }
                    focusMatch.current = true;
                    setMatchId(id);
                    setTab('投注區');
                  }}
                />
              ) : (
                <p>尚未建立活動，請先由管理者開放報名。</p>
              ))}
            {tab === '投注區' && (
              <label className={styles.marketPicker}>
                投注類型
                <select value={marketGroup} onChange={(e) => setMarketGroup(e.target.value)}>
                  <option value="match">對局投注</option>
                  <option value="place">賽事名次</option>
                </select>
              </label>
            )}
            {tab === '投注區' &&
              (!event ? (
                <section className={styles.empty}>
                  <h2>等待群俠赴約</h2>
                  <p>尚未建立活動，請由管理者開放報名。</p>
                </section>
              ) : (
                <>
                  {!event.matches.length && (
                    <section className={styles.waitingPreview} aria-label="未開賽預覽">
                      <div className={styles.previewHeading}>
                        <h2>
                          {tab === '投注區' && marketGroup === 'match' ? '對局預覽' : '名次預覽'}
                        </h2>
                        <span>{event.registration?.open ? '報名中 · 等待抽籤' : '等待公布'}</span>
                      </div>
                      <p className={styles.slipHint}>
                        先看看開賽後怎麼選。選手與賠率公布後，這裡就能使用。
                      </p>
                      <div className={styles.previewLayout}>
                        <div>
                          {tab === '投注區' && marketGroup === 'match' ? (
                            <>
                              <div className={styles.previewDuel}>
                                <div>
                                  <div className={styles.previewLeft} aria-hidden="true" />
                                  <h3>左方選手</h3>
                                  <p>抽籤後公布</p>
                                </div>
                                <span className={styles.previewVs} aria-hidden="true">
                                  對陣
                                </span>
                                <div>
                                  <div className={styles.previewRight} aria-hidden="true" />
                                  <h3>右方選手</h3>
                                  <p>抽籤後公布</p>
                                </div>
                              </div>
                              <div className={styles.previewChoices} aria-label="尚未開放選擇">
                                <button disabled>
                                  左方勝 <small>賠率待公布</small>
                                </button>
                                <button disabled>
                                  右方勝 <small>賠率待公布</small>
                                </button>
                              </div>
                            </>
                          ) : (
                            <ol className={styles.previewPlaces}>
                              {['冠軍', '亞軍', '季軍', '殿軍'].map((rank) => (
                                <li key={rank}>
                                  <strong>{rank}</strong>
                                  <span>選手名單待公布</span>
                                </li>
                              ))}
                            </ol>
                          )}
                          <p className={styles.slipHint}>這是版面預覽，目前不能下注。</p>
                        </div>
                        <aside className={styles.previewGuide} aria-label="參與方式">
                          <h3>看好誰，就選誰</h3>
                          <ol>
                            <li>
                              <strong>選結果</strong>
                              <p>對局開放後，選擇你看好的選手。</p>
                            </li>
                            <li>
                              <strong>填點數</strong>
                              <p>選好結果，再決定投入多少。</p>
                            </li>
                            <li>
                              <strong>確認送出</strong>
                              <p>核對結果與總點數，確認後才扣點。</p>
                            </li>
                          </ol>
                          <button onClick={() => setTab('我的參賽')}>查看報名與角色設定</button>
                        </aside>
                      </div>
                    </section>
                  )}
                  {tab === '投注區' && marketGroup === 'match' && event.matches.length > 0 && (
                    <section className={styles.matchHead}>
                      <label>
                        選擇場次
                        <select
                          disabled={busy}
                          value={matchId}
                          onChange={(e) => setMatchId(e.target.value)}
                        >
                          {event.matches.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.kind === 'third'
                                ? '季軍戰'
                                : `第 ${m.round} 輪 · 第 ${m.slot + 1} 場`}
                              ｜{name(m.p1)} vs {m.bye ? '輪空' : name(m.p2)} ·{' '}
                              {statusText[m.status]}
                            </option>
                          ))}
                        </select>
                      </label>
                      {selected && (
                        <>
                          <div className={`${styles.previewDuel} ${styles.activeDuel}`}>
                            {[selected.p1, selected.p2].map((id, i) => (
                              <div key={i}>
                                <button
                                  className={styles.playerPortrait}
                                  disabled={!id || (i === 1 && selected.bye)}
                                  onClick={() => setDossierPlayer(id)}
                                  aria-label={`查看${name(id)}備戰配置`}
                                >
                                  <span
                                    className={i === 0 ? styles.previewLeft : styles.previewRight}
                                    aria-hidden="true"
                                  />
                                  <strong>{i === 1 && selected.bye ? '輪空' : name(id)}</strong>
                                  <small>{id ? '查看備戰配置' : '等待前場結果'}</small>
                                </button>
                              </div>
                            ))}
                            <span className={styles.previewVs} aria-hidden="true">
                              對陣
                            </span>
                          </div>
                          <a href={eventHref(event, selected)}>進入比武場景 ↗</a>
                          <p>
                            {selected.bye
                              ? '輪空直接晉級，不開盤。'
                              : !selected.p1 || !selected.p2
                                ? '雙方確定後開盤。'
                                : '全場開始前封盤；單局時間與整場時間皆排除局間等待。'}
                          </p>
                        </>
                      )}
                    </section>
                  )}
                  {marketGroup === 'match' && selected && (
                    <ParticipantBp
                      key={`${event.id}:${selected.id}`}
                      event={event}
                      match={selected}
                      member={current}
                      busy={busy}
                      run={run}
                    />
                  )}
                  {marketGroup === 'place' && (
                    <p>四種名次分開下注，不參與串關。首場開始即封盤；季、殿軍以季軍戰為準。</p>
                  )}
                  {state.markets
                    .filter(
                      (m) =>
                        m.eventId === eventId &&
                        (marketGroup === 'place' ? m.kind === 'place' : m.matchId === matchId),
                    )
                    .map((m) => {
                      const odds = marketOdds(m);
                      const sided = ['winner', 'round', 'score'].includes(m.kind);
                      const optionSide = (id: string) =>
                        id === 'p1' || id.startsWith('2:') ? 'left' : 'right';
                      const displayOptions =
                        m.kind === 'score'
                          ? [m.options[0]!, m.options[3]!, m.options[1]!, m.options[2]!]
                          : m.options;
                      const voted = m.votes[userId] ? m : undefined;
                      const restriction = participationRestriction(event, userId, m);
                      return (
                        <section key={m.id} className={styles.market}>
                          <header>
                            <h3>
                              {m.title}
                              {m.line > 0 && <small> · {m.line} 秒</small>}
                            </h3>
                            <span data-status={m.status}>
                              {restriction && m.status === 'open'
                                ? '僅供觀局'
                                : statusText[m.status]}{' '}
                              · 最低 {m.minLegs || 1} 關 ·{' '}
                              {m.mode === 'popular' ? '舊版人氣模擬' : '固定報價'}
                            </span>
                          </header>
                          {restriction && <p className={styles.voteNote}>{restriction}</p>}
                          <p className={styles.voteNote}>
                            {m.matchId
                              ? '每盤一票，封盤前可改投；改投會取代原票。'
                              : '每個名次一票，封盤前可改投。'}
                            {voted &&
                              ` 本盤已投：${voted.title} · ${voted.options.find((o) => o.id === voted.votes[userId])?.label || ''}`}
                          </p>
                          {sided && (
                            <div className={styles.sideLabels}>
                              <span>左方 · {name(selected?.p1 || '')}</span>
                              <span>右方 · {name(selected?.p2 || '')}</span>
                            </div>
                          )}
                          {m.kind === 'score' && (
                            <p className={styles.voteNote}>比分依「左方：右方」顯示。</p>
                          )}
                          <div className={sided ? styles.duelOptions : styles.otherOptions}>
                            {displayOptions.map((o, i) => (
                              <div
                                className={styles.outcome}
                                key={o.id}
                                data-side={sided ? optionSide(o.id) : i % 2 === 0 ? 'red' : 'blue'}
                              >
                                <span>
                                  {o.label}
                                  {m.line > 0 ? ` ${m.line} 秒` : ''}
                                  {m.result === o.id && ' · 中選'}
                                </span>
                                <small>
                                  {o.baseline +
                                    Object.values(m.votes).filter((v) => v === o.id).length}{' '}
                                  票
                                </small>
                                <button
                                  disabled={busy || m.status !== 'open'}
                                  aria-busy={
                                    (busy &&
                                      lastAction?.type === 'vote' &&
                                      lastAction.marketId === m.id &&
                                      lastAction.outcome === o.id) ||
                                    undefined
                                  }
                                  aria-pressed={m.votes[userId] === o.id}
                                  onClick={() => {
                                    if (!current) setAuth(true);
                                    else
                                      void run({
                                        type: 'vote',
                                        userId,
                                        marketId: m.id,
                                        outcome: o.id,
                                      });
                                  }}
                                >
                                  {busy &&
                                  lastAction?.type === 'vote' &&
                                  lastAction.marketId === m.id &&
                                  lastAction.outcome === o.id
                                    ? '投票中…'
                                    : m.votes[userId] === o.id
                                      ? '已投'
                                      : '投票'}
                                </button>
                                <button
                                  className={styles.odds}
                                  disabled={busy || m.status !== 'open' || !!restriction}
                                  aria-pressed={legs.some(
                                    (l) => l.marketId === m.id && l.outcome === o.id,
                                  )}
                                  data-highlight={m.kind === 'winner' && o.id === initialOutcome}
                                  onClick={() => add(m, o.id)}
                                >
                                  {oddsText(odds[o.id]!)} ×
                                  <span className={styles.sr}> 選擇 {o.label}</span>
                                </button>
                              </div>
                            ))}
                          </div>
                          {lastAction?.type === 'vote' &&
                            lastAction.marketId === m.id &&
                            failure && (
                              <p className={styles.error} role="alert">
                                {failure}
                              </p>
                            )}
                          {m.reason && <p>作廢原因：{m.reason}</p>}
                        </section>
                      );
                    })}
                </>
              ))}
            {tab === '我的注單' && (
              <section>
                <h2>我的注單</h2>
                {!current ? (
                  <button onClick={() => setAuth(true)}>登入查看</button>
                ) : (
                  <>
                    {state.bets.filter(
                      (b) => b.userId === userId && (!eventId || b.eventId === eventId),
                    ).length === 0 && <p>尚無注單，從投注區選擇一個結果開始。</p>}
                    {state.bets
                      .filter((b) => b.userId === userId && (!eventId || b.eventId === eventId))
                      .toReversed()
                      .map((b) => (
                        <article className={styles.ticket} key={b.id}>
                          <header>
                            <strong>{b.status === 'open' ? '待結算' : statusText[b.status]}</strong>
                            <small>{date(b.created)}</small>
                          </header>
                          {b.rules === 'tw-v1' && (
                            <p>
                              過 {b.sizes!.join('／')} 關 · {b.combinations!.length} 組 ×{' '}
                              {money(b.unitStake!)} 點 · 固定成交賠率
                            </p>
                          )}
                          <ol>
                            {b.legs.map((l) => {
                              const m = state.markets.find((m) => m.id === l.marketId)!;
                              return (
                                <li key={`${l.marketId}:${l.outcome}`}>
                                  {l.label} · {oddsText(l.odds)} ×{' '}
                                  <small>
                                    {m.status === 'void'
                                      ? '作廢，按 1.00 倍'
                                      : m.status === 'settled'
                                        ? m.result === l.outcome
                                          ? '中選'
                                          : '未中選'
                                        : '待結果'}
                                  </small>
                                </li>
                              );
                            })}
                          </ol>
                          {b.combinations && (
                            <details>
                              <summary>查看各組結果（{b.combinations.length} 組）</summary>
                              <ol>
                                {b.combinations.slice(0, 40).map((c, i) => (
                                  <li key={i}>
                                    <strong>{combinationText(c, state.markets)}</strong> ·{' '}
                                    {c.map((l) => l.label).join(' × ')}
                                  </li>
                                ))}
                              </ol>
                              {b.combinations.length > 40 && (
                                <p>此處顯示前 40 組，結算包含全部組合。</p>
                              )}
                            </details>
                          )}
                          <p>
                            本金 {money(b.stake)} ·{' '}
                            {b.status === 'open'
                              ? b.rules === 'tw-v1'
                                ? `最高返還 ${money(
                                    ticketQuote(
                                      state.markets.map((m) => ({ ...m, minLegs: 1 })),
                                      b.legs,
                                      b.sizes!,
                                      b.unitStake!,
                                    ).maximum,
                                  )}`
                                : `預計返還 ${money(payout(b.stake, b.legs))}`
                              : `已返還 ${money(b.payout)}`}{' '}
                            點
                          </p>
                        </article>
                      ))}
                  </>
                )}
              </section>
            )}
            {tab === '點數紀錄' && (
              <section>
                <h2>點數紀錄</h2>
                {!current ? (
                  <button onClick={() => setAuth(true)}>登入查看</button>
                ) : (
                  <>
                    <p>
                      可用餘額 <strong>{money(current.balance)} 點</strong>
                    </p>
                    <div className={styles.tableWrap}>
                      <table>
                        <thead>
                          <tr>
                            <th>時間／項目</th>
                            <th>變動</th>
                            <th>結餘</th>
                          </tr>
                        </thead>
                        <tbody>
                          {state.entries
                            .filter((e) => e.userId === userId)
                            .toReversed()
                            .map((e) => (
                              <tr key={e.id}>
                                <td>
                                  {e.label}
                                  <small>{date(e.created)}</small>
                                </td>
                                <td data-positive={BigInt(e.amount) > 0n}>
                                  {BigInt(e.amount) > 0n ? '+' : ''}
                                  {money(e.amount)}
                                </td>
                                <td>{money(e.balance)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    <h3>綁定模擬 Discord</h3>
                    {current.discord ? (
                      <p>已綁定：{current.discord}</p>
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void run({
                            type: 'bind',
                            userId,
                            discord: val(new FormData(e.currentTarget), 'discord'),
                          });
                        }}
                      >
                        <label>
                          模擬身分
                          <input name="discord" required maxLength={80} />
                        </label>
                        <button disabled={busy} aria-busy={busy || undefined}>
                          {busy ? '正在綁定…' : '綁定，不重複贈點'}
                        </button>
                      </form>
                    )}
                  </>
                )}
              </section>
            )}
            {tab === '獎品兌換' && (
              <section>
                <h2>以點數換一份心意</h2>
                <p>示範獎品，申請時扣點並保留庫存；待審核時可取消。</p>
                <div className={styles.prizes}>
                  {state.prizes
                    .filter((p) => p.active)
                    .map((p) => (
                      <article key={p.id}>
                        <h3>{p.name}</h3>
                        <p>{p.description}</p>
                        <strong>{money(p.price)} 點</strong>
                        <p>可兌換 {p.stock} 份</p>
                        <button
                          disabled={busy || p.stock === 0}
                          onClick={() => {
                            if (!current) setAuth(true);
                            else
                              ask(
                                { type: 'redeem', userId, prizeId: p.id, price: p.price },
                                '確認示範兌換',
                                `${p.name} · 扣除 ${money(p.price)} 點，等待管理者審核。`,
                              );
                          }}
                        >
                          申請兌換
                        </button>
                      </article>
                    ))}
                </div>
              </section>
            )}
            {tab === '我的獎品' && (
              <section>
                <h2>我的獎品</h2>
                {!current ? (
                  <>
                    <p>登入後查看你的獎品與兌換進度。</p>
                    <button onClick={() => setAuth(true)}>登入查看</button>
                  </>
                ) : (
                  <>
                    <MyCeremonyPrizes events={state.events} userId={userId} />
                    <h3>點數兌換</h3>
                    <p>查看兌換進度；待審核的申請仍可取消並退回點數。</p>
                    {!state.redemptions.some((r) => r.userId === userId) && (
                      <>
                        <p>尚未兌換獎品。</p>
                        <button onClick={() => setTab('獎品兌換')}>前往獎品兌換</button>
                      </>
                    )}
                    {state.redemptions
                      .filter((r) => r.userId === userId)
                      .toReversed()
                      .map((r) => (
                        <article className={styles.ticket} key={r.id}>
                          <h3>{r.name}</h3>
                          <small>申請時間 {date(r.created)}</small>
                          <p>
                            {statusText[r.status]} · {money(r.price)} 點
                          </p>
                          {r.status === 'pending' && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                ask(
                                  {
                                    type: 'redemption',
                                    id: r.id,
                                    status: 'cancelled',
                                    actor: userId,
                                  },
                                  '取消兌換',
                                  `退回 ${money(r.price)} 點並恢復庫存。`,
                                )
                              }
                            >
                              取消並退款
                            </button>
                          )}
                        </article>
                      ))}
                  </>
                )}
              </section>
            )}
            {managerAccess && tab === '管理' && (
              <section>
                <h2>雅集事務</h2>
                <p>本機管理模式可操作活動、報名名單、對局與結算；正式權限尚未串接。</p>
                <p className={styles.banner}>
                  此處為本機管理模擬，所有試玩者都能操作；不代表正式裁判權限。
                </p>
                <details open={!event}>
                  <summary>另開一屆試玩</summary>
                  <form
                    className={styles.form}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      try {
                        if (val(f, 'source') === 'registration') {
                          void run({
                            type: 'activity-create',
                            name: val(f, 'name'),
                            capacity: Number(val(f, 'count')),
                          });
                          return;
                        }
                        void run({
                          type: 'create',
                          name: val(f, 'name'),
                          snapshot:
                            val(f, 'source') === 'current' && sourceSnapshot
                              ? sourceSnapshot
                              : defaultSnapshot(Number(val(f, 'count'))),
                        });
                      } catch (e) {
                        setFailure((e as Error).message);
                      }
                    }}
                  >
                    <label>
                      賽事名稱
                      <input name="name" defaultValue="百業試鋒 · 試玩" maxLength={80} required />
                    </label>
                    <label>
                      選手來源
                      <select name="source">
                        <option value="registration">開放會員報名（空白名單）</option>
                        <option value="generated">預填示範選手</option>
                        {sourceSnapshot && (
                          <option value="current">
                            目前賽程快照（{sourceSnapshot.players.length} 人）
                          </option>
                        )}
                      </select>
                    </label>
                    <label>
                      報名上限／示範人數
                      <input
                        name="count"
                        type="number"
                        min="2"
                        max="64"
                        defaultValue="8"
                        required
                      />
                    </label>
                    <button
                      className={styles.primary}
                      disabled={busy}
                      aria-busy={busy || undefined}
                    >
                      {busy ? '正在儲存…' : '建立活動'}
                    </button>
                    <p>
                      保留舊賽事、注單與餘額，新賽事清空比分；需調整名單請先回賽程編輯，再匯入快照。
                    </p>
                  </form>
                </details>
                {event && (
                  <>
                    <EnrollmentAdmin
                      key={event.id}
                      event={event}
                      busy={busy}
                      run={run}
                      ask={ask}
                      feedback={
                        lastAction?.type === 'activity-update' && lastAction.eventId === event.id
                          ? failure || notice
                          : ''
                      }
                      failed={lastAction?.type === 'activity-update' && !!failure}
                    />
                    <ManagerOperations
                      key={`operations-${event.id}`}
                      event={event}
                      state={state}
                      busy={busy}
                      run={run}
                      ask={ask}
                    />
                    <label>
                      切換管理對局
                      <select
                        disabled={busy}
                        value={matchId}
                        onChange={(e) => setMatchId(e.target.value)}
                      >
                        <option value="">選擇對局</option>
                        {event.matches.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.kind === 'third'
                              ? '季軍戰'
                              : `第 ${m.round} 輪 · 第 ${m.slot + 1} 場`}{' '}
                            · {name(m.p1)} ／ {name(m.p2)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {selected && (
                      <ParticipantBp
                        key={`${event.id}:${selected.id}`}
                        event={event}
                        match={selected}
                        member={current}
                        busy={busy}
                        run={run}
                        manage
                      />
                    )}
                    {!event.registration && (
                      <details>
                        <summary>會員與參賽者對應</summary>
                        <p>首張注單成立或開賽後鎖定。</p>
                        {state.members
                          .filter((u) => !u.anonymous)
                          .map((u) => (
                            <label key={u.id}>
                              {u.name}
                              <select
                                disabled={
                                  busy ||
                                  event.started ||
                                  state.bets.some((b) => b.eventId === event.id)
                                }
                                value={event.links[u.id] || ''}
                                onChange={(e) =>
                                  void run({
                                    type: 'link',
                                    eventId,
                                    userId: u.id,
                                    playerId: e.target.value,
                                  })
                                }
                              >
                                <option value="">觀眾，未參賽</option>
                                {event.players.map((p) => (
                                  <option value={p.id} key={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                      </details>
                    )}
                    <details open>
                      <summary>賽果與結算</summary>
                      {event.matches
                        .filter((m) => !matchId || m.id === matchId)
                        .map((m) => (
                          <article className={styles.adminMatch} key={m.id}>
                            <div>
                              <strong>
                                {m.kind === 'third'
                                  ? '季軍戰'
                                  : `第 ${m.round} 輪 · 第 ${m.slot + 1} 場`}
                              </strong>
                              <p>
                                {name(m.p1)} ／ {m.bye ? '輪空' : name(m.p2)} ·{' '}
                                {statusText[m.status]}{' '}
                                {m.status === 'done' && !m.bye ? `${m.s1}:${m.s2}` : ''}
                              </p>
                            </div>
                            <div className={styles.actions}>
                              {m.status === 'upcoming' && m.p1 && m.p2 && (
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    ask(
                                      { type: 'start', eventId, matchId: m.id },
                                      '開始比賽並封盤',
                                      '將關閉本場所有盤口，以及本屆全部名次盤。',
                                      [
                                        `${event.name} · ${m.kind === 'third' ? '季軍戰' : `第 ${m.round} 輪 · 第 ${m.slot + 1} 場`}`,
                                        `${name(m.p1)} ／ ${name(m.p2)}`,
                                      ],
                                    )
                                  }
                                >
                                  開始比賽
                                </button>
                              )}
                              {m.status !== 'done' && m.p1 && m.p2 && (
                                <button
                                  onClick={() => {
                                    setFailure('');
                                    setEditMatch(m.id);
                                  }}
                                >
                                  填寫逐局賽果
                                </button>
                              )}
                              {m.status === 'live' && m.draft.length > 0 && (
                                <button
                                  className={styles.primary}
                                  onClick={() => {
                                    try {
                                      const info = settlementPreview(state, eventId, m.id);
                                      ask(
                                        {
                                          type: 'settle',
                                          eventId,
                                          matchId: m.id,
                                          revision: info.revision,
                                        },
                                        '確認結算並派彩',
                                        `將完成 ${info.count} 張注單，入帳合計 ${money(info.total)} 點。已結算結果不可改判，之後可另開一屆測試。`,
                                        [
                                          `${event.name} · ${m.kind === 'third' ? '季軍戰' : `第 ${m.round} 輪 · 第 ${m.slot + 1} 場`}`,
                                          `${name(m.p1)} ／ ${name(m.p2)} · BO3 ${m.draft.filter((b) => b.winner === m.p1).length}:${m.draft.filter((b) => b.winner === m.p2).length}`,
                                          ...m.draft.map(
                                            (b, i) =>
                                              `第 ${i + 1} 局：${name(b.winner)} 勝 · ${b.seconds} 秒`,
                                          ),
                                          `整場時間：${m.draft.reduce((sum, b) => sum + b.seconds, 0)} 秒${m.draft.length === 2 ? '；第三局未進行，該局盤口作廢退款。' : ''}`,
                                        ],
                                      );
                                    } catch (e) {
                                      setFailure((e as Error).message);
                                    }
                                  }}
                                >
                                  檢查結算
                                </button>
                              )}
                              <a href={eventHref(event, m)}>比武 ↗</a>
                            </div>
                          </article>
                        ))}
                    </details>
                    <details>
                      <summary>盤口與賠率設定</summary>
                      <label>
                        場次
                        <select
                          disabled={busy}
                          value={matchId}
                          onChange={(e) => setMatchId(e.target.value)}
                        >
                          {event.matches.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.kind === 'third'
                                ? '季軍戰'
                                : `第 ${m.round} 輪 · 第 ${m.slot + 1} 場`}{' '}
                              · {name(m.p1)} ／ {name(m.p2)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {state.markets
                        .filter(
                          (m) =>
                            m.eventId === eventId && (m.matchId === matchId || m.kind === 'place'),
                        )
                        .map((m) => (
                          <div className={styles.adminMatch} key={m.id}>
                            <span>
                              {m.title} · {statusText[m.status]} · 最低 {m.minLegs || 1} 關 ·{' '}
                              {m.mode === 'popular' ? '舊版人氣模擬' : '固定報價'}
                            </span>
                            <button
                              disabled={m.status === 'settled' || m.status === 'void'}
                              onClick={() => {
                                setFailure('');
                                setEditMarket(m.id);
                              }}
                            >
                              設定／作廢
                            </button>
                          </div>
                        ))}
                    </details>
                  </>
                )}
                <details>
                  <summary>獎品與兌換審核</summary>
                  <button
                    onClick={() =>
                      setEditPrize({
                        id: uid(),
                        name: '',
                        description: '本機示範，不會實際發放。',
                        price: '300',
                        stock: 1,
                        active: true,
                      })
                    }
                  >
                    新增獎品
                  </button>
                  {state.prizes.map((p) => (
                    <div key={p.id} className={styles.adminMatch}>
                      <span>
                        {p.name} · {money(p.price)} 點 · 庫存 {p.stock} ·{' '}
                        {p.active ? '上架' : '下架'}
                      </span>
                      <button onClick={() => setEditPrize(p)}>編輯</button>
                    </div>
                  ))}
                  {state.redemptions.toReversed().map((r) => (
                    <article className={styles.ticket} key={r.id}>
                      <strong>
                        {r.name} · {state.members.find((m) => m.id === r.userId)?.name}
                      </strong>
                      <p>
                        {statusText[r.status]} · {money(r.price)} 點
                      </p>
                      <div className={styles.actions}>
                        {r.status === 'pending' && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run({
                                type: 'redemption',
                                id: r.id,
                                status: 'approved',
                                actor: 'admin',
                              })
                            }
                          >
                            核准
                          </button>
                        )}
                        {r.status === 'approved' && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              ask(
                                {
                                  type: 'redemption',
                                  id: r.id,
                                  status: 'delivered',
                                  actor: 'admin',
                                },
                                '標記模擬發放',
                                '標記後不可取消或重複發放。',
                              )
                            }
                          >
                            標記已發放
                          </button>
                        )}
                        {['pending', 'approved'].includes(r.status) && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              ask(
                                {
                                  type: 'redemption',
                                  id: r.id,
                                  status: 'cancelled',
                                  actor: 'admin',
                                },
                                '取消並退款',
                                `退回 ${money(r.price)} 點並恢復庫存。`,
                              )
                            }
                          >
                            取消退款
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </details>
              </section>
            )}
          </Content>
          {tab === '投注區' && (!!event?.matches.length || legs.length > 0) && (
            <aside
              ref={slipRef}
              className={styles.slip}
              data-open={slipOpen}
              data-fits={slipFits}
              aria-label="我的注單"
            >
              <button
                className={styles.slipToggle}
                aria-expanded={slipOpen}
                onClick={() => setSlipOpen(!slipOpen)}
              >
                {legs.length} 個選項 ·{' '}
                {selectedCombinations.length === 1
                  ? `${exactOdds(selectedCombinations[0]!)} 倍`
                  : `${selectedCombinations.length} 組`}{' '}
                · {slipOpen ? '繼續選盤 ↓' : '查看注單 ↑'}
              </button>
              <div className={styles.slipBody}>
                <h2>我的注單</h2>
                <label>
                  投注方式
                  <select
                    value={independent ? 'singles' : 'parlay'}
                    onChange={(e) => {
                      const single = e.target.value === 'singles';
                      setSlipError('');
                      setIndependent(single);
                      setConfirm(null);
                      setSizes(null);
                      setPack(false);
                      setLegs((old) =>
                        single ? [...new Map(old.map((l) => [l.marketId, l])).values()] : old,
                      );
                    }}
                  >
                    <option value="singles">每場分開計算（一般）</option>
                    <option value="parlay">多場一起猜（串關）</option>
                  </select>
                </label>

                <button
                  className={styles.selectionButton}
                  onClick={() => setSlipSettings(true)}
                  aria-haspopup="dialog"
                >
                  查看我的選擇（{legs.length}）
                </button>
                <p className={styles.slipHint} aria-live="polite">
                  {legs.length
                    ? `已選 ${matchCount} 場、${legs.length} 個選項`
                    : '先在對局中選擇你看好的結果。'}
                </p>
                {selectedCombinations.length > 0 && (
                  <section className={styles.oddsSummary} aria-label="注單賠率" aria-live="polite">
                    {selectedCombinations.length === 1 ? (
                      <>
                        <span>總賠率 · {selectedCombinations[0]!.length} 關</span>

                        <strong>{exactOdds(selectedCombinations[0]!)} 倍</strong>
                      </>
                    ) : (
                      <>
                        <strong>
                          {selectedCombinations.length}{' '}
                          {independent ? '筆單注，各自結算' : '組，分別計算賠率'}
                        </strong>
                      </>
                    )}
                  </section>
                )}
                {legs.length > 0 && (
                  <>
                    <label>
                      {independent ? '每筆本金（點）' : '每組本金（點）'}
                      <input
                        inputMode="numeric"
                        value={stake}
                        onChange={(e) => {
                          setStake(e.target.value.replace(/\D/g, '').slice(0, 18));
                          setSlipError('');
                          setConfirm(null);
                        }}
                      />
                    </label>
                    <div className={styles.actions}>
                      {(independent ? [100, 200, 500] : [10, 50, 100]).map((n) => (
                        <button
                          key={n}
                          onClick={() => {
                            setStake(String(n));
                            setSlipError('');
                            setConfirm(null);
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <p>
                      {quote?.count || 0} 組 · 總本金{' '}
                      <strong>{money(quote?.cost || '0')} 點</strong> ·
                      {independent ? '各筆全中返還合計' : '最高返還'}{' '}
                      <strong>{money(quoteTotal)} 點</strong>（含本金）
                    </p>
                    {quoteError && (
                      <p role="status" className={styles.error}>
                        {quoteError}
                      </p>
                    )}
                    {slipError && (
                      <p ref={slipErrorRef} tabIndex={-1} role="alert" className={styles.error}>
                        {slipError}
                      </p>
                    )}

                    <button
                      className={styles.primary}
                      disabled={busy || !legs.length}
                      onClick={checkBet}
                    >
                      檢查注單
                    </button>
                    <small>下一步核對選項與金額，確認後才扣點。</small>
                  </>
                )}
              </div>
            </aside>
          )}
        </div>
      )}
      {slipSettings && state && (
        <Modal title="我的選擇" onClose={() => setSlipSettings(false)}>
          <div className={styles.slipEditor}>
            <p className={styles.slipHint}>
              {legs.length
                ? '確認你選的結果，再回去填寫投入點數。'
                : '先到對局中，點選你看好的結果。'}
            </p>

            {legs.length > 0 && <h3>已選 {legs.length} 個結果</h3>}
            {!legs.length && (
              <div className={styles.slipEmpty}>
                <strong>還沒選擇結果</strong>
                <p>選好後，會顯示在這裡。</p>
              </div>
            )}
            <ol>
              {legs.map((l) => (
                <li key={`${l.marketId}:${l.outcome}`}>
                  <span>
                    {state.markets.find((m) => m.id === l.marketId)?.matchId
                      ? l.label.split(' · ').slice(1).join(' · ')
                      : l.label}
                  </span>
                  <strong>{oddsText(l.odds)} ×</strong>
                  {independent && quote && (
                    <small>
                      本金 {money(stake)} 點 · 命中返還{' '}
                      {money(singlesQuote(state.markets, [l], stake).maximum)} 點
                    </small>
                  )}
                  <button
                    aria-label={`移除 ${l.label}`}
                    onClick={() => {
                      setConfirm(null);
                      setLegs((old) =>
                        old.filter((x) => x.marketId !== l.marketId || x.outcome !== l.outcome),
                      );
                      setSizes(null);
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>

            <details>
              <summary>進階設定（選填）</summary>
              <p className={styles.slipHint}>一般選擇不需要調整這裡。</p>
              {!independent && (
                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={pack}
                    onChange={(e) => {
                      setPack(e.target.checked);
                      setConfirm(null);
                      if (!e.target.checked) {
                        setLegs((old) => [...new Map(old.map((l) => [l.marketId, l])).values()]);
                      }
                    }}
                  />
                  同一場選多個結果（包牌）
                </label>
              )}
              {!independent && matchCount > 0 && (
                <fieldset className={styles.systems}>
                  <legend>每組要選幾場？（可複選）</legend>
                  {Array.from({ length: matchCount }, (_, i) => i + 1).map((n) => (
                    <label key={n}>
                      <input
                        type="checkbox"
                        checked={selectedSizes.includes(n)}
                        onChange={() => {
                          setSizes(
                            selectedSizes.includes(n)
                              ? selectedSizes.filter((x) => x !== n)
                              : [...selectedSizes, n].sort((a, b) => a - b),
                          );
                          setConfirm(null);
                        }}
                      />
                      {n} 場一組
                    </label>
                  ))}
                </fieldset>
              )}
              <label>
                送出前賠率變了怎麼辦？
                <select
                  value={oddsPolicy}
                  onChange={(e) => {
                    setOddsPolicy(e.target.value as 'strict' | 'higher');
                    setConfirm(null);
                  }}
                >
                  <option value="strict">暫停送出，讓我重新確認</option>
                  <option value="higher">只有回報提高時才接受</option>
                </select>
              </label>
            </details>
            {legs.length > 0 && (
              <details>
                <summary>計算方式與點數上限</summary>
                {selectedCombinations.length === 1 && (
                  <p aria-label="賠率算式">
                    {selectedCombinations[0]!.map((l) => exactOdds([l])).join(' × ')} ={' '}
                    {exactOdds(selectedCombinations[0]!)} 倍
                  </p>
                )}
                {selectedCombinations.length > 1 && (
                  <details>
                    <summary>查看 {selectedCombinations.length} 個組合的賠率</summary>
                    <ol>
                      {selectedCombinations.slice(0, 40).map((c, i) => (
                        <li key={i}>
                          {c.map((l) => l.label).join(' × ')}
                          <br />
                          {c.map((l) => exactOdds([l])).join(' × ')} = {exactOdds(c)} 倍
                        </li>
                      ))}
                    </ol>
                    {selectedCombinations.length > 40 && (
                      <p>顯示前 40 組；成立注單包含全部 {selectedCombinations.length} 組。</p>
                    )}
                  </details>
                )}

                <p>
                  {independent
                    ? '每筆分開計算；相反的結果不會同時猜中。'
                    : '每組分開計算；相反的結果不會同時猜中。'}{' '}
                  每筆返還上限 20,000,000 點。
                </p>
              </details>
            )}
            <div className={styles.editorActions}>
              {legs.length > 0 && <button onClick={refreshQuotes}>更新賠率</button>}
              <button className={styles.primary} onClick={() => setSlipSettings(false)}>
                {legs.length ? '完成，回去填點數' : '返回挑選結果'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {dossierPlayer &&
        (() => {
          const player = event?.players.find((p) => p.id === dossierPlayer);
          const index = Array.from(dossierPlayer).reduce((n, c) => n + c.charCodeAt(0), 0);
          const demo = demoDossiers?.profiles[index % demoDossiers.profiles.length];
          return (
            <Modal
              title={`${player?.name || '選手'} · 備戰配置`}
              onClose={() => setDossierPlayer('')}
              dossier
            >
              {player?.character ? (
                <dl className={styles.publicLoadout}>
                  {[
                    ['流派', player.character.style],
                    ['武器', player.character.weapon],
                    ['裝備', player.character.equipment],
                    ['武學', player.character.arts],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value || '待公開'}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <>
                  <p className={styles.banner}>示範配置 · 非選手實際配裝</p>
                  {demo ? (
                    <>
                      <h3>{demo.title}</h3>
                      {demo.sections.map((section) => (
                        <section key={section.title}>
                          <h3>{section.title}</h3>
                          <div className={styles.loadoutGrid} data-kind={section.kind}>
                            {section.kind === 'martial' && demo.build ? (
                              <div className={styles.buildCard}>
                                <div className={styles.buildTitle}>
                                  <img src={demo.build.image} alt="" />
                                  <strong>{demo.build.name}</strong>
                                </div>
                                <img
                                  className={styles.buildWatermark}
                                  src={demo.build.familyImage}
                                  alt=""
                                />
                                <div className={styles.buildArts}>
                                  {section.items.map((item) => (
                                    <div key={item.name}>
                                      <img src={item.image} alt="" />
                                      <strong>{item.name}</strong>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              section.items.map((item) => (
                                <figure key={item.name}>
                                  <div className={styles.loadoutArt}>
                                    {item.image && (
                                      <img src={item.image} alt="" width={96} height={80} />
                                    )}
                                    <figcaption>
                                      <strong>{item.name}</strong>
                                      <small>{item.note}</small>
                                    </figcaption>
                                  </div>
                                  {item.stats?.length > 0 && (
                                    <dl className={styles.gearStats}>
                                      {item.stats.map(([label, value]) => (
                                        <div key={label}>
                                          <dt>{label}</dt>
                                          <dd>{value}</dd>
                                        </div>
                                      ))}
                                    </dl>
                                  )}
                                </figure>
                              ))
                            )}
                          </div>
                        </section>
                      ))}
                      <section>
                        <h3>對方點名的 BP 限制 · 示範</h3>
                        {demo.bpReceived.length ? (
                          <table className={styles.bpTable}>
                            <thead>
                              <tr>
                                <th>限制項目</th>
                                <th>BP</th>
                                <th>本場效果</th>
                              </tr>
                            </thead>
                            <tbody>
                              {demo.bpReceived.map((bp) => (
                                <tr key={bp.name}>
                                  <th scope="row">
                                    {bp.name}
                                    <small>{bp.target}</small>
                                  </th>
                                  <td>{bp.cost}</td>
                                  <td>{bp.effect}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p>本場未受對方點名限制。</p>
                        )}
                      </section>
                    </>
                  ) : (
                    <p>正在讀取示範配置，請稍候。</p>
                  )}
                </>
              )}
            </Modal>
          );
        })()}
      {auth && (
        <Modal
          busy={busy}
          title={authMode === 'Discord 模擬' ? 'Discord 模擬登入' : '會員登入與註冊'}
          onClose={() => {
            if (!busy) {
              pendingRegistrationConsent.current = '';
              setAuth(false);
            }
          }}
        >
          {authenticationForm}
        </Modal>
      )}
      {confirm && (
        <Modal
          busy={busy}
          alert
          title={confirm.title}
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
        >
          {confirm.details && (
            <ul className={styles.confirmSelections} aria-label="待確認對局">
              {confirm.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
          <p>{confirm.description}</p>
          {confirm.command.type === 'ticket' && (
            <ul className={styles.confirmSelections} aria-label="待確認選項">
              {confirm.command.legs.map((l) => (
                <li key={`${l.marketId}:${l.outcome}`}>
                  {l.label} · {exactOdds([l])} 倍
                </li>
              ))}
            </ul>
          )}
          {failure && (
            <p role="alert" className={styles.error}>
              {failure}
            </p>
          )}
          <div className={styles.actions}>
            <button disabled={busy} onClick={() => setConfirm(null)}>
              返回修改
            </button>
            <button
              className={isDangerous(confirm.command) ? styles.danger : styles.primary}
              disabled={busy}
              aria-busy={busy || undefined}
              onClick={() =>
                void run(confirm.command, confirm.key).then((ok) => {
                  if (ok) setConfirm(null);
                })
              }
            >
              {busy ? '處理中…' : confirmLabel(confirm.command)}
            </button>
          </div>
        </Modal>
      )}
      {activeMatch && event && (
        <Modal
          busy={busy}
          title="逐局賽果草稿"
          onClose={() => {
            setEditMatch(null);
            setFailure('');
          }}
        >
          <p>
            <strong>
              {activeMatch.kind === 'third'
                ? '季軍戰'
                : `第 ${activeMatch.round} 輪 · 第 ${activeMatch.slot + 1} 場`}{' '}
              · {name(activeMatch.p1)} ／ {name(activeMatch.p2)}
            </strong>
          </p>
          <p>每局填勝者與秒數。儲存只更新草稿；確認結算才會派彩。</p>
          <form
            onChange={() => setFailure('')}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const bouts = [0, 1, 2]
                .filter((i) => !!val(f, `winner${i}`))
                .map((i) => ({
                  winner: val(f, `winner${i}`),
                  seconds: Number(val(f, `seconds${i}`)),
                }));
              void run({ type: 'draft', eventId, matchId: activeMatch.id, bouts }).then((ok) => {
                if (ok) setEditMatch(null);
              });
            }}
          >
            {[0, 1, 2].map((i) => (
              <fieldset key={i}>
                <legend>第 {i + 1} 局</legend>
                <label>
                  勝者
                  <select
                    name={`winner${i}`}
                    defaultValue={activeMatch.draft[i]?.winner || ''}
                    required={i < 2}
                  >
                    <option value="">{i === 2 ? '未進行' : '選擇勝者'}</option>
                    {[activeMatch.p1, activeMatch.p2].map((id) => (
                      <option value={id} key={id}>
                        {name(id)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  實際秒數
                  <input
                    name={`seconds${i}`}
                    type="number"
                    min="1"
                    max="86400"
                    defaultValue={activeMatch.draft[i]?.seconds || ''}
                    required={i < 2}
                  />
                </label>
              </fieldset>
            ))}
            {failure && (
              <p ref={matchErrorRef} tabIndex={-1} role="alert" className={styles.error}>
                {failure}
              </p>
            )}
            <button disabled={busy} className={styles.primary} aria-busy={busy || undefined}>
              {busy ? '正在儲存…' : '儲存賽果草稿'}
            </button>
          </form>
        </Modal>
      )}
      {activeMarket && (
        <Modal busy={busy} title={`設定 ${activeMarket.title}`} onClose={() => setEditMarket(null)}>
          <form
            onInput={() => setFailure('')}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                void run({
                  type: 'configure',
                  marketId: activeMarket.id,
                  mode: val(f, 'mode') as Market['mode'],
                  line: Number(val(f, 'line')),
                  minLegs: Number(val(f, 'minLegs')),
                  options: activeMarket.options.map((o, i) => ({
                    id: o.id,
                    fixed: oddInput(val(f, `odds${i}`)),
                    baseline: Number(val(f, `votes${i}`)),
                  })),
                }).then((ok) => {
                  if (ok) setEditMarket(null);
                });
              } catch (e) {
                setFailure((e as Error).message);
              }
            }}
          >
            <label>
              賠率模式
              <select name="mode" defaultValue={activeMarket.mode}>
                <option value="popular">舊版人氣模擬（非官方報價）</option>
                <option value="fixed">固定報價（管理者開盤）</option>
              </select>
            </label>
            <p>新開盤預設固定報價，人氣票只表示支持度。下列金額是本機示範報價，非官方賠率。</p>
            <label>
              最低過關數
              <input
                name="minLegs"
                type="number"
                min="1"
                max="12"
                defaultValue={activeMarket.minLegs || 1}
                readOnly={activeMarket.kind === 'place'}
                required
              />
            </label>
            <label>
              秒數門檻（時間盤）
              <input
                name="line"
                type="number"
                min="0"
                max="259200"
                readOnly={marketLineLocked || !['duration', 'total'].includes(activeMarket.kind)}
                defaultValue={activeMarket.line}
              />
            </label>
            {marketLineLocked && ['duration', 'total'].includes(activeMarket.kind) && (
              <p>此盤已有注單，秒數門檻已鎖定；既有注單的條件不會改變。</p>
            )}
            {activeMarket.options.map((o, i) => (
              <fieldset key={o.id}>
                <legend>{o.label}</legend>
                <label>
                  固定賠率
                  <input
                    name={`odds${i}`}
                    inputMode="decimal"
                    defaultValue={oddsText(o.fixed)}
                    required
                  />
                </label>
                <label>
                  示範基礎票數
                  <input
                    name={`votes${i}`}
                    type="number"
                    min="0"
                    max="1000000"
                    defaultValue={o.baseline}
                    required
                  />
                </label>
              </fieldset>
            ))}
            {failure && (
              <p ref={marketErrorRef} tabIndex={-1} role="alert" className={styles.error}>
                {failure}
              </p>
            )}
            <button disabled={busy || activeMarket.status !== 'open'} className={styles.primary}>
              {busy ? '正在儲存…' : '儲存設定'}
            </button>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const reason = val(new FormData(e.currentTarget), 'reason');
              setEditMarket(null);
              ask(
                { type: 'void', marketId: activeMarket.id, reason },
                '作廢盤口',
                `原因：${reason}。單注退回本金；串關此關改按 1.00 倍。`,
              );
            }}
          >
            <label>
              作廢原因
              <input name="reason" required />
            </label>
            <button
              disabled={busy || activeMarket.status === 'settled' || activeMarket.status === 'void'}
              className={styles.danger}
            >
              作廢此盤
            </button>
          </form>
        </Modal>
      )}
      {editPrize && (
        <Modal busy={busy} title="示範獎品設定" onClose={() => setEditPrize(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run({
                type: 'prize',
                prize: {
                  id: editPrize.id,
                  name: val(f, 'name'),
                  description: val(f, 'description'),
                  price: val(f, 'price'),
                  stock: Number(val(f, 'stock')),
                  active: f.has('active'),
                },
              }).then((ok) => {
                if (ok) setEditPrize(null);
              });
            }}
          >
            <label>
              名稱
              <input name="name" defaultValue={editPrize.name} required maxLength={80} />
            </label>
            <label>
              說明
              <textarea name="description" defaultValue={editPrize.description} />
            </label>
            <label>
              所需點數
              <input name="price" inputMode="numeric" defaultValue={editPrize.price} required />
            </label>
            <label>
              可用庫存
              <input name="stock" type="number" min="0" defaultValue={editPrize.stock} required />
            </label>
            <label>
              <input name="active" type="checkbox" defaultChecked={editPrize.active} /> 上架
            </label>
            {failure && (
              <p role="alert" className={styles.error}>
                {failure}
              </p>
            )}
            <button disabled={busy} className={styles.primary} aria-busy={busy || undefined}>
              {busy ? '正在儲存…' : '儲存獎品'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
