import { describe, expect, it } from 'vitest';
import { apply, buildEvent, defaultSnapshot, initialState, marketOdds } from './engine';
import { shuffleSeats } from './managerEngine';
import type { Command, State } from './model';

function setup(count = 4) {
  const state = initialState();
  const event = buildEvent(state, defaultSnapshot(count), '管理者驗證');
  for (const id of ['a', 'b'])
    apply(
      state,
      {
        type: 'register',
        member: {
          id,
          login: `user-${id}`,
          name: `會員${id}`,
          salt: 's',
          hash: 'h',
          discord: '',
          balance: '0',
        },
      },
      id,
    );
  return { state, event };
}
function run(state: State, command: Command, key = crypto.randomUUID()) {
  return apply(state, command, key);
}

describe('管理者盤口、抽籤與頒獎', () => {
  it('盤口改名，批次關閉與重開；已开賽不能重新開盤', () => {
    const { state, event } = setup();
    const market = state.markets.find((m) => m.kind === 'winner')!;
    run(state, { type: 'market-admin', eventId: event.id, marketId: market.id, title: '首戰誰勝' });
    expect(market.title).toBe('首戰誰勝');
    run(state, { type: 'market-admin', eventId: event.id, kind: 'winner', enabled: false });
    expect(
      state.markets.filter((m) => m.kind === 'winner').every((m) => m.status === 'closed'),
    ).toBe(true);
    run(state, { type: 'market-admin', eventId: event.id, marketId: market.id, enabled: true });
    expect(market.status).toBe('open');
    run(state, { type: 'start', eventId: event.id, matchId: market.matchId });
    expect(() =>
      run(state, { type: 'market-admin', eventId: event.id, marketId: market.id, enabled: true }),
    ).toThrow('不能重新開放');
    expect(market.status).toBe('closed');
  });
  it('暫停期間拒绝下注；已有注單後名稱與籤位鎖定，原注單不刪除', () => {
    const { state, event } = setup();
    const market = state.markets.find((m) => m.kind === 'winner')!;
    const bet: Command = {
      type: 'bet',
      userId: 'a',
      eventId: event.id,
      stake: '100',
      legs: [{ marketId: market.id, outcome: 'p1', odds: marketOdds(market).p1!, label: '首戰' }],
    };
    run(state, { type: 'market-admin', eventId: event.id, marketId: market.id, enabled: false });
    expect(() => run(state, bet)).toThrow();
    run(state, { type: 'market-admin', eventId: event.id, marketId: market.id, enabled: true });
    run(state, bet);
    expect(() =>
      run(state, { type: 'market-admin', eventId: event.id, marketId: market.id, title: '更名' }),
    ).toThrow('名稱已鎖定');
    expect(() =>
      run(state, {
        type: 'reseed',
        eventId: event.id,
        playerIds: event.players.map((p) => p.id).reverse(),
      }),
    ).toThrow('籤位已鎖定');
    run(state, { type: 'market-admin', eventId: event.id, marketId: market.id, enabled: false });
    expect(state.bets).toHaveLength(1);
  });
  it('重排保留會員、角色與管理設定，清除原盤投票，不遺漏非二次方人數', () => {
    const { state, event } = setup(5);
    const market = state.markets.find((m) => m.kind === 'winner')!;
    run(state, { type: 'link', eventId: event.id, userId: 'a', playerId: event.players[0]!.id });
    run(state, {
      type: 'market-admin',
      eventId: event.id,
      marketId: market.id,
      title: '焦點對戰',
      enabled: false,
    });
    const ids = event.players.map((p) => p.id).reverse();
    run(state, { type: 'reseed', eventId: event.id, playerIds: ids });
    const current = state.events[0]!;
    expect(current.players.map((p) => p.id)).toEqual(ids);
    expect(current.links.a).toBe(event.players[0]!.id);
    expect(state.markets.find((m) => m.id === market.id)).toMatchObject({
      title: '焦點對戰',
      status: 'closed',
    });
    const seats = current.matches
      .filter((m) => m.round === 1 && m.kind === 'bracket')
      .flatMap((m) => [m.p1, m.p2])
      .filter(Boolean);
    expect(new Set(seats)).toEqual(new Set(ids));
  });
  it('抽獎隨機結果持久保存、相同操作不重抽扣庫存、得主不可重複', () => {
    const { state, event } = setup();
    const command: Command = {
      type: 'raffle',
      eventId: event.id,
      prizeId: 'prize-0',
      userIds: ['a', 'b'],
    };
    const id = run(state, command, 'draw-once');
    expect(run(state, command, 'draw-once')).toBe(id);
    expect(state.prizes[0]!.stock).toBe(4);
    expect(event.ceremony!.draws).toHaveLength(1);
    expect(() => run(state, command)).toThrow('已中獎會員');
    const winner = event.ceremony!.draws[0]!;
    run(state, { ...command, userIds: ['a', 'b'].filter((id) => id !== winner.userId) });
    expect(new Set(event.ceremony!.draws.map((d) => d.userId)).size).toBe(2);
    run(state, { type: 'ceremony-deliver', eventId: event.id, recordId: id, category: 'draws' });
    expect(winner.delivered).toBe(true);
    expect(() =>
      run(state, { type: 'ceremony-deliver', eventId: event.id, recordId: id, category: 'draws' }),
    ).toThrow('已標記');
  });
  it('獎品無庫存或名單無效不抽獎；獎項登錄不更動賽果', () => {
    const { state, event } = setup();
    state.prizes[0]!.stock = 0;
    expect(() =>
      run(state, { type: 'raffle', eventId: event.id, prizeId: 'prize-0', userIds: ['a'] }),
    ).toThrow('庫存不足');
    expect(event.ceremony).toBeUndefined();
    const before = structuredClone(event.matches);
    const id = run(state, {
      type: 'award',
      eventId: event.id,
      playerId: event.players[0]!.id,
      title: '最佳風采',
      prize: '紀念品',
    });
    expect(event.matches).toEqual(before);
    run(state, { type: 'ceremony-deliver', eventId: event.id, recordId: id, category: 'awards' });
    expect(event.ceremony!.awards[0]!.delivered).toBe(true);
  });
  it('洗籤僅改順序，來源與唯一性保留', () => {
    const ids = Array.from({ length: 64 }, (_, i) => String(i));
    for (let i = 0; i < 10; i++) expect(new Set(shuffleSeats(ids))).toEqual(new Set(ids));
    expect(ids[0]).toBe('0');
  });
  it('下注類型政策套用後續輪次，且重開類型不會重開進行中的場次', () => {
    const { state, event } = setup();
    run(state, { type: 'market-admin', eventId: event.id, kind: 'winner', enabled: false });
    for (const id of ['m1-0', 'm1-1']) {
      const match = event.matches.find((m) => m.id === id)!;
      run(state, { type: 'start', eventId: event.id, matchId: id });
      run(state, {
        type: 'draft',
        eventId: event.id,
        matchId: id,
        bouts: [
          { winner: match.p1, seconds: 60 },
          { winner: match.p1, seconds: 80 },
        ],
      });
      run(state, { type: 'settle', eventId: event.id, matchId: id, revision: state.revision });
    }
    expect(state.markets.find((m) => m.matchId === 'm2-0' && m.kind === 'winner')!.status).toBe(
      'closed',
    );
    run(state, { type: 'start', eventId: event.id, matchId: 'm2-0' });
    run(state, { type: 'market-admin', eventId: event.id, kind: 'winner', enabled: true });
    expect(state.markets.find((m) => m.matchId === 'm2-0' && m.kind === 'winner')!.status).toBe(
      'closed',
    );
    expect(
      state.markets.find((m) => m.matchId === 'podium-third' && m.kind === 'winner')!.status,
    ).toBe('open');
  });
});
