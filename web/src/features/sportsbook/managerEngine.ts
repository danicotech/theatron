import type { Kind, State } from './model';

export type Ceremony = {
  draws: {
    id: string;
    prizeId: string;
    prize: string;
    userId: string;
    name: string;
    delivered: boolean;
    created: number;
  }[];
  awards: {
    id: string;
    playerId: string;
    title: string;
    prize: string;
    delivered: boolean;
    created: number;
  }[];
};
export type ManagerCommand =
  | {
      type: 'market-admin';
      eventId: string;
      marketId?: string;
      kind?: Kind;
      title?: string;
      enabled?: boolean;
    }
  | { type: 'reseed'; eventId: string; playerIds: string[] }
  | { type: 'raffle'; eventId: string; prizeId: string; userIds: string[] }
  | { type: 'award'; eventId: string; playerId: string; title: string; prize: string }
  | { type: 'ceremony-deliver'; eventId: string; recordId: string; category: 'draws' | 'awards' };

const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
export function randomIndex(length: number): number {
  check(Number.isSafeInteger(length) && length > 0 && length <= 1_000_000, '抽籤人數無效。');
  const limit = Math.floor(0x100000000 / length) * length;
  const sample = new Uint32Array(1);
  do {
    crypto.getRandomValues(sample);
  } while (sample[0]! >= limit);
  return sample[0]! % length;
}
export function shuffleSeats(ids: string[]): string[] {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function applyManagerCommand(
  s: State,
  c: Exclude<ManagerCommand, { type: 'reseed' }>,
): string {
  const e = s.events.find((event) => event.id === c.eventId);
  if (!e) throw new Error('找不到活動。');
  if (c.type === 'market-admin') {
    check(Boolean(c.marketId) !== Boolean(c.kind), '請選擇單一盤口或下注類型。');
    check(
      !c.kind || ['winner', 'round', 'score', 'duration', 'total', 'place'].includes(c.kind),
      '未知下注類型。',
    );
    check(
      c.title === undefined ||
        (!!c.marketId && c.title.trim().length > 0 && c.title.trim().length <= 80),
      '盤口名稱須為 1–80 字。',
    );
    const markets = s.markets.filter(
      (m) => m.eventId === e.id && (c.marketId ? m.id === c.marketId : m.kind === c.kind),
    );
    check(markets.length || c.kind, '找不到盤口。');
    const editable = markets.filter((m) => {
      const match = e.matches.find((x) => x.id === m.matchId);
      return (
        (m.kind === 'place' ? !e.started : match?.status === 'upcoming') &&
        ['open', 'closed'].includes(m.status)
      );
    });
    check(editable.length || c.kind, '比賽已開始或盤口已結算，不能重新開放或改名。');
    if (c.title !== undefined)
      check(
        !s.bets.some((b) => b.legs.some((l) => l.marketId === c.marketId)),
        '已有注單，盤口名稱已鎖定。',
      );
    if (c.kind && c.enabled !== undefined)
      e.disabledMarketKinds = c.enabled
        ? (e.disabledMarketKinds || []).filter((kind) => kind !== c.kind)
        : [...new Set([...(e.disabledMarketKinds || []), c.kind])];
    for (const m of editable) {
      if (c.title !== undefined) m.title = c.title.trim();
      if (c.enabled !== undefined) {
        m.status = c.enabled ? 'open' : 'closed';
        m.pausedByAdmin = !c.enabled;
      }
    }
    return '';
  }
  const ceremony = e.ceremony || { draws: [], awards: [] };
  if (c.type === 'raffle') {
    const prize = s.prizes.find((p) => p.id === c.prizeId);
    check(prize && prize.active && prize.stock > 0, '獎品未上架或庫存不足。');
    check(
      c.userIds.length > 0 && new Set(c.userIds).size === c.userIds.length,
      '請選擇不重複的抽獎名單。',
    );
    const eligible = c.userIds.map((id) => s.members.find((m) => m.id === id && !m.anonymous));
    check(eligible.every(Boolean), '抽獎名單包含無效會員。');
    check(
      !c.userIds.some((id) => ceremony.draws.some((d) => d.userId === id)),
      '已中獎會員不重複抽取，請更新名單。',
    );
    const winner = eligible[randomIndex(eligible.length)]!;
    const id = crypto.randomUUID();
    ceremony.draws.push({
      id,
      prizeId: prize!.id,
      prize: prize!.name,
      userId: winner.id,
      name: winner.name,
      delivered: false,
      created: Date.now(),
    });
    prize!.stock--;
    e.ceremony = ceremony;
    return id;
  }
  if (c.type === 'award') {
    check(
      e.players.some((p) => p.id === c.playerId),
      '請選擇活動中的選手。',
    );
    check(
      c.title.trim() &&
        c.title.trim().length <= 80 &&
        c.prize.trim() &&
        c.prize.trim().length <= 120,
      '請填寫獎項及獎勵內容。',
    );
    check(
      !ceremony.awards.some((a) => a.title === c.title.trim() && a.playerId === c.playerId),
      '此選手已有相同獎項。',
    );
    const id = crypto.randomUUID();
    ceremony.awards.push({
      id,
      playerId: c.playerId,
      title: c.title.trim(),
      prize: c.prize.trim(),
      delivered: false,
      created: Date.now(),
    });
    e.ceremony = ceremony;
    return id;
  }
  check(c.category === 'draws' || c.category === 'awards', '未知頒發記錄。');
  const record = ceremony[c.category].find((x) => x.id === c.recordId);
  check(record && !record.delivered, '記錄不存在或已標記頒發。');
  record!.delivered = true;
  return record!.id;
}
