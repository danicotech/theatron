import catalog from './bpCatalog.json';
import type { Match, State, Tournament } from './model';

export const bpCatalog = catalog;
export const bpRankNames = ['開山', '斷水', '飛花', '無我'];
export type BpSelection = {
  id: string;
  matchId: string;
  userId: string;
  playerId: string;
  opponentId: string;
  itemId: string;
  targetNote: string;
  refundReason?: string;
};
export type BpCommand =
  | { type: 'bp-rank'; eventId: string; playerId: string; rank: number }
  | {
      type: 'bp-select';
      eventId: string;
      matchId: string;
      userId: string;
      itemId: string;
      targetNote: string;
    }
  | { type: 'bp-remove'; eventId: string; userId: string; selectionId: string }
  | { type: 'bp-refund'; eventId: string; selectionId: string; reason: string };
export function bpBudget(event: Tournament, match: Match) {
  const a = event.bpRanks?.[match.p1],
    b = event.bpRanks?.[match.p2];
  if (!match.p1 || !match.p2 || a === undefined || b === undefined) return null;
  return { playerId: a < b ? match.p1 : b < a ? match.p2 : '', total: Math.abs(a - b) * 8 };
}
export function bpSelections(event: Tournament, match: Match) {
  // A reseeded match must not inherit the old pair's restrictions.
  return (event.bpSelections || []).filter(
    (s) =>
      s.matchId === match.id &&
      [match.p1, match.p2].includes(s.playerId) &&
      [match.p1, match.p2].includes(s.opponentId),
  );
}
export function bpSpent(event: Tournament, match: Match) {
  return bpSelections(event, match)
    .filter((s) => !s.refundReason)
    .reduce((sum, s) => sum + (catalog.find((i) => i.id === s.itemId)?.cost || 0), 0);
}
function requireCondition(ok: unknown, text: string): asserts ok {
  if (!ok) throw new Error(text);
}
export function applyBp(state: State, command: BpCommand): string {
  const event = state.events.find((e) => e.id === command.eventId);
  requireCondition(event, '找不到本機賽事。');
  if (command.type === 'bp-rank') {
    requireCondition(
      event.players.some((p) => p.id === command.playerId),
      '找不到評段選手。',
    );
    requireCondition(
      Number.isInteger(command.rank) && command.rank >= 0 && command.rank < 4,
      '請選擇有效段位。',
    );
    const affected = event.matches.filter((m) => [m.p1, m.p2].includes(command.playerId));
    requireCondition(
      !affected.some((m) => m.status !== 'upcoming' || bpSelections(event, m).length),
      '已有讓武選擇或比賽紀錄，不能直接更改評段。',
    );
    event.bpRanks = { ...event.bpRanks, [command.playerId]: command.rank };
    return command.playerId;
  }
  if (command.type === 'bp-refund' || command.type === 'bp-remove') {
    const selected = event.bpSelections?.find((s) => s.id === command.selectionId);
    requireCondition(selected, '找不到讓武選擇。');
    const match = event.matches.find((m) => m.id === selected.matchId);
    requireCondition(match && match.status === 'upcoming', '開賽後讓武配置固定，不再變更。');
    if (command.type === 'bp-refund') {
      requireCondition(!selected.refundReason, '此項已退還 BP。');
      requireCondition(
        command.reason.trim() && command.reason.trim().length <= 200,
        '請填寫 200 字內的裁判退款原因。',
      );
      selected.refundReason = command.reason.trim();
    } else {
      requireCondition(!selected.refundReason, '裁判退款紀錄需保留，不能移除。');
      requireCondition(
        state.members.some((u) => u.id === command.userId && !u.anonymous) &&
          selected.userId === command.userId,
        '只能移除自己的讓武選擇。',
      );
      event.bpSelections = event.bpSelections!.filter((s) => s.id !== selected.id);
    }
    return selected.id;
  }
  const match = event.matches.find((m) => m.id === command.matchId);
  requireCondition(
    match && !match.bye && match.status === 'upcoming',
    '本場尚未開放讓武，或已開賽鎖定。',
  );
  requireCondition(
    state.members.some((u) => u.id === command.userId && !u.anonymous),
    '請先登入本機會員。',
  );
  const budget = bpBudget(event, match);
  requireCondition(budget, '請等待裁判評定雙方段位。');
  requireCondition(
    budget.playerId && event.links[command.userId] === budget.playerId,
    '只有本場低段位選手能選擇讓武。',
  );
  const item = catalog.find((i) => i.id === command.itemId);
  requireCondition(item, '找不到正式讓武項目。');
  const note = command.targetNote.trim();
  requireCondition(
    note.length <= 200 && (!item.requiresTarget || note),
    '請填寫 200 字內的指定內容。',
  );
  if (item.id === 'rule-7')
    requireCondition(
      [...note.replace(/[\p{P}\p{Z}\s]/gu, '')].length === 8,
      '開局台詞須為 8 個字（不計標點與空白）。',
    );
  const active = bpSelections(event, match).filter((s) => !s.refundReason);
  requireCondition(
    item.repeatable || !active.some((s) => s.itemId === item.id),
    '此項讓武不能重複選擇。',
  );
  requireCondition(
    !item.repeatable || !active.some((s) => s.itemId === item.id && s.targetNote === note),
    '相同指定內容已加入。',
  );
  requireCondition(bpSpent(event, match) + item.cost <= budget.total, '本場剩餘 BP 不足。');
  const selection: BpSelection = {
    id: crypto.randomUUID(),
    matchId: match.id,
    userId: command.userId,
    playerId: budget.playerId,
    opponentId: budget.playerId === match.p1 ? match.p2 : match.p1,
    itemId: item.id,
    targetNote: note,
  };
  (event.bpSelections ||= []).push(selection);
  return selection.id;
}
