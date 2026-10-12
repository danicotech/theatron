import { IDBFactory } from 'fake-indexeddb';
import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSnapshot, marketOdds } from './engine';
beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('crypto', webcrypto);
});
describe('本機 IndexedDB 交易', () => {
  it('首頁報名入口併發只開一屆、沿用最近報名活動且不繞過截止', async () => {
    const db = await import('./database');
    const [first, second] = await Promise.all([
      db.execute({ type: 'registration-open' }),
      db.execute({ type: 'registration-open' }),
    ]);
    expect(first).toBe(second);
    expect((await db.readState()).events).toHaveLength(1);
    await db.execute({
      type: 'activity-update',
      eventId: first,
      name: '已截止',
      capacity: 64,
      open: false,
    });
    expect(await db.execute({ type: 'registration-open' })).toBe(first);
    expect((await db.readState()).events[0]!.registration!.open).toBe(false);
    const newer = await db.execute({ type: 'activity-create', name: '下一屆', capacity: 8 });
    await db.execute({ type: 'create', name: '動畫示範', snapshot: defaultSnapshot(4) });
    expect(await db.execute({ type: 'registration-open' })).toBe(newer);
  });
  it('密碼不存明文、大小寫登入、Discord 綁定不再贈點', async () => {
    const db = await import('./database');
    const id = await db.register('Alice', 'test-pass-8', '阿俠');
    expect(await db.loginLocal('ALICE', 'test-pass-8')).toBe(id);
    await expect(db.loginLocal('alice', 'wrong')).rejects.toThrow();
    await db.execute({ type: 'bind', userId: id, discord: 'Discord-Test' });
    expect(await db.discordLocal('discord-test', '')).toBe(id);
    const s = await db.readState();
    expect(s.members[0]!.hash).not.toContain('test-pass-8');
    expect(s.members[0]!.salt).toBeTruthy();
    expect(s.members[0]!.balance).toBe('1000');
    expect(s.entries).toHaveLength(1);
  });
  it('兩個併發下注不能超支，扣點與建單為原子交易', async () => {
    const db = await import('./database');
    const userId = await db.register('alice', 'test-pass-8', '阿俠'),
      eventId = await db.execute({ type: 'create', name: 'test', snapshot: defaultSnapshot(4) });
    const s = await db.readState(),
      m = s.markets.find((m) => m.kind === 'winner')!;
    const command = {
      type: 'bet' as const,
      userId,
      eventId,
      stake: '700',
      legs: [{ marketId: m.id, outcome: 'p1', odds: marketOdds(m).p1!, label: '' }],
    };
    const results = await Promise.allSettled([
      db.execute(command, 'one'),
      db.execute(command, 'two'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const after = await db.readState();
    expect(after.members[0]!.balance).toBe('300');
    expect(after.bets).toHaveLength(1);
    expect(after.entries).toHaveLength(2);
  });
  it('併發重送同注只扣一次，失敗操作不留下半份資料', async () => {
    const db = await import('./database');
    const userId = await db.discordLocal('demo-a', '阿俠'),
      eventId = await db.execute({ type: 'create', name: 'test', snapshot: defaultSnapshot(4) });
    const s = await db.readState(),
      m = s.markets.find((m) => m.kind === 'winner')!;
    const command = {
      type: 'bet' as const,
      userId,
      eventId,
      stake: '100',
      legs: [{ marketId: m.id, outcome: 'p1', odds: marketOdds(m).p1!, label: '' }],
    };
    const ids = await Promise.all([db.execute(command, 'same'), db.execute(command, 'same')]);
    expect(ids[0]).toBe(ids[1]);
    expect((await db.readState()).members[0]!.balance).toBe('900');
    await expect(db.execute({ ...command, stake: '2000' }, 'failed')).rejects.toThrow();
    expect((await db.readState()).bets).toHaveLength(1);
  });
  it('競爭最後庫存只成立一張兌換單，失敗者不扣點', async () => {
    const db = await import('./database');
    const a = await db.discordLocal('a', 'a'),
      b = await db.discordLocal('b', 'b');
    await db.execute({
      type: 'prize',
      prize: {
        id: 'last',
        name: '最後一份',
        price: '300',
        stock: 1,
        description: '',
        active: true,
      },
    });
    const results = await Promise.allSettled(
      [a, b].map((userId) => db.execute({ type: 'redeem', userId, prizeId: 'last', price: '300' })),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const s = await db.readState();
    expect(s.redemptions).toHaveLength(1);
    expect(s.members.map((m) => m.balance).sort()).toEqual(['1000', '700']);
  });
  it('視圖通知失敗不把已提交的交易回報為失敗', async () => {
    const db = await import('./database');
    const off = db.subscribe(() => {
      throw new Error('view unmounted');
    });
    try {
      const id = await db.discordLocal('notify-test', '阿俠');
      expect((await db.readState()).members.find((m) => m.id === id)?.balance).toBe('1000');
    } finally {
      off();
    }
  });
  it('匿名多分頁登入只建立一個身分、贈點一次，回訪保留投票', async () => {
    const db = await import('./database');
    const [a, b] = await Promise.all([
      db.execute({ type: 'guest' }),
      db.execute({ type: 'guest' }),
    ]);
    expect(a).toBe(b);
    const eventId = await db.execute({
      type: 'create',
      name: '匿名場',
      snapshot: defaultSnapshot(4),
    });
    const before = await db.readState();
    const markets = before.markets.filter(
      (m) => m.eventId === eventId && m.matchId === 'm1-0' && ['winner', 'score'].includes(m.kind),
    );
    await Promise.all(
      markets.map((m) =>
        db.execute({ type: 'vote', userId: a, marketId: m.id, outcome: m.options[0]!.id }),
      ),
    );
    expect(await db.execute({ type: 'guest' })).toBe(a);
    const after = await db.readState();
    expect(after.members).toHaveLength(1);
    expect(after.entries).toHaveLength(1);
    expect(after.members[0]).toMatchObject({ anonymous: true, balance: '1000', name: '匿名俠客' });
    expect(after.markets.filter((m) => m.matchId === 'm1-0' && m.votes[a])).toHaveLength(2);
  });
  it('新組合票的並發送出不能超支，建票與全部本金同時提交', async () => {
    const db = await import('./database');
    const userId = await db.execute({ type: 'guest' }),
      eventId = await db.execute({ type: 'create', name: '串關', snapshot: defaultSnapshot(8) });
    const s = await db.readState(),
      markets = s.markets.filter((m) => m.kind === 'winner').slice(0, 3);
    const c = {
      type: 'ticket' as const,
      userId,
      eventId,
      unitStake: '100',
      sizes: [1, 2, 3],
      oddsPolicy: 'strict' as const,
      legs: markets.map((m) => ({
        marketId: m.id,
        outcome: 'p1',
        odds: marketOdds(m).p1!,
        label: '',
      })),
    };
    const results = await Promise.allSettled([db.execute(c), db.execute(c)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const after = await db.readState();
    expect(after.members[0]!.balance).toBe('300');
    expect(after.bets).toHaveLength(1);
    expect(after.bets[0]!.combinations).toHaveLength(7);
    expect(after.entries).toHaveLength(2);
  });
  it('多分頁同時提交各盤单注，整批原子扣點且不能超支', async () => {
    const db = await import('./database');
    const userId = await db.execute({ type: 'guest' });
    const eventId = await db.execute({
      type: 'create',
      name: '獨立單注',
      snapshot: defaultSnapshot(4),
    });
    const before = await db.readState();
    const legs = before.markets
      .filter((m) => m.matchId === 'm1-0' && ['winner', 'score', 'total'].includes(m.kind))
      .map((m) => ({
        marketId: m.id,
        outcome: m.options[0]!.id,
        odds: marketOdds(m)[m.options[0]!.id]!,
        label: '',
      }));
    const c = {
      type: 'ticket' as const,
      independent: true,
      userId,
      eventId,
      legs,
      unitStake: '200',
      sizes: [1],
      oddsPolicy: 'strict' as const,
    };
    const results = await Promise.allSettled([db.execute(c), db.execute(c)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const after = await db.readState();
    expect(after.bets).toHaveLength(3);
    expect(after.members[0]!.balance).toBe('400');
    expect(after.entries).toHaveLength(4);
  });
});

it('最後報名名額併發只接受一人，失敗者沒有半份完成資料', async () => {
  const db = await import('./database');
  const ids = await Promise.all(['a', 'b', 'c'].map((x) => db.discordLocal(x, x)));
  const eventId = await db.execute({ type: 'activity-create', name: '報名', capacity: 2 });
  const enroll = (userId: string) =>
    db.execute({
      type: 'enroll',
      eventId,
      userId,
      gameId: userId,
      name: userId,
      character: { style: '劍', weapon: '劍', equipment: '甲', arts: '太白' },
      rulesAccepted: true,
      complete: true,
    });
  await enroll(ids[0]!);
  const results = await Promise.allSettled([enroll(ids[1]!), enroll(ids[2]!)]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const s = await db.readState();
  expect(s.events[0]!.registration!.entries).toHaveLength(2);
  expect(s.members.every((m) => m.balance === '1000')).toBe(true);
});
