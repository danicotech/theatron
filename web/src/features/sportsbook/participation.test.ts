import { beforeEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { apply, initialState, marketOdds } from './engine';
import { present } from './SportsbookBridge';
import { blankProfile, normalizeProfile } from './enrollment';
import type { Command, State } from './model';
let s: State, eventId: string;
const character = { style: '劍客', weapon: '長劍', equipment: '輕甲', arts: '太白醉月' };
function command(c: Command, key = crypto.randomUUID()) {
  const next = structuredClone(s);
  const result = apply(next, c, key);
  s = next;
  return result;
}
const event = () => s.events.find((e) => e.id === eventId)!;
function enroll(userId: string, complete = true) {
  return command({
    type: 'enroll',
    eventId,
    userId,
    gameId: userId,
    name: userId,
    character,
    rulesAccepted: true,
    complete,
  });
}
function close() {
  command({
    type: 'activity-update',
    eventId,
    name: '百業',
    capacity: event().registration!.capacity,
    open: false,
  });
}
function publish(n = 4) {
  for (let i = 0; i < n; i++) enroll('user' + i);
  close();
  command({
    type: 'publish-roster',
    eventId,
    playerIds: event().registration!.entries.map((e) => e.playerId),
  });
}
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  s = initialState();
  for (let i = 0; i < 5; i++)
    command({
      type: 'register',
      member: {
        id: 'user' + i,
        login: 'user' + i,
        name: '俠客' + i,
        salt: 's',
        hash: 'h',
        discord: '',
        balance: '0',
      },
    });
  eventId = command({ type: 'activity-create', name: '百業', capacity: 4 });
});
it('空白活動沒有假選手或盤口；草稿與完成分開且保留同一身分', () => {
  expect(event().players).toHaveLength(0);
  expect(s.markets).toHaveLength(0);
  expect(present(event())).toMatchObject({
    phase: 1,
    published: false,
    registration: { open: true },
  });
  const id = enroll('user0', false);
  expect(event().registration!.entries[0]!.status).toBe('draft');
  expect(enroll('user0')).toBe(id);
  expect(event().registration!.entries[0]!.status).toBe('confirmed');
  expect(s.members[0]!.balance).toBe('1000');
  expect(s.entries).toHaveLength(5);
  const projection = JSON.stringify(present(event()));
  expect(projection).not.toContain('gameId');
  expect(projection).not.toContain('userId');
});
it('規則、完整角色、重複 ID、容量與發布前關閉均檢查', () => {
  const base: Command = {
    type: 'enroll',
    eventId,
    userId: 'user0',
    gameId: 'abc',
    name: '阿俠',
    character,
    rulesAccepted: false,
    complete: true,
  };
  expect(() => command(base)).toThrow('規則');
  expect(() =>
    command({ ...base, rulesAccepted: true, character: { ...character, weapon: '' } }),
  ).toThrow('設定');
  command({ ...base, rulesAccepted: true });
  expect(() => command({ ...base, userId: 'user1', gameId: 'ABC', rulesAccepted: true })).toThrow(
    '已在本屆',
  );
  command({ type: 'activity-update', eventId, name: '百業', capacity: 2, open: true });
  enroll('user1');
  expect(() => enroll('user2')).toThrow('已滿');
  expect(() =>
    command({
      type: 'publish-roster',
      eventId,
      playerIds: event().registration!.entries.map((e) => e.playerId),
    }),
  ).toThrow('關閉');
  close();
  expect(() => enroll('user3')).toThrow('關閉');
  expect(present(event()).phase).toBe(2);
});
it.each([2, 3, 4])('%i 人發布保留籤位角色、自動會員對應，鎖定名單', (n) => {
  publish(n);
  const e = event();
  expect(e.players).toHaveLength(n);
  expect(e.players[0]!.character).toEqual(character);
  expect(e.links.user0).toBe(e.players[0]!.id);
  expect(present(e).phase).toBe(4);
  expect(e.matches.some((m) => m.kind === 'third')).toBe(n >= 4);
  expect(e.matches.some((m) => m.bye)).toBe(n === 3);
  for (const m of e.matches.filter((m) => m.bye))
    expect(s.markets.some((p) => p.matchId === m.id)).toBe(false);
  expect(() => command({ type: 'link', eventId, userId: 'user0', playerId: '' })).toThrow(
    '不可解除',
  );
  expect(() =>
    command({ type: 'activity-update', eventId, name: '重開', capacity: 8, open: true }),
  ).toThrow('鎖定');
  expect(() =>
    command({ type: 'publish-roster', eventId, playerIds: e.players.map((p) => p.id) }),
  ).toThrow('不能重排');
});
it('草稿不能排入，發布選擇可改序，未選者不成為比賽玩家', () => {
  enroll('user0');
  enroll('user1');
  enroll('user2', false);
  close();
  const entries = event().registration!.entries;
  expect(() =>
    command({
      type: 'publish-roster',
      eventId,
      playerIds: [entries[0]!.playerId, entries[2]!.playerId],
    }),
  ).toThrow('完成報名');
  command({
    type: 'publish-roster',
    eventId,
    playerIds: [entries[1]!.playerId, entries[0]!.playerId],
  });
  expect(event().players.map((p) => p.name)).toEqual(['user1', 'user0']);
  expect(event().links.user2).toBeUndefined();
});
it('報名→排賽→投注→封盤→裁判結算與晉級，派彩一次', () => {
  publish();
  const m = event().matches.find((m) => m.round === 1)!;
  const market = s.markets.find((p) => p.matchId === m.id && p.kind === 'winner')!;
  const bet = (userId: string, marketId = market.id, outcome = 'p1'): Command => ({
    type: 'bet',
    eventId,
    userId,
    stake: '100',
    legs: [
      {
        marketId,
        outcome,
        odds: marketOdds(s.markets.find((p) => p.id === marketId)!)[outcome]!,
        label: '',
      },
    ],
  });
  expect(() => command(bet('user0'))).toThrow();
  const podium = s.markets.find((p) => p.kind === 'place')!;
  expect(() => command(bet('user0', podium.id, event().players[0]!.id))).toThrow();
  command(bet('user4'));
  command(bet('user2'));
  expect(s.members[4]!.balance).toBe('900');
  command({ type: 'start', eventId, matchId: m.id });
  expect(() => command(bet('user4'))).toThrow();
  command({
    type: 'draft',
    eventId,
    matchId: m.id,
    bouts: [
      { winner: m.p1, seconds: 90 },
      { winner: m.p1, seconds: 80 },
    ],
  });
  const settlement: Command = { type: 'settle', eventId, matchId: m.id, revision: s.revision };
  command(settlement, 'settle-once');
  command(settlement, 'settle-once');
  expect(s.members[4]!.balance).toBe('1090');
  expect(s.bets.every((b) => b.status === 'won')).toBe(true);
  expect(event().matches.find((m) => m.kind === 'bracket' && m.round === 2)!.p1).toBe(m.p1);
  expect(() => command({ type: 'draft', eventId, matchId: m.id, bouts: [] })).toThrow();
});

it('新報名保留聯絡與出席、驗證字數，公開投影不含私人資料', () => {
  const profile = {
    ...blankProfile,
    discord: ' private-contact ',
    experience: '新手',
    availability: '週末晚上',
    notes: 'private-note',
  };
  const base: Command = {
    type: 'enroll',
    eventId,
    userId: 'user0',
    gameId: 'hero',
    name: '江上客',
    character,
    profile,
    rulesAccepted: true,
    complete: true,
  };
  expect(() => command({ ...base, profile: { ...profile, availability: ' ' } })).toThrow('時段');
  expect(() => command({ ...base, profile: { ...profile, discord: 'x'.repeat(81) } })).toThrow(
    '字數',
  );
  expect(() => command({ ...base, profile: { ...profile, selfRank: '無效段位' } })).toThrow('自評');
  expect(event().registration!.entries).toHaveLength(0);
  command(base);
  expect(event().registration!.entries[0]!.profile!.discord).toBe('private-contact');
  expect(normalizeProfile({ ...profile, injected: 'extra' } as typeof profile)).not.toHaveProperty(
    'injected',
  );
  enroll('user1');
  close();
  command({
    type: 'publish-roster',
    eventId,
    playerIds: event().registration!.entries.map((x) => x.playerId),
  });
  const projection = JSON.stringify(present(event()));
  for (const privateText of ['private-contact', 'private-note', '週末晚上', 'hero'])
    expect(projection).not.toContain(privateText);
  expect(projection).toContain('江上客');
  expect(projection).toContain('太白醉月');
});
