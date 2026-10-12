import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { apply, buildEvent, defaultSnapshot, initialState, marketOdds } from './engine';
import { combinations, exactOdds, rawReturn, roundedReturn, ticketQuote } from './tickets';
import type { Command, Leg, Market, State, Tournament } from './model';
let s: State, e: Tournament;
const run = (c: Command, key = crypto.randomUUID()) => {
  const next = structuredClone(s);
  const id = apply(next, c, key);
  s = next;
  e = s.events[0]!;
  return id;
};
const winners = () => s.markets.filter((m) => m.kind === 'winner');
const leg = (m: Market, outcome = 'p1'): Leg => ({
  marketId: m.id,
  outcome,
  odds: marketOdds(m)[outcome]!,
  label: 'test',
});
const ticket = (
  legs: Leg[],
  sizes = [legs.length],
  unitStake = '100',
  oddsPolicy: 'strict' | 'higher' = 'strict',
): Extract<Command, { type: 'ticket' }> => ({
  type: 'ticket',
  userId: 'u',
  eventId: e.id,
  unitStake,
  legs,
  sizes,
  oddsPolicy,
});
function finish(id: string, side: 'p1' | 'p2' = 'p1') {
  run({ type: 'start', eventId: e.id, matchId: id });
  const m = e.matches.find((m) => m.id === id)!;
  run({
    type: 'draft',
    eventId: e.id,
    matchId: id,
    bouts: [
      { winner: m[side], seconds: 90 },
      { winner: m[side], seconds: 90 },
    ],
  });
  run({ type: 'settle', eventId: e.id, matchId: id, revision: s.revision });
}
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  s = initialState();
  e = buildEvent(s, defaultSnapshot(32), 'test');
  run({
    type: 'register',
    member: { id: 'u', login: 'user', name: 'u', salt: 's', hash: 'h', balance: '0', discord: '' },
  });
});
describe('台灣運彩公開串關機制的點數版本', () => {
  it('新開盤固定報價，投票改變人氣但不改賠率', () => {
    const m = winners()[0]!;
    expect(m.mode).toBe('fixed');
    run({ type: 'vote', userId: 'u', marketId: m.id, outcome: 'p1' });
    expect(marketOdds(winners()[0]!)).toEqual({ p1: '1900', p2: '1900' });
  });
  it('3 場過 2 與 3 關共 4 組，全部本金一起扣且重送不重扣', () => {
    const legs = winners()
      .slice(0, 3)
      .map((m) => leg(m));
    const q = ticketQuote(s.markets, legs, [2, 3], '30');
    expect(q).toMatchObject({ count: 4, cost: '120', maximum: '531' });
    const c = ticket(legs, [2, 3], '30');
    run(c, 'same');
    run(c, 'same');
    expect(s.bets).toHaveLength(1);
    expect(s.bets[0]!.combinations).toHaveLength(4);
    expect(s.members[0]!.balance).toBe('880');
  });
  it('同玩法包 3 個選項串另場 2 選項，6 組不重複同場', () => {
    const a = s.markets.find((m) => m.kind === 'score')!,
      b = winners()[1]!;
    const legs = [
      ...a.options.slice(0, 3).map((o) => leg(a, o.id)),
      ...b.options.map((o) => leg(b, o.id)),
    ];
    const q = ticketQuote(s.markets, legs, [2], '20');
    expect(q).toMatchObject({ count: 6, cost: '120', maximum: '144' });
    expect(q.combos.every((c) => c.length === 2 && c[0]!.marketId !== c[1]!.marketId)).toBe(true);
  });
  it('12 場允許、13 場拒絕；每組須 10 倍數，整筆 100–100000', () => {
    const legs = winners().map((m) => leg(m));
    expect(combinations(s.markets, legs.slice(0, 12), [12])).toHaveLength(1);
    expect(() => combinations(s.markets, legs.slice(0, 13), [13])).toThrow('12');
    for (const stake of ['1', '15', '0', '100001'])
      expect(() => ticketQuote(s.markets, legs.slice(0, 2), [2], stake)).toThrow();
    expect(() => ticketQuote(s.markets, legs.slice(0, 2), [2], '10')).toThrow('至少 100');
    expect(() => ticketQuote(s.markets, legs.slice(0, 3), [1, 2, 3], '20000')).toThrow('100,000');
  });
  it('同場不同玩法、重複選項、名次混串及不符最低過關數拒絕', () => {
    const a = winners()[0]!,
      score = s.markets.find((m) => m.kind === 'score' && m.matchId === a.matchId)!;
    expect(() => combinations(s.markets, [leg(a), leg(score, '2:0')], [2])).toThrow('同場');
    expect(() => combinations(s.markets, [leg(a), leg(a)], [1])).toThrow('重複');
    const place = s.markets.find((m) => m.kind === 'place')!;
    expect(() => combinations(s.markets, [leg(a), leg(place, place.options[0]!.id)], [2])).toThrow(
      '名次',
    );
    a.minLegs = 3;
    expect(() =>
      combinations(
        s.markets,
        winners()
          .slice(0, 3)
          .map((m) => leg(m)),
        [2, 3],
      ),
    ).toThrow('最低');
    expect(
      combinations(
        s.markets,
        winners()
          .slice(0, 3)
          .map((m) => leg(m)),
        [3],
      ),
    ).toHaveLength(1);
  });
  it('保留連乘精度、總額四捨五入，最高 2000 萬點', () => {
    const legs = Array.from({ length: 3 }, () => ({ odds: '1234' }));
    expect(exactOdds(legs)).toBe('1.879080904');
    expect(roundedReturn(rawReturn('100', legs))).toBe('188');
    expect(roundedReturn(rawReturn('1', [{ odds: '1500' }]))).toBe('2');
    expect(
      roundedReturn(
        rawReturn(
          '100000',
          Array.from({ length: 12 }, () => ({ odds: '50000' })),
        ),
      ),
    ).toBe('20000000');
  });
  it('接受較高報價以成交價鎖定，降低拒絕且不扣點', () => {
    const m = winners()[0]!,
      c = ticket([leg(m)], [1], '100', 'higher');
    m.options[0]!.fixed = '2200';
    run(c);
    expect(s.bets[0]!.legs[0]!.odds).toBe('2200');
    expect(s.members[0]!.balance).toBe('900');
    const lower = ticket([leg(winners()[0]!)], [1], '100', 'higher');
    winners()[0]!.options[0]!.fixed = '1800';
    expect(() => run(lower)).toThrow('賠率');
    expect(s.members[0]!.balance).toBe('900');
  });
  it('严格鎖價、總本金超額、關閉市場均原子拒絕', () => {
    const m = winners()[0]!,
      c = ticket([leg(m)]);
    m.options[0]!.fixed = '2100';
    expect(() => run(c)).toThrow('賠率');
    expect(() =>
      run(
        ticket(
          winners()
            .slice(0, 3)
            .map((m) => leg(m)),
          [1, 2, 3],
          '200',
        ),
      ),
    ).toThrow('不足');
    const fresh = ticket([leg(winners()[0]!)]);
    run({ type: 'start', eventId: e.id, matchId: m.matchId });
    expect(() => run(fresh)).toThrow('封盤');
    expect(s.bets).toHaveLength(0);
    expect(s.members[0]!.balance).toBe('1000');
  });
  it('組合可部分中獎，不因一場落敗把所有組合判輸', () => {
    const ms = winners().slice(0, 3);
    run(
      ticket(
        ms.map((m) => leg(m)),
        [2, 3],
        '30',
      ),
    );
    finish(ms[0]!.matchId);
    finish(ms[1]!.matchId);
    expect(s.bets[0]!.status).toBe('open');
    finish(ms[2]!.matchId, 'p2');
    expect(s.bets[0]).toMatchObject({ status: 'won', payout: '108' });
    expect(s.members[0]!.balance).toBe('988');
    expect(() => finish(ms[2]!.matchId)).toThrow();
  });
  it('包牌部分作廢以 1 倍重算，票內各組獨立派彩', () => {
    const [a, b] = winners();
    run(ticket([leg(a!, 'p1'), leg(a!, 'p2'), leg(b!)], [2], '50'));
    run({ type: 'void', marketId: a!.id, reason: '取消' });
    finish(b!.matchId);
    expect(s.bets[0]).toMatchObject({ status: 'won', payout: '190' });
  });
  it('全部作廢退總本金，退款只入帳一次', () => {
    const ms = winners().slice(0, 3);
    run(
      ticket(
        ms.map((m) => leg(m)),
        [2, 3],
        '30',
      ),
    );
    ms.forEach((m) => run({ type: 'void', marketId: m.id, reason: '取消' }));
    expect(s.bets[0]).toMatchObject({ status: 'void', payout: '120' });
    expect(s.members[0]!.balance).toBe('1000');
    expect(s.entries.filter((e) => e.label === '組合注單作廢退款')).toHaveLength(1);
  });
  it('一部分組合作廢退款、其他組合輸，清楚標示部分退款', () => {
    const ms = winners().slice(0, 3);
    run(
      ticket(
        ms.map((m) => leg(m)),
        [2, 3],
        '30',
      ),
    );
    ms.slice(0, 2).forEach((m) => run({ type: 'void', marketId: m.id, reason: '取消' }));
    finish(ms[2]!.matchId, 'p2');
    expect(s.bets[0]).toMatchObject({ status: 'partial', payout: '30' });
  });
  it('轉換旧人氣盤保留當前報價與已成立注單', () => {
    const m = winners()[0]!;
    m.mode = 'popular';
    run({ type: 'vote', userId: 'u', marketId: m.id, outcome: 'p1' });
    const before = marketOdds(winners()[0]!);
    run(ticket([leg(winners()[0]!)]));
    run({ type: 'fixed-event', eventId: e.id });
    run({ type: 'vote', userId: 'u', marketId: m.id, outcome: 'p2' });
    expect(marketOdds(winners()[0]!)).toEqual(before);
    expect(s.bets[0]!.legs[0]!.odds).toBe(before.p1);
  });
});

describe('同場各盤獨立投注', () => {
  const selection = () =>
    s.markets
      .filter((m) => m.matchId === 'm1-0' && ['winner', 'score', 'total'].includes(m.kind))
      .map((m) => leg(m, m.options[0]!.id));
  it('同場三盤各建一筆、重送不重扣，勝負及派彩分開判定', () => {
    const c = { ...ticket(selection()), independent: true };
    const id = run(c, 'singles-once');
    expect(run(c, 'singles-once')).toBe(id);
    expect(s.bets).toHaveLength(3);
    expect(s.members[0]!.balance).toBe('700');
    expect(s.bets.every((b) => b.legs.length === 1 && b.combinations?.length === 1)).toBe(true);
    finish('m1-0');
    expect(s.bets.map((b) => b.status)).toEqual(['won', 'won', 'lost']);
    expect(s.bets.map((b) => b.payout)).toEqual(['190', '380', '0']);
    expect(s.members[0]!.balance).toBe('1270');
  });
  it('個別盤口作廢只退該筆，其他注單仍等待結果', () => {
    const legs = selection();
    run({ ...ticket(legs), independent: true });
    run({ type: 'void', marketId: legs[0]!.marketId, reason: '該盤取消' });
    expect(s.bets.map((b) => b.status)).toEqual(['void', 'open', 'open']);
    expect(s.members[0]!.balance).toBe('800');
  });
  it('後筆封盤或賠率變更、總額不足都不留下部分扣點及注單', () => {
    const legs = selection();
    const c = { ...ticket(legs), independent: true };
    const last = s.markets.find((m) => m.id === legs[2]!.marketId)!;
    last.status = 'closed';
    let before = structuredClone(s);
    expect(() => apply(s, c, 'closed')).toThrow(/封盤/);
    expect(s).toEqual(before);
    last.status = 'open';
    last.options[0]!.fixed = '2200';
    before = structuredClone(s);
    expect(() => apply(s, c, 'stale')).toThrow(/賠率/);
    expect(s).toEqual(before);
    expect(() => run({ ...c, unitStake: '400' })).toThrow(/不足/);
    expect(s).toEqual(before);
  });
  it('同盤重複、未達單注最低金額、禁止單注的盤口不能繞過驗證', () => {
    const legs = selection();
    expect(() => run({ ...ticket([legs[0]!, legs[0]!]), independent: true })).toThrow(/每盤/);
    expect(() => run({ ...ticket(legs, [1], '50'), independent: true })).toThrow(/至少 100/);
    s.markets.find((m) => m.id === legs[0]!.marketId)!.minLegs = 2;
    expect(() => run({ ...ticket(legs), independent: true })).toThrow(/最低過關/);
    expect(s.members[0]!.balance).toBe('1000');
    expect(s.bets).toHaveLength(0);
  });
});
