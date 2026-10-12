import type { Leg, Market } from './model';

export const MAX_MATCHES = 12;
export const MAX_TICKET_STAKE = 100_000n;
export const MAX_TICKET_PAYOUT = 20_000_000n;
const SCALE = 1000n ** 12n;
function requireValue(ok: unknown, message: string) {
  if (!ok) throw new Error(message);
}
/** All products retain precision until the ticket total is rounded half-up. */
export function rawReturn(stake: string, legs: readonly Pick<Leg, 'odds'>[]): bigint {
  requireValue(legs.length <= MAX_MATCHES && /^\d{1,18}$/.test(stake), '無效組合。');
  let n = BigInt(stake);
  for (const leg of legs) {
    requireValue(/^\d+$/.test(leg.odds) && BigInt(leg.odds) >= 1000n, '無效賠率。');
    n *= BigInt(leg.odds);
  }
  return n * 1000n ** BigInt(12 - legs.length);
}
export function roundedReturn(raw: bigint): string {
  const result = (raw + SCALE / 2n) / SCALE;
  return String(result > MAX_TICKET_PAYOUT ? MAX_TICKET_PAYOUT : result);
}
export function exactOdds(legs: readonly Pick<Leg, 'odds'>[]): string {
  const n = rawReturn('1', legs),
    whole = n / SCALE,
    fraction = (n % SCALE).toString().padStart(36, '0').replace(/0+$/, '');
  return `${whole}.${(fraction || '').padEnd(3, '0')}`;
}
export function combinations(
  markets: readonly Market[],
  legs: readonly Leg[],
  sizes: readonly number[],
): Leg[][] {
  requireValue(legs.length > 0 && legs.length <= 64, '請選擇投注結果（最多 64 個選項）。');
  requireValue(
    new Set(legs.map((l) => `${l.marketId}\0${l.outcome}`)).size === legs.length,
    '請勿重複同一投注選項。',
  );
  const groups = new Map<string, Leg[]>(),
    matches = new Map<string, string>();
  for (const l of legs) {
    const m = markets.find((m) => m.id === l.marketId);
    requireValue(m && m.options.some((o) => o.id === l.outcome), '找不到盤口或選項。');
    if (m!.kind === 'place')
      requireValue(legs.length === 1 && sizes.length === 1 && sizes[0] === 1, '名次盤僅限單注。');
    const previous = matches.get(m!.matchId || m!.id);
    requireValue(!previous || previous === m!.id, '同場只能選擇一種玩法，不得同場串關。');
    matches.set(m!.matchId || m!.id, m!.id);
    groups.set(m!.id, [...(groups.get(m!.id) || []), l]);
  }
  const list = [...groups.values()];
  requireValue(list.length <= MAX_MATCHES, '最多可選 12 場比賽。');
  requireValue(
    sizes.length > 0 &&
      new Set(sizes).size === sizes.length &&
      sizes.every((n) => Number.isInteger(n) && n >= 1 && n <= list.length),
    '請選擇有效的過關數。',
  );
  const result: Leg[][] = [];
  function visit(start: number, count: number, chosen: Leg[]) {
    if (count === 0) {
      requireValue(
        chosen.every(
          (l) => (markets.find((m) => m.id === l.marketId)!.minLegs || 1) <= chosen.length,
        ),
        '組合未達盤口最低過關數。',
      );
      requireValue(result.length < 10_000, '組合超過 10,000 組，請減少包牌或過關數。');
      result.push(chosen);
      return;
    }
    for (let i = start; i <= list.length - count; i++)
      for (const l of list[i]!) visit(i + 1, count - 1, [...chosen, l]);
  }
  for (const count of [...sizes].sort((a, b) => a - b)) visit(0, count, []);
  return result;
}
export function ticketQuote(
  markets: readonly Market[],
  legs: readonly Leg[],
  sizes: readonly number[],
  unitStake: string,
) {
  requireValue(
    /^\d{1,18}$/.test(unitStake) && BigInt(unitStake) >= 10n && BigInt(unitStake) % 10n === 0n,
    '每組金額須為 10 點的正整數倍。',
  );
  const combos = combinations(markets, legs, sizes),
    cost = BigInt(unitStake) * BigInt(combos.length);
  requireValue(cost >= 100n && cost <= MAX_TICKET_STAKE, '每筆合計至少 100 點、最多 100,000 點。');
  const best = new Map<string, Leg>();
  for (const l of legs)
    if (!best.has(l.marketId) || BigInt(l.odds) > BigInt(best.get(l.marketId)!.odds))
      best.set(l.marketId, l);
  // One outcome per market can win: never add mutually exclusive alternatives as simultaneous winnings.
  const maximum = roundedReturn(
    combinations(markets, [...best.values()], sizes).reduce(
      (sum, c) => sum + rawReturn(unitStake, c),
      0n,
    ),
  );
  return { combos, cost: String(cost), maximum, count: combos.length };
}

/** One independent ticket per market; never multiply correlated same-match selections. */
export function singlesQuote(markets: readonly Market[], legs: readonly Leg[], unitStake: string) {
  requireValue(legs.length > 0 && legs.length <= 64, '請選擇 1–64 個盤口。');
  requireValue(
    new Set(legs.map((l) => l.marketId)).size === legs.length,
    '各盤單獨投注每盤只能選一個結果。',
  );
  const tickets = legs.map((l) => ticketQuote(markets, [l], [1], unitStake));
  const cost = tickets.reduce((sum, q) => sum + BigInt(q.cost), 0n);
  requireValue(cost <= MAX_TICKET_STAKE, '本次合計最多 100,000 點。');
  return {
    combos: legs.map((l) => [l]),
    count: legs.length,
    cost: String(cost),
    maximum: String(tickets.reduce((sum, q) => sum + BigInt(q.maximum), 0n)),
  };
}
