import { labSource } from '../../../../scripts/lab-source';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { apply, buildEvent, defaultSnapshot, initialState } from './engine';
import { bpBudget, bpCatalog, bpSelections, bpSpent } from './bp';
import type { Command } from './model';

function setup() {
  const state = initialState();
  const event = buildEvent(state, defaultSnapshot(4), '讓武驗收');
  const match = event.matches[0]!;
  state.members.push({
    id: 'user',
    name: '參賽者',
    login: 'user',
    salt: '',
    hash: '',
    discord: '',
    balance: '1000',
  });
  event.links.user = match.p1;
  const run = (command: Command) => apply(state, command, crypto.randomUUID());
  const select = (itemId: string, targetNote = '') =>
    run({
      type: 'bp-select',
      eventId: event.id,
      matchId: match.id,
      userId: 'user',
      itemId,
      targetNote,
    });
  return { state, event, match, run, select };
}
describe('本機選手讓武', () => {
  it('36項名稱、BP與說明同步正式讓武全文', () => {
    const source = readFileSync(labSource('lunjian-layout.html'), 'utf8');
    expect(bpCatalog).toHaveLength(36);
    for (const item of bpCatalog) {
      expect(source).toContain(`${item.cost} BP</span> ${item.name}</h4>`);
      for (const line of item.description.split('\n')) expect(source).toContain(line);
    }
  });
  it('評段後只允許低段方、依每段8BP限制，沒有評段不推測', () => {
    const { event, match, run, select } = setup();
    expect(() => select('weapon-5')).toThrow('等待裁判');
    run({ type: 'bp-rank', eventId: event.id, playerId: match.p1, rank: 0 });
    run({ type: 'bp-rank', eventId: event.id, playerId: match.p2, rank: 1 });
    expect(bpBudget(event, match)?.total).toBe(8);
    expect(() => select('weapon-1', '無名劍法')).toThrow('不足');
    select('weapon-5');
    expect(bpSpent(event, match)).toBe(2);
    expect(() => select('weapon-5')).toThrow('不能重複');
    event.links.user = match.p2;
    expect(() => select('movement-6')).toThrow('低段位');
  });
  it('重複項需逐一指定；開賽鎖定且不能改已使用段位', () => {
    const { event, match, run, select } = setup();
    event.bpRanks = { [match.p1]: 0, [match.p2]: 3 };
    expect(() => select('skill-8')).toThrow('指定內容');
    select('skill-8', '太白醉月');
    expect(() => select('skill-8', '太白醉月')).toThrow('已加入');
    select('skill-8', '神龍吐火');
    expect(bpSpent(event, match)).toBe(6);
    expect(() => run({ type: 'bp-rank', eventId: event.id, playerId: match.p1, rank: 1 })).toThrow(
      '不能直接更改',
    );
    run({ type: 'start', eventId: event.id, matchId: match.id });
    expect(() => select('movement-6')).toThrow('鎖定');
    expect(() =>
      run({
        type: 'bp-remove',
        eventId: event.id,
        userId: 'user',
        selectionId: event.bpSelections![0]!.id,
      }),
    ).toThrow('不再變更');
  });
  it('裁判退款須有原因，不改點數且保留紀錄；換人不繼承舊讓武', () => {
    const { state, event, match, run, select } = setup();
    event.bpRanks = { [match.p1]: 0, [match.p2]: 3 };
    select('skill-8', '太白醉月');
    const id = event.bpSelections![0]!.id;
    expect(() =>
      run({ type: 'bp-refund', eventId: event.id, selectionId: id, reason: '' }),
    ).toThrow('原因');
    run({
      type: 'bp-refund',
      eventId: event.id,
      selectionId: id,
      reason: '已購買禁用奇術，裁判確認退款',
    });
    expect(bpSpent(event, match)).toBe(0);
    expect(state.members[0]!.balance).toBe('1000');
    expect(event.bpSelections).toHaveLength(1);
    match.p2 = 'another-player';
    expect(bpSelections(event, match)).toEqual([]);
  });
  it('開局台詞須8字；觀眾不可下讓武單，同段無預算', () => {
    const { event, match, select } = setup();
    event.bpRanks = { [match.p1]: 0, [match.p2]: 3 };
    expect(() => select('rule-7', '三個字')).toThrow('8 個字');
    select('rule-7', '夜鴉所至，萬敵皆寂！');
    delete event.links.user;
    expect(() => select('weapon-5')).toThrow('低段位');
    event.links.user = match.p1;
    event.bpRanks[match.p2] = 0;
    expect(() => select('weapon-5')).toThrow('低段位');
  });
});
