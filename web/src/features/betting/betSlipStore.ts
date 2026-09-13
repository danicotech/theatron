'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

/**
 * 投注單的狀態。
 *
 * 權威是 localStorage(`bet-slip:<slug>`),不是記憶體:注單要活過重新整理與
 * 換頁 —— 觀眾在對戰表上挑三場、回到某一場再改一腿,中間不該把已挑的弄丟。
 * 記憶體只留一份快取讓 useSyncExternalStore 拿到穩定的物件參照;
 * 兩個分頁各改各的也沒關係,storage 事件會把另一邊叫醒。
 *
 * 一場只能一腿是伺服器的規則(betting.proto 檔頭),這裡在加腿時就先替換,
 * 讓使用者在畫面上看到「換成這個」而不是送出後才被打回來。
 */

export interface SlipLeg {
  matchPublicId: string;
  marketPublicId: string;
  outcome: string;
  /** 伺服器組好的結果名(選手名、「超過 90 秒」、「2:0」)。 */
  label: string;
  oddsMilli: bigint;
  marketTitle: string;
}

export interface SlipState {
  legs: readonly SlipLeg[];
  /** 本金輸入的原文:只含數字,空字串 = 還沒填。用字串是為了讓輸入框可以是空的。 */
  stake: string;
}

const EMPTY: SlipState = Object.freeze({ legs: [], stake: '' });

/** 賠率 ×1000 的放大倍率,與伺服器 OddsScale 同值。 */
const ODDS_SCALE = 1000n;

/** int64 的上限是 19 位;本金留 18 位就永遠塞得進去,再多也只是被 max_stake 擋掉。 */
const MAX_STAKE_DIGITS = 18;

export function storageKey(slug: string): string {
  return `bet-slip:${slug}`;
}

// ── 讀寫 ────────────────────────────────────────────────────────

type Listener = () => void;

interface Cache {
  raw: string | null;
  state: SlipState;
}

const caches = new Map<string, Cache>();
const listeners = new Map<string, Set<Listener>>();
/** localStorage 不可用(隱私模式、配額)時的備援。平常只是 localStorage 的影子。 */
const memory = new Map<string, string>();

function readRaw(slug: string): string | null {
  try {
    return localStorage.getItem(storageKey(slug));
  } catch {
    return memory.get(slug) ?? null;
  }
}

function writeRaw(slug: string, raw: string | null): void {
  if (raw === null) memory.delete(slug);
  else memory.set(slug, raw);
  try {
    if (raw === null) localStorage.removeItem(storageKey(slug));
    else localStorage.setItem(storageKey(slug), raw);
  } catch {
    // 存不進去就只活在這一頁。注單不是錢,丟了只是要重挑。
  }
}

interface StoredLeg {
  matchPublicId: string;
  marketPublicId: string;
  outcome: string;
  label: string;
  /** bigint 進不了 JSON,存十進位字串。 */
  oddsMilli: string;
  marketTitle: string;
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

/** 舊版或被改壞的內容一律當成空的,不要讓一筆壞資料把整個投注單卡死。 */
function parse(raw: string): SlipState {
  try {
    const obj: unknown = JSON.parse(raw);
    if (typeof obj !== 'object' || obj === null) return EMPTY;
    const { legs, stake } = obj as { legs?: unknown; stake?: unknown };
    if (!Array.isArray(legs)) return EMPTY;
    const parsed: SlipLeg[] = [];
    for (const item of legs as unknown[]) {
      if (typeof item !== 'object' || item === null) return EMPTY;
      const l = item as Partial<StoredLeg>;
      if (
        !isString(l.matchPublicId) ||
        !isString(l.marketPublicId) ||
        !isString(l.outcome) ||
        !isString(l.label) ||
        !isString(l.oddsMilli) ||
        !isString(l.marketTitle) ||
        !/^\d+$/.test(l.oddsMilli)
      ) {
        return EMPTY;
      }
      parsed.push({
        matchPublicId: l.matchPublicId,
        marketPublicId: l.marketPublicId,
        outcome: l.outcome,
        label: l.label,
        oddsMilli: BigInt(l.oddsMilli),
        marketTitle: l.marketTitle,
      });
    }
    return { legs: parsed, stake: sanitizeStake(isString(stake) ? stake : '') };
  } catch {
    return EMPTY;
  }
}

function serialize(state: SlipState): string {
  const legs: StoredLeg[] = state.legs.map((l) => ({ ...l, oddsMilli: l.oddsMilli.toString() }));
  return JSON.stringify({ legs, stake: state.stake });
}

export function readSlip(slug: string): SlipState {
  const raw = readRaw(slug);
  const hit = caches.get(slug);
  if (hit !== undefined && hit.raw === raw) return hit.state;
  const state = raw === null ? EMPTY : parse(raw);
  caches.set(slug, { raw, state });
  return state;
}

function commit(slug: string, state: SlipState): void {
  const raw = state.legs.length === 0 && state.stake === '' ? null : serialize(state);
  writeRaw(slug, raw);
  caches.set(slug, { raw, state });
  listeners.get(slug)?.forEach((l) => {
    l();
  });
}

// ── 動作 ────────────────────────────────────────────────────────

/** 同一場已經有一腿就原位換掉,沒有才接在最後。位置不動,列表才不會在眼前跳。 */
export function addLeg(slug: string, leg: SlipLeg): void {
  const cur = readSlip(slug);
  const at = cur.legs.findIndex((l) => l.matchPublicId === leg.matchPublicId);
  const legs = at < 0 ? [...cur.legs, leg] : cur.legs.map((l, i) => (i === at ? leg : l));
  commit(slug, { ...cur, legs });
}

export function removeLeg(slug: string, matchPublicId: string): void {
  const cur = readSlip(slug);
  commit(slug, { ...cur, legs: cur.legs.filter((l) => l.matchPublicId !== matchPublicId) });
}

/** 只留數字、去掉前導零。輸入框允許暫時是空的,所以不在這裡補 0。 */
export function sanitizeStake(text: string): string {
  const digits = text
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, MAX_STAKE_DIGITS);
  return digits === '0' ? '' : digits;
}

export function setStake(slug: string, text: string): void {
  const cur = readSlip(slug);
  const stake = sanitizeStake(text);
  if (stake === cur.stake) return;
  commit(slug, { ...cur, stake });
}

/**
 * 賠率被伺服器打回來(bet_odds_moved)之後,用新的賠率覆蓋既有的腿。
 * 只換賠率與名稱,腿本身不動 —— 使用者挑的是「這個結果」,不是「這個數字」。
 */
export function replaceOdds(
  slug: string,
  fresh: readonly { marketPublicId: string; outcome: string; label: string; oddsMilli: bigint }[],
): void {
  const cur = readSlip(slug);
  const legs = cur.legs.map((l) => {
    const f = fresh.find((x) => x.marketPublicId === l.marketPublicId && x.outcome === l.outcome);
    return f === undefined ? l : { ...l, oddsMilli: f.oddsMilli, label: f.label };
  });
  commit(slug, { ...cur, legs });
}

export function clear(slug: string): void {
  commit(slug, EMPTY);
}

// ── 算術 ────────────────────────────────────────────────────────

export function stakeAmount(state: Pick<SlipState, 'stake'>): bigint {
  return state.stake === '' ? 0n : BigInt(state.stake);
}

/**
 * 各腿賠率連乘 ×1000。**逐步捨去**,與伺服器 ParlayMultiplierMilli 同一個順序 ——
 * 不是乘完再除。乘完再除在數學上更準,但會和伺服器差一個零頭,
 * 而那個零頭乘上本金就是 expected_payout 對不上的來源。
 *
 * 伺服器另外有 max_parlay 封頂,契約沒把上限給出來,所以這裡不封;
 * 真的撞到頂的注單會被當成賠率變動退回,再確認一次就會拿到伺服器的數字。
 */
export function parlayMultiplierMilli(legs: readonly Pick<SlipLeg, 'oddsMilli'>[]): bigint {
  let m = ODDS_SCALE;
  for (const leg of legs) {
    if (leg.oddsMilli <= ODDS_SCALE) continue;
    m = (m * leg.oddsMilli) / ODDS_SCALE;
  }
  return m;
}

/** 可拿的總額(含本金)。整數捨去,寧可少報也不多報。 */
export function potentialPayout(
  stake: bigint,
  legs: readonly Pick<SlipLeg, 'oddsMilli'>[],
): bigint {
  if (stake <= 0n) return 0n;
  return (stake * parlayMultiplierMilli(legs)) / ODDS_SCALE;
}

// ── 注單成立的廣播 ──────────────────────────────────────────────

/**
 * 同一頁上「我的注單」要在下注成功後馬上多一張,但頁面是 server component,
 * 兩個元件之間傳不了 callback。用一個 DOM 事件比再開一個 store 便宜。
 */
const BET_PLACED_EVENT = 'theatron:bet-placed';

export function notifyBetPlaced(): void {
  window.dispatchEvent(new Event(BET_PLACED_EVENT));
}

export function onBetPlaced(cb: () => void): () => void {
  window.addEventListener(BET_PLACED_EVENT, cb);
  return () => {
    window.removeEventListener(BET_PLACED_EVENT, cb);
  };
}

// ── React 綁定 ──────────────────────────────────────────────────

export interface BetSlipHandle extends SlipState {
  addLeg: (leg: SlipLeg) => void;
  removeLeg: (matchPublicId: string) => void;
  setStake: (text: string) => void;
  clear: () => void;
}

export function useBetSlip(slug: string): BetSlipHandle {
  const subscribe = useCallback(
    (listener: Listener) => {
      let set = listeners.get(slug);
      if (set === undefined) {
        set = new Set();
        listeners.set(slug, set);
      }
      set.add(listener);
      // 另一個分頁改了同一張注單。readSlip 會看到 raw 變了而重新解析。
      const onStorage = (e: StorageEvent) => {
        if (e.key === storageKey(slug) || e.key === null) listener();
      };
      window.addEventListener('storage', onStorage);
      return () => {
        set.delete(listener);
        window.removeEventListener('storage', onStorage);
      };
    },
    [slug],
  );
  const getSnapshot = useCallback(() => readSlip(slug), [slug]);
  // SSR 沒有 localStorage,先給空的;client 接手後 useSyncExternalStore 會自己補一次。
  const state = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  const actions = useMemo(
    () => ({
      addLeg: (leg: SlipLeg) => {
        addLeg(slug, leg);
      },
      removeLeg: (matchPublicId: string) => {
        removeLeg(slug, matchPublicId);
      },
      setStake: (text: string) => {
        setStake(slug, text);
      },
      clear: () => {
        clear(slug);
      },
    }),
    [slug],
  );

  return { ...state, ...actions };
}
