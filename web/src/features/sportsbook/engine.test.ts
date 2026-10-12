import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  apply,
  buildEvent,
  defaultSnapshot,
  initialState,
  marketOdds,
  payout,
  settlementPreview,
} from './engine';
import type { Command, Market, State, Tournament } from './model';
let s: State, e: Tournament;
const cmd = (c: Command, key = crypto.randomUUID()) => {
  const next = structuredClone(s);
  const result = apply(next, c, key);
  Object.assign(s, next);
  e = s.events[0]!;
  return result;
};
const account = (id = 'u') =>
  cmd({
    type: 'register',
    member: {
      id,
      login: id + 'ser',
      name: id,
      salt: 'salt',
      hash: 'hash',
      discord: '',
      balance: '999999',
    },
  });
const get = (kind: Market['kind'], matchId = 'm1-0', round = 0) =>
  s.markets.find(
    (m) =>
      m.eventId === e.id &&
      m.kind === kind &&
      m.matchId === matchId &&
      (round ? m.round === round : true),
  )!;
const bet = (m: Market, outcome: string, stake = '100') =>
  cmd({
    type: 'bet',
    userId: 'u',
    eventId: e.id,
    stake,
    legs: [{ marketId: m.id, outcome, odds: marketOdds(m)[outcome]!, label: 'test' }],
  });
function finish(id: string, seconds = [90, 80], winnerSide: 'p1' | 'p2' = 'p1') {
  let m = e.matches.find((m) => m.id === id)!;
  cmd({ type: 'start', eventId: e.id, matchId: id });
  m = e.matches.find((m) => m.id === id)!;
  cmd({
    type: 'draft',
    eventId: e.id,
    matchId: id,
    bouts: seconds.map((duration, i) => ({
      winner:
        seconds.length === 3 && i === 1 ? m[winnerSide === 'p1' ? 'p2' : 'p1'] : m[winnerSide],
      seconds: duration,
    })),
  });
  cmd({ type: 'settle', eventId: e.id, matchId: id, revision: s.revision });
}
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  s = initialState();
  e = buildEvent(s, defaultSnapshot(4), '測試');
  account();
});
describe('會員、帳本與賠率', () => {
  it('每會員只贈 1000、綁定不重領、重試冪等且拒絕撞帳號', () => {
    expect(s.members[0]!.balance).toBe('1000');
    cmd({ type: 'bind', userId: 'u', discord: 'A' });
    expect(s.entries).toHaveLength(1);
    expect(() => account()).toThrow('已存在');
    const c: Command = {
      type: 'register',
      member: {
        id: 'v',
        login: 'viewer',
        name: 'v',
        salt: 's',
        hash: 'h',
        discord: '',
        balance: '0',
      },
    };
    cmd(c, 'same');
    cmd(c, 'same');
    expect(s.members).toHaveLength(2);
    expect(s.members[1]!.balance).toBe('1000');
    expect(() => cmd({ ...c, member: { ...c.member, id: 'w' } }, 'same')).toThrow('其他內容');
  });
  it('人氣投票只留每人一票，手動模式不受投票影響，舊注單鎖定', () => {
    const m = get('winner');
    m.mode = 'popular';
    expect(marketOdds(m).p1).toBe('1900');
    bet(m, 'p1');
    cmd({ type: 'vote', userId: 'u', marketId: m.id, outcome: 'p1' });
    cmd({ type: 'vote', userId: 'u', marketId: m.id, outcome: 'p2' });
    expect(Object.values(get('winner').votes)).toEqual(['p2']);
    expect(s.bets[0]!.legs[0]!.odds).toBe('1900');
    const current = get('winner');
    cmd({
      type: 'configure',
      marketId: m.id,
      mode: 'fixed',
      line: 0,
      options: current.options.map((o) => ({ ...o, fixed: '2500' })),
    });
    expect(marketOdds(get('winner')).p1).toBe('2500');
    cmd({ type: 'vote', userId: 'u', marketId: m.id, outcome: 'p1' });
    expect(marketOdds(get('winner')).p1).toBe('2500');
  });
  it('拒絕超额、零點、過期賠率、不存在選項，且不扣點', () => {
    const m = get('winner');
    for (const stake of ['1001', '0', '-1', '1.5']) expect(() => bet(m, 'p1', stake)).toThrow();
    expect(() =>
      cmd({
        type: 'bet',
        userId: 'u',
        eventId: e.id,
        stake: '1',
        legs: [{ marketId: m.id, outcome: 'p1', odds: '9999', label: '' }],
      }),
    ).toThrow('賠率');
    expect(() => bet(m, 'ghost')).toThrow();
    expect(s.members[0]!.balance).toBe('1000');
    expect(s.bets).toHaveLength(0);
  });
  it('下注与扣点只能一次，已下注時間門檻不能修改', () => {
    const m = get('duration');
    const c: Command = {
      type: 'bet',
      userId: 'u',
      eventId: e.id,
      stake: '100',
      legs: [{ marketId: m.id, outcome: 'over', odds: marketOdds(m).over!, label: '' }],
    };
    cmd(c, 'bet-key');
    cmd(c, 'bet-key');
    expect(s.members[0]!.balance).toBe('900');
    expect(s.bets).toHaveLength(1);
    expect(() =>
      cmd({ type: 'configure', marketId: m.id, mode: 'popular', line: 120, options: m.options }),
    ).toThrow('門檻已鎖定');
  });
  it('自賽與名次投注拒絕，首張注單後不能重綁選手', () => {
    cmd({ type: 'link', eventId: e.id, userId: 'u', playerId: e.players[0]!.id });
    expect(() => bet(get('winner'), 'p1')).toThrow('自己');
    expect(() => bet(get('place', ''), e.players[0]!.id)).toThrow('參賽者');
    bet(get('winner', 'm1-1'), 'p1');
    expect(() => cmd({ type: 'link', eventId: e.id, userId: 'u', playerId: '' })).toThrow('鎖定');
  });
  it('同場、名次混串和超過八關拒絕，計算維持千分捨去', () => {
    const ms = [get('winner'), get('score')];
    expect(() =>
      cmd({
        type: 'bet',
        userId: 'u',
        eventId: e.id,
        stake: '10',
        legs: ms.map((m) => ({
          marketId: m.id,
          outcome: m.options[0]!.id,
          odds: marketOdds(m)[m.options[0]!.id]!,
          label: '',
        })),
      }),
    ).toThrow('同場');
    const place = get('place', '');
    expect(() =>
      cmd({
        type: 'bet',
        userId: 'u',
        eventId: e.id,
        stake: '10',
        legs: [ms[0]!, place].map((m) => ({
          marketId: m.id,
          outcome: m.options[0]!.id,
          odds: marketOdds(m)[m.options[0]!.id]!,
          label: '',
        })),
      }),
    ).toThrow('名次');
    expect(payout('100', [{ odds: '1430' }, { odds: '2860' }])).toBe('408');
  });
});
describe('裁判與派彩', () => {
  it('保存草稿不結算；開始後全場及名次封盤', () => {
    const m = e.matches[0]!;
    bet(get('winner'), 'p1');
    cmd({
      type: 'draft',
      eventId: e.id,
      matchId: m.id,
      bouts: [
        { winner: m.p1, seconds: 90 },
        { winner: m.p1, seconds: 80 },
      ],
    });
    expect(s.bets[0]!.status).toBe('open');
    expect(() =>
      cmd({ type: 'settle', eventId: e.id, matchId: m.id, revision: s.revision }),
    ).toThrow('開始');
    cmd({ type: 'start', eventId: e.id, matchId: m.id });
    expect(
      s.markets
        .filter((x) => x.matchId === m.id || x.kind === 'place')
        .every((x) => x.status === 'closed'),
    ).toBe(true);
    expect(() => bet(get('winner'), 'p1')).toThrow('封盤');
  });
  it('單局等於門檻算以上、整場總秒數、未進行第三局退款', () => {
    bet(get('duration', 'm1-0', 1), 'over');
    bet(get('total'), 'under');
    bet(get('round', 'm1-0', 3), 'p1');
    finish('m1-0');
    expect(s.bets.map((b) => [b.status, b.payout])).toEqual([
      ['won', '190'],
      ['won', '190'],
      ['void', '100'],
    ]);
    expect(s.members[0]!.balance).toBe('1180');
    expect(e.matches.find((m) => m.id === 'm2-0')!.p1).toBe('p1');
  });
  it('3局比分盤，2:1與總時間以上正確結算', () => {
    bet(get('score'), '2:1');
    bet(get('total'), 'over');
    finish('m1-0', [90, 90, 90]);
    expect(s.bets.map((b) => b.status)).toEqual(['won', 'won']);
    expect(e.matches[0]!.s1).toBe(2);
  });
  it('串關一腿作廢仍待另一場，全作廢退本金且不重退', () => {
    const a = get('winner'),
      b = get('winner', 'm1-1');
    cmd({
      type: 'bet',
      userId: 'u',
      eventId: e.id,
      stake: '100',
      legs: [a, b].map((m) => ({ marketId: m.id, outcome: 'p1', odds: '1900', label: '' })),
    });
    cmd({ type: 'void', marketId: a.id, reason: '取消' });
    expect(s.bets[0]!.status).toBe('open');
    finish('m1-1');
    expect(s.bets[0]).toMatchObject({ status: 'won', payout: '190' });
    expect(() => cmd({ type: 'void', marketId: a.id, reason: '取消' })).toThrow();
  });
  it('串關全作廢退本金一次', () => {
    const markets = [get('winner'), get('winner', 'm1-1')];
    cmd({
      type: 'bet',
      userId: 'u',
      eventId: e.id,
      stake: '100',
      legs: markets.map((m) => ({ marketId: m.id, outcome: 'p1', odds: '1900', label: '' })),
    });
    markets.forEach((m) => cmd({ type: 'void', marketId: m.id, reason: '取消' }));
    expect(s.bets[0]).toMatchObject({ status: 'void', payout: '100' });
    expect(s.members[0]!.balance).toBe('1000');
    expect(s.entries.filter((e) => e.label === '注單作廢退款')).toHaveLength(1);
  });
  it('輸一關就不派彩，後續結算不補發', () => {
    const a = get('winner'),
      b = get('winner', 'm1-1');
    cmd({
      type: 'bet',
      userId: 'u',
      eventId: e.id,
      stake: '100',
      legs: [a, b].map((m) => ({ marketId: m.id, outcome: 'p1', odds: '1900', label: '' })),
    });
    finish('m1-0', [90, 90], 'p2');
    finish('m1-1');
    expect(s.bets[0]).toMatchObject({ status: 'lost', payout: '0' });
    expect(s.members[0]!.balance).toBe('900');
  });
  it('冠亞季殿分開產生，季軍戰完成前不誤判季軍', () => {
    for (let place = 1; place <= 4; place++) {
      const m = s.markets.find((m) => m.kind === 'place' && m.place === place)!;
      bet(m, ['p1', 'p3', 'p2', 'p4'][place - 1]!, '10');
    }
    finish('m1-0');
    finish('m1-1');
    finish('m2-0');
    expect(s.bets.map((b) => b.status)).toEqual(['won', 'won', 'open', 'open']);
    finish('podium-third');
    expect(s.bets.every((b) => b.status === 'won')).toBe(true);
  });
  it('缺秒數、不足兩勝、額外局、未保存及重複结算拒绝', () => {
    const m = e.matches[0]!;
    for (const bouts of [
      [
        { winner: m.p1, seconds: 0 },
        { winner: m.p1, seconds: 90 },
      ],
      [
        { winner: m.p1, seconds: 90 },
        { winner: m.p2, seconds: 90 },
      ],
      Array.from({ length: 3 }, () => ({ winner: m.p1, seconds: 90 })),
    ])
      expect(() => cmd({ type: 'draft', eventId: e.id, matchId: m.id, bouts })).toThrow();
    finish(m.id);
    expect(() =>
      cmd({ type: 'settle', eventId: e.id, matchId: m.id, revision: s.revision }),
    ).toThrow();
    expect(() => cmd({ type: 'draft', eventId: e.id, matchId: m.id, bouts: [] })).toThrow();
  });
  it('結算摘要不改帳本，資料更新後必須重新確認', () => {
    const m = e.matches[0]!;
    bet(get('winner'), 'p1');
    cmd({ type: 'start', eventId: e.id, matchId: m.id });
    cmd({
      type: 'draft',
      eventId: e.id,
      matchId: m.id,
      bouts: [
        { winner: m.p1, seconds: 90 },
        { winner: m.p1, seconds: 90 },
      ],
    });
    const preview = settlementPreview(s, e.id, m.id);
    expect(preview).toMatchObject({ count: 1, total: '190' });
    expect(s.members[0]!.balance).toBe('900');
    account('v');
    expect(() =>
      cmd({ type: 'settle', eventId: e.id, matchId: m.id, revision: preview.revision }),
    ).toThrow('重新檢查');
  });
  it.each([2, 3, 5, 8, 16, 32, 63, 64])('%i 人保留唯一首輪籤位、輪空無盤、名次數正確', (count) => {
    s = initialState();
    e = buildEvent(s, defaultSnapshot(count), 'odd');
    expect(e.players).toHaveLength(count);
    expect(
      e.matches
        .filter((m) => m.bye)
        .every((m) => m.status === 'done' && !s.markets.some((p) => p.matchId === m.id)),
    ).toBe(true);
    expect(s.markets.filter((m) => m.kind === 'place')).toHaveLength(count >= 4 ? 4 : 2);
    expect(
      s.markets
        .filter((m) => m.matchId)
        .every((p) => {
          const m = e.matches.find((m) => m.id === p.matchId)!;
          return !!m.p1 && !!m.p2;
        }),
    ).toBe(true);
  });
});
describe('兌換完整流程', () => {
  it('申請扣點減庫存、本人取消只退款一次', () => {
    const c: Command = { type: 'redeem', userId: 'u', prizeId: 'prize-0', price: '300' };
    const id = cmd(c, 'redemption');
    cmd(c, 'redemption');
    expect(s.members[0]!.balance).toBe('700');
    expect(s.prizes[0]!.stock).toBe(4);
    cmd({ type: 'redemption', id, status: 'cancelled', actor: 'u' });
    cmd({ type: 'redemption', id, status: 'cancelled', actor: 'u' });
    expect(s.members[0]!.balance).toBe('1000');
    expect(s.prizes[0]!.stock).toBe(5);
  });
  it('核准後會員不能取消、管理者可退回；發放不可逆', () => {
    const id = cmd({ type: 'redeem', userId: 'u', prizeId: 'prize-0', price: '300' });
    cmd({ type: 'redemption', id, status: 'approved', actor: 'admin' });
    expect(() => cmd({ type: 'redemption', id, status: 'cancelled', actor: 'u' })).toThrow();
    cmd({ type: 'redemption', id, status: 'delivered', actor: 'admin' });
    expect(() => cmd({ type: 'redemption', id, status: 'cancelled', actor: 'admin' })).toThrow();
    expect(s.members[0]!.balance).toBe('700');
  });
  it('库存不足、價格異動、別人取消與餘額不足不成立', () => {
    expect(() => cmd({ type: 'redeem', userId: 'u', prizeId: 'prize-2', price: '1500' })).toThrow(
      '不足',
    );
    expect(() => cmd({ type: 'redeem', userId: 'u', prizeId: 'prize-0', price: '1' })).toThrow(
      '價格',
    );
    s.prizes[0]!.stock = 0;
    expect(() => cmd({ type: 'redeem', userId: 'u', prizeId: 'prize-0', price: '300' })).toThrow(
      '庫存',
    );
    expect(s.members[0]!.balance).toBe('1000');
  });
});

describe('每盤一票', () => {
  it('跨盤投票各自保留，另一場、其他會員與另一屆隔離', () => {
    account('v');
    const winner = get('winner'),
      score = get('score'),
      other = get('winner', 'm1-1');
    cmd({ type: 'vote', userId: 'u', marketId: winner.id, outcome: 'p1' });
    cmd({ type: 'vote', userId: 'v', marketId: winner.id, outcome: 'p1' });
    cmd({ type: 'vote', userId: 'u', marketId: other.id, outcome: 'p2' });
    cmd({ type: 'vote', userId: 'u', marketId: score.id, outcome: '2:1' });
    expect(get('winner').votes).toEqual({ u: 'p1', v: 'p1' });
    expect(get('score').votes).toEqual({ u: '2:1' });
    expect(get('winner', 'm1-1').votes).toEqual({ u: 'p2' });
    const nextId = cmd({ type: 'create', name: '另一屆', snapshot: defaultSnapshot(4) });
    const next = s.markets.find(
      (m) => m.eventId === nextId && m.matchId === 'm1-0' && m.kind === 'winner',
    )!;
    cmd({ type: 'vote', userId: 'u', marketId: next.id, outcome: 'p1' });
    expect(get('score').votes).toEqual({ u: '2:1' });
    cmd({ type: 'start', eventId: e.id, matchId: 'm1-0' });
    expect(() => cmd({ type: 'vote', userId: 'u', marketId: score.id, outcome: '0:2' })).toThrow(
      '封盤',
    );
    expect(get('score').votes).toEqual({ u: '2:1' });
  });
});
