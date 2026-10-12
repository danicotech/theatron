import { normalizeProfile } from './enrollment';
import { applyManagerCommand } from './managerEngine';
import { applyBp } from './bp';
import { rawReturn, roundedReturn, singlesQuote, ticketQuote } from './tickets';
import type { Bet, Bout, Command, Market, Match, Snapshot, State, Tournament } from './model';
import { parlayMultiplierMilli } from '../betting/betSlipStore';
export const uid = () => crypto.randomUUID();
export const money = (value: string) => BigInt(value).toLocaleString('zh-TW');
export const oddsText = (value: string) =>
  `${BigInt(value) / 1000n}.${(BigInt(value) % 1000n).toString().padStart(3, '0')}`;
const ensure = (ok: unknown, text: string): void => {
  if (!ok) throw new Error(text);
};
const integer = (n: number, min = 0, max = 1_000_000) =>
  Number.isSafeInteger(n) && n >= min && n <= max;
const amount = (s: string) => {
  ensure(/^\d{1,18}$/.test(s), '請輸入有效的整數點數。');
  return BigInt(s);
};
export function initialState(): State {
  return {
    version: 1,
    revision: 0,
    members: [],
    events: [],
    markets: [],
    bets: [],
    entries: [],
    redemptions: [],
    operations: {},
    prizes: [300, 800, 1500].map((n, i) => ({
      id: `prize-${i}`,
      name: `示範獎品${['甲', '乙', '丙'][i]}`,
      description: '本機兌換流程展示，不會寄送或發放實際獎品。',
      price: String(n),
      stock: [5, 3, 1][i]!,
      active: true,
    })),
  };
}
const member = (s: State, id: string) => {
  const m = s.members.find((x) => x.id === id);
  if (!m) throw new Error('請先登入本機會員。');
  return m;
};
const event = (s: State, id: string) => {
  const e = s.events.find((x) => x.id === id);
  if (!e) throw new Error('找不到試玩賽事。');
  return e;
};
const market = (s: State, id: string) => {
  const m = s.markets.find((x) => x.id === id);
  if (!m) throw new Error('找不到盤口。');
  return m;
};
const match = (e: Tournament, id: string) => {
  const m = e.matches.find((x) => x.id === id);
  if (!m) throw new Error('找不到場次。');
  return m;
};
function entry(s: State, userId: string, change: bigint, label: string, ref: string) {
  const m = member(s, userId),
    balance = BigInt(m.balance) + change;
  ensure(balance >= 0n, '可用點數不足。');
  m.balance = String(balance);
  s.entries.push({
    id: uid(),
    userId,
    amount: String(change),
    balance: m.balance,
    label,
    ref,
    created: Date.now(),
  });
}
export function marketOdds(m: Market): Record<string, string> {
  const total = m.options.reduce(
    (n, o) =>
      n +
      BigInt(o.baseline) +
      20n +
      BigInt(Object.values(m.votes).filter((v) => v === o.id).length),
    0n,
  );
  return Object.fromEntries(
    m.options.map((o) => {
      const votes =
        BigInt(o.baseline) + 20n + BigInt(Object.values(m.votes).filter((v) => v === o.id).length);
      const raw = m.mode === 'fixed' ? BigInt(o.fixed) : (950n * total) / votes;
      return [o.id, String(raw < 1050n ? 1050n : raw > 50000n ? 50000n : raw)];
    }),
  );
}
export function totalOdds(legs: readonly { odds: string }[]): string {
  return String(parlayMultiplierMilli(legs.map((l) => ({ oddsMilli: BigInt(l.odds) }))));
}
export function payout(stake: string, legs: readonly { odds: string }[]): string {
  return String(
    (amount(stake) * parlayMultiplierMilli(legs.map((l) => ({ oddsMilli: BigInt(l.odds) })))) /
      1000n,
  );
}
function addMarket(
  s: State,
  e: Tournament,
  m: Match | null,
  kind: Market['kind'],
  round = 0,
  place = 0,
) {
  const id = `${e.id}/${m?.id || 'podium'}/${kind}/${round || place}`;
  if (s.markets.some((x) => x.id === id)) return;
  const name = (id: string) => e.players.find((p) => p.id === id)?.name || '待定';
  const options =
    kind === 'place'
      ? e.players.map((p) => ({ id: p.id, label: p.name }))
      : kind === 'score'
        ? ['2:0', '2:1', '1:2', '0:2'].map((id) => ({ id, label: id }))
        : kind === 'duration' || kind === 'total'
          ? [
              { id: 'under', label: '未滿門檻' },
              { id: 'over', label: '門檻以上' },
            ]
          : [
              { id: 'p1', label: name(m!.p1) },
              { id: 'p2', label: name(m!.p2) },
            ];
  const title =
    kind === 'winner'
      ? '整場勝負'
      : kind === 'score'
        ? 'BO3 比分'
        : kind === 'round'
          ? `第 ${round} 局勝負`
          : kind === 'duration'
            ? `第 ${round} 局時間`
            : kind === 'total'
              ? '整場總時間'
              : ['冠軍', '亞軍', '季軍', '殿軍'][place - 1]!;
  s.markets.push({
    id,
    eventId: e.id,
    matchId: m?.id || '',
    kind,
    title,
    round,
    place,
    line: kind === 'duration' ? 90 : kind === 'total' ? 180 : 0,
    mode: 'fixed',
    minLegs: 1,
    status:
      (kind === 'place' && e.started) || e.disabledMarketKinds?.includes(kind) ? 'closed' : 'open',
    pausedByAdmin: !!e.disabledMarketKinds?.includes(kind),
    result: '',
    reason: '',
    votes: {},
    options: options.map((o) => ({
      ...o,
      fixed: options.length === 2 ? '1900' : String(Math.min(50000, options.length * 950)),
      baseline: 0,
    })),
  });
}
function advance(s: State, e: Tournament) {
  const rounds = [
    ...new Set(e.matches.filter((m) => m.kind === 'bracket').map((m) => m.round)),
  ].sort((a, b) => a - b);
  for (const r of rounds.slice(1))
    for (const m of e.matches.filter((x) => x.round === r && x.kind === 'bracket')) {
      const from = (slot: number) =>
        e.matches.find((x) => x.kind === 'bracket' && x.round === r - 1 && x.slot === slot)
          ?.winner || '';
      m.p1 = from(m.slot * 2);
      m.p2 = from(m.slot * 2 + 1);
    }
  const third = e.matches.find((m) => m.kind === 'third');
  if (third) {
    const semis = e.matches
      .filter((m) => m.kind === 'bracket' && m.round === rounds.at(-2))
      .sort((a, b) => a.slot - b.slot);
    [third.p1, third.p2] = semis.map((m) =>
      m.winner ? (m.winner === m.p1 ? m.p2 : m.p1) : '',
    ) as [string, string];
  }
  for (const m of e.matches)
    if (m.p1 && m.p2 && !m.bye && m.status === 'upcoming') {
      addMarket(s, e, m, 'winner');
      addMarket(s, e, m, 'score');
      addMarket(s, e, m, 'total');
      for (let r = 1; r <= 3; r++) {
        addMarket(s, e, m, 'round', r);
        addMarket(s, e, m, 'duration', r);
      }
    }
}
export function buildEvent(s: State, snapshot: Snapshot, name: string, id = uid()): Tournament {
  const players = structuredClone(snapshot.players);
  ensure(
    players.length >= 2 &&
      players.length <= 64 &&
      new Set(players.map((p) => p.id)).size === players.length &&
      players.every((p) => p.id && p.name),
    '選手人數須為 2–64，且不可重複。',
  );
  const rounds = snapshot.rounds
    .map((r) => ({
      ...r,
      matches: r.matches.filter((m) => m.kind !== 'third').sort((a, b) => a.slot - b.slot),
    }))
    .filter((r) => r.matches.length)
    .sort((a, b) => a.round - b.round);
  const size = 2 ** Math.ceil(Math.log2(players.length));
  ensure(
    rounds.length === Math.log2(size) &&
      rounds.every(
        (r, i) =>
          r.matches.length === size / 2 ** (i + 1) && r.matches.every((m, j) => m.slot === j),
      ),
    '請提供完整的示範淘汰樹。',
  );
  const first = rounds[0]!.matches.flatMap((m) => [m.p1, m.p2]).filter(Boolean);
  ensure(
    first.length === players.length &&
      new Set(first).size === players.length &&
      first.every((id) => players.some((p) => p.id === id)) &&
      rounds[0]!.matches.every((m) => !!m.p1),
    '首輪籤位與參賽名單不一致。',
  );
  const e: Tournament = {
    id,
    name: name.trim() || '百業試鋒 · 試玩',
    players,
    links: {},
    started: false,
    matches: rounds.flatMap((r, i) =>
      r.matches.map((m) => ({
        id: m.id,
        round: i + 1,
        slot: m.slot,
        kind: 'bracket' as const,
        p1: i === 0 ? m.p1 : '',
        p2: i === 0 ? m.p2 : '',
        bye: i === 0 && !m.p2,
        status: i === 0 && !m.p2 ? ('done' as const) : ('upcoming' as const),
        winner: i === 0 && !m.p2 ? m.p1 : '',
        s1: 0,
        s2: 0,
        draft: [],
      })),
    ),
  };
  ensure(new Set(e.matches.map((m) => m.id)).size === e.matches.length, '場次代號不可重複。');
  if (players.length >= 4)
    e.matches.push({
      id: 'podium-third',
      round: rounds.length,
      slot: 0,
      kind: 'third',
      p1: '',
      p2: '',
      bye: false,
      status: 'upcoming',
      winner: '',
      s1: 0,
      s2: 0,
      draft: [],
    });
  s.events.push(e);
  advance(s, e);
  for (let n = 1; n <= (players.length >= 4 ? 4 : 2); n++) addMarket(s, e, null, 'place', 0, n);
  return e;
}
export function defaultSnapshot(count = 8): Snapshot {
  ensure(integer(count, 2, 64), '人數須為 2–64。');
  const players = Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name:
      ['聞人夜', '白十七', '沈青梧', '柳三更', '陸未晞', '崔無咎', '南宮盞', '謝長庚'][i] ||
      `示範俠客 ${i + 1}`,
  }));
  const size = 2 ** Math.ceil(Math.log2(count)),
    slots = size / 2,
    byes = size - count,
    byeSlots = new Set(Array.from({ length: byes }, (_, i) => Math.floor((i * slots) / byes)));
  let cursor = 0;
  const rounds: Snapshot['rounds'] = [];
  for (let r = 1, n = slots; n >= 1; r++, n /= 2)
    rounds.push({
      round: r,
      matches: Array.from({ length: n }, (_, slot) => ({
        id: `m${r}-${slot}`,
        slot,
        p1: r === 1 ? players[cursor++]!.id : '',
        p2: r === 1 && !byeSlots.has(slot) ? players[cursor++]!.id : '',
        bye: r === 1 && byeSlots.has(slot),
      })),
    });
  return { players, rounds };
}
function validateBet(s: State, c: Extract<Command, { type: 'bet' }>) {
  const u = member(s, c.userId),
    e = event(s, c.eventId);
  ensure(
    amount(c.stake) > 0n && amount(c.stake) <= BigInt(u.balance),
    '下注至少 1 點，且不得超過可用餘額。',
  );
  ensure(c.legs.length >= 1 && c.legs.length <= 12, '請選擇 1–12 個結果。');
  const markets = c.legs.map((l) => market(s, l.marketId));
  ensure(
    markets.every((m) => m.eventId === e.id && m.status === 'open'),
    '盤口已封盤或不屬於本屆。',
  );
  ensure(c.legs.length === 1 || markets.every((m) => m.kind !== 'place'), '名次盤僅限單注。');
  ensure(new Set(markets.map((m) => m.matchId)).size === markets.length, '同場只能選擇一個盤口。');
  for (const [i, m] of markets.entries()) {
    const l = c.legs[i]!;
    ensure(
      m.options.some((o) => o.id === l.outcome),
      '投注選項不存在。',
    );
    ensure(marketOdds(m)[l.outcome] === l.odds, '賠率已變動，請更新注單並重新確認。');
    const player = e.links[u.id];
    if (player) {
      ensure(m.kind !== 'place', '參賽者不能投注本屆名次盤。');
      const bout = match(e, m.matchId);
      ensure(![bout.p1, bout.p2].includes(player), '不能投注自己參與的場次。');
    }
  }
}
export function resultOf(m: Match, bouts: Bout[]) {
  ensure(bouts.length >= 2 && bouts.length <= 3, '請填寫實際進行的 2 或 3 局。');
  let a = 0,
    b = 0;
  for (const bout of bouts) {
    ensure(a < 2 && b < 2, '已取得兩勝，不得增加局數。');
    ensure(
      [m.p1, m.p2].includes(bout.winner) && integer(bout.seconds, 1, 86400),
      '每局須選擇勝者，並填寫 1–86400 整數秒。',
    );
    if (bout.winner === m.p1) a++;
    else b++;
  }
  ensure(a === 2 || b === 2, 'BO3 尚未產生勝者。');
  return { s1: a, s2: b, winner: a === 2 ? m.p1 : m.p2 };
}
function resolveBets(s: State) {
  for (const b of s.bets.filter((b) => b.status === 'open')) {
    if (b.rules === 'tw-v1' && b.combinations && b.unitStake) {
      const results = b.combinations.map((legs) => {
        const states = legs.map((l) => {
          const m = market(s, l.marketId);
          return m.status === 'void'
            ? 'void'
            : m.status === 'settled'
              ? m.result === l.outcome
                ? 'won'
                : 'lost'
              : 'pending';
        });
        const status = states.includes('lost')
          ? 'lost'
          : states.includes('pending')
            ? 'pending'
            : states.every((x) => x === 'void')
              ? 'void'
              : 'won';
        const raw =
          status === 'lost' || status === 'pending'
            ? 0n
            : rawReturn(
                b.unitStake!,
                legs.map((l, i) => ({ ...l, odds: states[i] === 'void' ? '1000' : l.odds })),
              );
        return { status, raw };
      });
      if (results.some((r) => r.status === 'pending')) continue;
      b.status = results.every((r) => r.status === 'void')
        ? 'void'
        : results.some((r) => r.status === 'won')
          ? 'won'
          : results.some((r) => r.status === 'void')
            ? 'partial'
            : 'lost';
      b.payout = roundedReturn(results.reduce((n, r) => n + r.raw, 0n));
      if (BigInt(b.payout) > 0n)
        entry(
          s,
          b.userId,
          BigInt(b.payout),
          b.status === 'won' ? '組合注單派彩' : '組合注單作廢退款',
          b.id,
        );
      continue;
    }
    const outcomes = b.legs.map((l) => {
      const m = market(s, l.marketId);
      return m.status === 'void'
        ? 'void'
        : m.status === 'settled'
          ? m.result === l.outcome
            ? 'won'
            : 'lost'
          : 'pending';
    });
    if (outcomes.includes('lost')) {
      b.status = 'lost';
      b.payout = '0';
      continue;
    }
    if (outcomes.includes('pending')) continue;
    const allVoid = outcomes.every((x) => x === 'void');
    b.status = allVoid ? 'void' : 'won';
    b.payout = allVoid
      ? b.stake
      : payout(
          b.stake,
          b.legs.map((l, i) => ({ ...l, odds: outcomes[i] === 'void' ? '1000' : l.odds })),
        );
    entry(s, b.userId, BigInt(b.payout), allVoid ? '注單作廢退款' : '中獎派彩', b.id);
  }
}
function settle(s: State, e: Tournament, m: Match) {
  ensure(m.status === 'live', '請先開始比賽；已結算場次不可重複改判。');
  const result = resultOf(m, m.draft);
  Object.assign(m, result, { status: 'done' });
  for (const p of s.markets.filter(
    (x) => x.eventId === e.id && x.matchId === m.id && x.status !== 'void',
  )) {
    const bout = m.draft[p.round - 1];
    if ((p.kind === 'round' || p.kind === 'duration') && !bout) {
      p.status = 'void';
      p.reason = '本局未進行';
      continue;
    }
    p.status = 'settled';
    p.result =
      p.kind === 'winner'
        ? m.winner === m.p1
          ? 'p1'
          : 'p2'
        : p.kind === 'score'
          ? `${m.s1}:${m.s2}`
          : p.kind === 'round'
            ? bout!.winner === m.p1
              ? 'p1'
              : 'p2'
            : (p.kind === 'total' ? m.draft.reduce((n, b) => n + b.seconds, 0) : bout!.seconds) >=
                p.line
              ? 'over'
              : 'under';
  }
  const last = Math.max(...e.matches.filter((x) => x.kind === 'bracket').map((x) => x.round));
  if (m.kind === 'third' || m.round === last) {
    const place = m.kind === 'third' ? 3 : 1;
    for (const p of s.markets.filter(
      (x) =>
        x.eventId === e.id &&
        x.kind === 'place' &&
        [place, place + 1].includes(x.place) &&
        x.status !== 'void',
    )) {
      p.status = 'settled';
      p.result = p.place === place ? m.winner : m.winner === m.p1 ? m.p2 : m.p1;
    }
  }
  advance(s, e);
  resolveBets(s);
}
/** Execute on an isolated copy inside a single IDB read/write transaction. */
export function apply(s: State, c: Command, key: string): string {
  ensure(!!key, '缺少操作代號。');
  const signature = JSON.stringify(c),
    previous = s.operations[key];
  if (previous) {
    ensure(previous.signature === signature, '操作代號已被其他內容使用。');
    return previous.result;
  }
  let answer = '';
  switch (c.type) {
    case 'market-admin':
    case 'raffle':
    case 'award':
    case 'ceremony-deliver':
      answer = applyManagerCommand(s, c);
      break;
    case 'reseed': {
      const current = event(s, c.eventId);
      ensure(
        !current.started && !s.bets.some((b) => b.eventId === current.id),
        '已有注單或已開賽，籤位已鎖定。',
      );
      ensure(
        c.playerIds.length === current.players.length &&
          new Set(c.playerIds).size === current.players.length &&
          c.playerIds.every((id) => current.players.some((p) => p.id === id)),
        '籤位必須包含全部選手且不可重複。',
      );
      const snapshot = defaultSnapshot(c.playerIds.length);
      const map = new Map(snapshot.players.map((p, i) => [p.id, c.playerIds[i]!]));
      snapshot.players = c.playerIds.map((id) => current.players.find((p) => p.id === id)!);
      snapshot.rounds.forEach((r) =>
        r.matches.forEach((m) => {
          m.p1 = map.get(m.p1) || '';
          m.p2 = map.get(m.p2) || '';
        }),
      );
      const next = structuredClone(s);
      next.events = next.events.filter((e) => e.id !== current.id);
      const previousMarkets = next.markets.filter((m) => m.eventId === current.id);
      next.markets = next.markets.filter((m) => m.eventId !== current.id);
      const rebuilt = buildEvent(next, snapshot, current.name, current.id);
      rebuilt.links = structuredClone(current.links);
      if (current.registration) rebuilt.registration = structuredClone(current.registration);
      if (current.ceremony) rebuilt.ceremony = structuredClone(current.ceremony);
      if (current.bpRanks) rebuilt.bpRanks = structuredClone(current.bpRanks);
      if (current.disabledMarketKinds)
        rebuilt.disabledMarketKinds = [...current.disabledMarketKinds];
      rebuilt.bpSelections = [];
      // Preserve configured titles, prices and switches; refresh player labels and votes.
      next.markets
        .filter((m) => m.eventId === current.id)
        .forEach((m) => {
          if (current.disabledMarketKinds?.includes(m.kind)) {
            m.status = 'closed';
            m.pausedByAdmin = true;
          }
          const previous = previousMarkets.find((p) => p.id === m.id);
          if (!previous) return;
          m.title = previous.title;
          m.mode = previous.mode;
          m.line = previous.line;
          if (previous.minLegs !== undefined) m.minLegs = previous.minLegs;
          if (previous.pausedByAdmin) {
            m.pausedByAdmin = true;
            m.status = 'closed';
          }
          if (previous.status === 'void') {
            m.status = 'void';
            m.reason = previous.reason;
          }
          for (const option of m.options) {
            const old = previous.options.find((o) => o.id === option.id);
            if (old) {
              option.fixed = old.fixed;
              option.baseline = old.baseline;
            }
          }
        });
      Object.assign(s, next);
      break;
    }
    case 'bp-rank':
    case 'bp-select':
    case 'bp-remove':
    case 'bp-refund':
      answer = applyBp(s, c);
      break;
    case 'registration-open': {
      // Resolve and create in the same transaction: concurrent tabs share one
      // enrollment activity. A closed activity stays closed until management acts.
      const existing = s.events.findLast((e) => !!e.registration);
      answer =
        existing?.id ||
        apply(
          s,
          { type: 'activity-create', name: '百業試鋒 · 本機報名', capacity: 64 },
          key + ':create',
        );
      break;
    }
    case 'activity-create': {
      ensure(c.name.trim() && c.name.trim().length <= 80, '活動名稱須為 1–80 字。');
      ensure(integer(c.capacity, 2, 64), '人數上限須為 2–64。');
      const id = uid();
      s.events.push({
        id,
        name: c.name.trim(),
        players: [],
        matches: [],
        links: {},
        started: false,
        registration: { capacity: c.capacity, open: true, published: false, entries: [] },
      });
      answer = id;
      break;
    }
    case 'activity-update': {
      const e = event(s, c.eventId),
        r = e.registration;
      ensure(r, '既有快照請另開報名活動。');
      ensure(!e.started && !r!.published, '對局已發布，活動設定已鎖定。');
      ensure(c.name.trim() && c.name.trim().length <= 80, '活動名稱須為 1–80 字。');
      ensure(
        integer(c.capacity, 2, 64) &&
          c.capacity >= r!.entries.filter((x) => x.status === 'confirmed').length,
        '人數上限不得小於已報名人數，且須為 2–64。',
      );
      e.name = c.name.trim();
      r!.capacity = c.capacity;
      r!.open = c.open;
      break;
    }
    case 'enroll': {
      const u = member(s, c.userId),
        e = event(s, c.eventId),
        r = e.registration;
      ensure(!u.anonymous, '請以註冊會員報名。');
      ensure(r?.open && !r.published && !e.started, '報名已關閉或對局已發布。');
      const old = r!.entries.find((x) => x.userId === u.id);
      const gameId = c.gameId.trim(),
        name = c.name.trim();
      ensure(
        gameId && gameId.length <= 64 && name && name.length <= 40,
        '請填寫遊戲 ID（最多 64 字）及角色姓名（最多 40 字）。',
      );
      ensure(
        !r!.entries.some(
          (x) => x.userId !== u.id && x.gameId.toLowerCase() === gameId.toLowerCase(),
        ),
        '此遊戲 ID 已在本屆報名。',
      );
      const character = {
        style: c.character.style.trim(),
        weapon: c.character.weapon.trim(),
        equipment: c.character.equipment.trim(),
        arts: c.character.arts.trim(),
      };
      ensure(
        Object.values(character).every((v) => v.length <= 4000),
        '角色欄位最多 4,000 字。',
      );
      const profile = c.profile ? normalizeProfile(c.profile) : old?.profile;
      const complete = c.complete || old?.status === 'confirmed';
      if (complete && profile)
        ensure(profile.experience && profile.availability, '請填寫對戰經驗與可參賽時段。');
      if (complete) {
        ensure(c.rulesAccepted, '請先確認已閱讀規則。');
        ensure(
          character.style && character.weapon && character.equipment && character.arts,
          '請完成流派、武器、裝備及武學設定。',
        );
        ensure(
          old?.status === 'confirmed' ||
            r!.entries.filter((x) => x.status === 'confirmed').length < r!.capacity,
          '報名人數已滿。',
        );
      }
      const entry = {
        userId: u.id,
        playerId: old?.playerId || uid(),
        ...(profile ? { profile } : {}),
        updatedAt: Date.now(),
        gameId,
        name,
        character,
        rulesAccepted: c.rulesAccepted,
        status: complete ? ('confirmed' as const) : ('draft' as const),
      };
      if (old) r!.entries[r!.entries.indexOf(old)] = entry;
      else r!.entries.push(entry);
      answer = entry.playerId;
      break;
    }
    case 'publish-roster': {
      const e = event(s, c.eventId),
        r = e.registration;
      ensure(
        r && !r.open && !r.published && !e.started && !s.bets.some((b) => b.eventId === e.id),
        '請先關閉報名；已發布或有注單的活動不能重排。',
      );
      ensure(
        c.playerIds.length >= 2 &&
          c.playerIds.length <= r!.capacity &&
          new Set(c.playerIds).size === c.playerIds.length,
        '請選擇 2–64 名不重複的報名者。',
      );
      const entries = c.playerIds.map((id) =>
        r!.entries.find((x) => x.playerId === id && x.status === 'confirmed'),
      );
      ensure(entries.every(Boolean), '只能安排已完成報名的選手。');
      const snapshot = defaultSnapshot(entries.length);
      const mapping = new Map(snapshot.players.map((p, i) => [p.id, entries[i]!.playerId]));
      snapshot.players = entries.map((x) => ({
        id: x!.playerId,
        name: x!.name,
        character: x!.character,
      }));
      snapshot.rounds.forEach((round) =>
        round.matches.forEach((m) => {
          m.p1 = mapping.get(m.p1) || '';
          m.p2 = mapping.get(m.p2) || '';
        }),
      );
      const next = structuredClone(s);
      next.events = next.events.filter((x) => x.id !== e.id);
      const published = buildEvent(next, snapshot, e.name, e.id);
      if (e.disabledMarketKinds) {
        published.disabledMarketKinds = [...e.disabledMarketKinds];
        next.markets
          .filter((m) => m.eventId === e.id && e.disabledMarketKinds!.includes(m.kind))
          .forEach((m) => {
            m.status = 'closed';
            m.pausedByAdmin = true;
          });
      }
      if (e.ceremony) published.ceremony = structuredClone(e.ceremony);
      published.registration = { ...structuredClone(r!), published: true, open: false };
      published.links = Object.fromEntries(entries.map((x) => [x!.userId, x!.playerId]));
      Object.assign(s, next);
      break;
    }
    case 'fixed-event': {
      event(s, c.eventId);
      for (const m of s.markets.filter((m) => m.eventId === c.eventId && m.status === 'open')) {
        const prices = marketOdds(m);
        m.options.forEach((o) => {
          o.fixed = prices[o.id]!;
        });
        m.mode = 'fixed';
      }
      break;
    }
    case 'guest': {
      const existing = s.members.find((m) => m.anonymous);
      if (existing) {
        answer = existing.id;
        break;
      }
      const id = uid();
      s.members.push({
        id,
        anonymous: true,
        login: '',
        name: '匿名俠客',
        salt: '',
        hash: '',
        discord: '',
        balance: '0',
      });
      entry(s, id, 1000n, '匿名首次試玩贈點', id);
      answer = id;
      break;
    }
    case 'register': {
      const u = structuredClone(c.member);
      ensure(!u.anonymous, '匿名試玩請使用專用入口。');
      u.login = u.login.trim().toLowerCase();
      u.name = u.name.trim();
      u.discord = u.discord.trim().toLowerCase();
      ensure(u.name && u.name.length <= 40, '暱稱須為 1–40 字。');
      ensure(
        !s.members.some(
          (m) =>
            m.id === u.id ||
            (u.login && m.login === u.login) ||
            (u.discord && m.discord === u.discord),
        ),
        '帳號或 Discord 身分已存在。',
      );
      ensure(u.login || u.discord, '請提供帳號或模擬 Discord 身分。');
      ensure(
        !u.login || (/^[a-z0-9_.-]{3,32}$/.test(u.login) && !!u.salt && !!u.hash),
        '帳號須為 3–32 位英數字、底線、點或連字號。',
      );
      u.balance = '0';
      s.members.push(u);
      entry(s, u.id, 1000n, '首次註冊贈點', u.id);
      answer = u.id;
      break;
    }
    case 'bind': {
      const u = member(s, c.userId),
        d = c.discord.trim().toLowerCase();
      ensure(!u.anonymous, '請登入會員後再綁定 Discord。');
      ensure(d, '請填寫模擬 Discord 身分。');
      ensure(
        !s.members.some((m) => m.discord === d && m.id !== u.id),
        '此身分已綁定其他會員，不自動合併帳號。',
      );
      ensure(!u.discord || u.discord === d, '此會員已綁定 Discord。');
      u.discord = d;
      break;
    }
    case 'create':
      answer = buildEvent(s, c.snapshot, c.name).id;
      break;
    case 'link': {
      const e = event(s, c.eventId);
      ensure(!e.registration?.published, '報名活動的會員對應由名單自動產生，不可解除。');
      member(s, c.userId);
      ensure(
        !e.started && !s.bets.some((b) => b.eventId === e.id),
        '已有注單或已開賽，會員選手對應已鎖定。',
      );
      ensure(!c.playerId || e.players.some((p) => p.id === c.playerId), '找不到選手。');
      ensure(
        !c.playerId ||
          !Object.entries(e.links).some(([u, p]) => u !== c.userId && p === c.playerId),
        '這位選手已綁定其他會員。',
      );
      e.links[c.userId] = c.playerId;
      break;
    }
    case 'vote': {
      member(s, c.userId);
      const m = market(s, c.marketId);
      ensure(m.status === 'open', '已封盤，不能投票。');
      ensure(
        m.options.some((o) => o.id === c.outcome),
        '找不到選項。',
      );
      // Each market stores one replaceable vote per member.
      m.votes[c.userId] = c.outcome;
      break;
    }
    case 'configure': {
      const m = market(s, c.marketId);
      ensure(m.status === 'open', '只有未封盤盤口可調整。');
      ensure(['popular', 'fixed'].includes(c.mode), '未知賠率模式。');
      ensure(integer(c.line, 0, 86400 * 3), '秒數門檻無效。');
      ensure(
        c.line === m.line || !s.bets.some((b) => b.legs.some((l) => l.marketId === m.id)),
        '已有注單，時間門檻已鎖定。',
      );
      ensure(!['duration', 'total'].includes(m.kind) || c.line > 0, '時間門檻須大於 0。');
      for (const o of m.options) {
        const v = c.options.find((x) => x.id === o.id);
        ensure(v && integer(v.baseline), '基礎票數須為 0–1000000 整數。');
        ensure(
          /^\d+$/.test(v!.fixed) && BigInt(v!.fixed) >= 1050n && BigInt(v!.fixed) <= 50000n,
          '賠率須為 1.05–50.00。',
        );
        o.fixed = v!.fixed;
        o.baseline = v!.baseline;
      }
      ensure(c.minLegs === undefined || integer(c.minLegs, 1, 12), '最低過關數須為 1–12。');
      if (c.minLegs !== undefined) m.minLegs = m.kind === 'place' ? 1 : c.minLegs;
      m.mode = c.mode;
      m.line = c.line;
      break;
    }
    case 'ticket': {
      if (c.independent) {
        const quote = singlesQuote(s.markets, c.legs, c.unitStake);
        ensure(BigInt(quote.cost) <= BigInt(member(s, c.userId).balance), '可用點數不足。');
        const next = structuredClone(s);
        const ids = c.legs.map((leg) =>
          apply(
            next,
            {
              ...c,
              independent: false,
              legs: [leg],
              sizes: [1],
            },
            uid(),
          ),
        );
        Object.assign(s, next);
        answer = ids.join(',');
        break;
      }
      ensure(['strict', 'higher'].includes(c.oddsPolicy), '賠率接受設定無效。');
      const locked = c.legs.map((l) => {
        const m = market(s, l.marketId),
          live = marketOdds(m)[l.outcome];
        ensure(
          live &&
            /^\d+$/.test(l.odds) &&
            (live === l.odds || (c.oddsPolicy === 'higher' && BigInt(live) >= BigInt(l.odds))),
          '賠率已變動，請更新注單並重新確認。',
        );
        return {
          ...l,
          odds: live!,
          label: `${m.matchId ? m.matchId + ' · ' : ''}${m.title} · ${m.options.find((o) => o.id === l.outcome)!.label}`,
        };
      });
      const quote = ticketQuote(s.markets, locked, c.sizes, c.unitStake);
      ensure(BigInt(quote.cost) <= BigInt(member(s, c.userId).balance), '可用點數不足。');
      for (const legs of quote.combos)
        validateBet(s, {
          type: 'bet',
          userId: c.userId,
          eventId: c.eventId,
          stake: c.unitStake,
          legs,
        });
      const b: Bet = {
        id: uid(),
        userId: c.userId,
        eventId: c.eventId,
        stake: quote.cost,
        legs: locked,
        rules: 'tw-v1',
        unitStake: c.unitStake,
        sizes: [...c.sizes],
        combinations: quote.combos,
        payout: '0',
        status: 'open',
        created: Date.now(),
      };
      entry(s, c.userId, -BigInt(quote.cost), '組合下注扣點', b.id);
      s.bets.push(b);
      answer = b.id;
      break;
    }
    case 'bet': {
      validateBet(s, c);
      const b: Bet = {
        id: uid(),
        userId: c.userId,
        eventId: c.eventId,
        stake: String(amount(c.stake)),
        legs: c.legs.map((l) => {
          const m = market(s, l.marketId);
          return {
            ...l,
            label: `${m.title} · ${m.options.find((o) => o.id === l.outcome)!.label}`,
          };
        }),
        payout: '0',
        status: 'open',
        created: Date.now(),
      };
      entry(s, c.userId, -amount(c.stake), '下注扣點', b.id);
      s.bets.push(b);
      answer = b.id;
      break;
    }
    case 'start': {
      const e = event(s, c.eventId),
        m = match(e, c.matchId);
      ensure(m.status === 'upcoming' && m.p1 && m.p2 && !m.bye, '此場不能開始。');
      e.started = true;
      m.status = 'live';
      for (const p of s.markets.filter(
        (x) =>
          x.eventId === e.id && (x.matchId === m.id || x.kind === 'place') && x.status === 'open',
      ))
        p.status = 'closed';
      break;
    }
    case 'draft': {
      const e = event(s, c.eventId),
        m = match(e, c.matchId);
      ensure(m.status !== 'done' && m.p1 && m.p2 && !m.bye, '此場不可編輯。');
      resultOf(m, c.bouts);
      m.draft = structuredClone(c.bouts);
      break;
    }
    case 'settle': {
      ensure(c.revision === s.revision, '資料已更新，請重新檢查結算摘要。');
      const e = event(s, c.eventId);
      settle(s, e, match(e, c.matchId));
      break;
    }
    case 'void': {
      const m = market(s, c.marketId);
      ensure(['open', 'closed'].includes(m.status), '已結算或已作廢盤口不可修改。');
      ensure(c.reason.trim(), '請填寫作廢原因。');
      m.status = 'void';
      m.reason = c.reason.trim();
      resolveBets(s);
      break;
    }
    case 'prize': {
      const p = structuredClone(c.prize);
      ensure(
        p.name.trim() && p.name.length <= 80 && amount(p.price) > 0n && integer(p.stock),
        '請填名稱、正整數價格與有效庫存。',
      );
      const index = s.prizes.findIndex((x) => x.id === p.id);
      if (index < 0) s.prizes.push(p);
      else s.prizes[index] = p;
      break;
    }
    case 'redeem': {
      member(s, c.userId);
      const p = s.prizes.find((x) => x.id === c.prizeId);
      ensure(p?.active && p.stock > 0, '獎品已下架或庫存不足。');
      ensure(p!.price === c.price, '獎品價格已變動，請重新確認。');
      const id = uid();
      entry(s, c.userId, -amount(p!.price), '兌換扣點', id);
      p!.stock--;
      s.redemptions.push({
        id,
        userId: c.userId,
        prizeId: p!.id,
        name: p!.name,
        price: p!.price,
        status: 'pending',
        created: Date.now(),
      });
      answer = id;
      break;
    }
    case 'redemption': {
      const r = s.redemptions.find((x) => x.id === c.id);
      ensure(r, '找不到兌換單。');
      if (r!.status === c.status) break;
      ensure(
        c.actor === 'admin' ||
          (c.actor === r!.userId && r!.status === 'pending' && c.status === 'cancelled'),
        '無法操作此兌換單。',
      );
      ensure(
        (r!.status === 'pending' && ['approved', 'cancelled'].includes(c.status)) ||
          (r!.status === 'approved' && ['delivered', 'cancelled'].includes(c.status)),
        '兌換狀態不能倒退或重複發放。',
      );
      if (c.status === 'cancelled') {
        entry(s, r!.userId, BigInt(r!.price), '兌換取消退款', r!.id);
        s.prizes.find((p) => p.id === r!.prizeId)!.stock++;
      }
      r!.status = c.status;
      break;
    }
  }
  s.revision++;
  s.operations[key] = { signature, result: answer };
  return answer;
}
export function settlementPreview(s: State, eventId: string, matchId: string) {
  const next = structuredClone(s);
  apply(next, { type: 'settle', eventId, matchId, revision: s.revision }, 'preview');
  const entries = next.entries.slice(s.entries.length);
  return {
    count: next.bets.filter((b, i) => b.status !== s.bets[i]?.status).length,
    total: entries.reduce((n, e) => n + BigInt(e.amount), 0n).toString(),
    revision: s.revision,
  };
}
