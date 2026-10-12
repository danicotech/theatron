import { labSource } from '../../../scripts/lab-source';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Match = {
  id: string;
  round: number;
  slot: number;
  p1: string;
  p2: string;
  s1: number;
  s2: number;
  winner: string;
  status: string;
  bye: boolean;
  kind: string;
};
type Data = {
  demo: boolean;
  published: boolean;
  bestOf: number;
  players: { id: string; name: string }[];
  rounds: { round: number; matches: Match[] }[];
  tones?: string;
  effectRevision?: number;
};
type Patch = Pick<Match, 'p1' | 'p2' | 's1' | 's2' | 'winner' | 'status'>;
type Editor = {
  sync: (data: Data, key: string) => void;
  open: (id: string, trigger?: HTMLElement) => boolean;
  close: () => void;
  destroy: () => void;
  refreshSeats: () => void;
  editing: boolean;
};
const source = readFileSync(labSource('bracket-editor.js'), 'utf8');
const { applyBracketEdit, applyRosterAssignment, createBracketEditor, createPreviewBracket } =
  runInThisContext(
    '(function(){' +
      source.replace(/export /g, '') +
      ';return {applyBracketEdit,applyRosterAssignment,createBracketEditor,createPreviewBracket};})()',
  ) as {
    applyRosterAssignment: (
      data: Data,
      id: string,
      seat: string,
      player: { id: string; name: string },
    ) => Data;
    createPreviewBracket: (data: Data, count: number, mode?: string) => Data;
    applyBracketEdit: (data: Data, id: string, patch: Patch) => Data;
    createBracketEditor: (options: {
      host: HTMLElement;
      bracketHost?: HTMLElement;
      onChange: (data: Data) => void;
      signal?: AbortSignal;
    }) => Editor;
  };
function fixture(): Data {
  const match = (id: string, round: number, slot: number, p1: string, p2: string): Match => ({
    id,
    round,
    slot,
    p1,
    p2,
    s1: 2,
    s2: 1,
    winner: p1,
    status: 'done',
    bye: false,
    kind: 'bracket',
  });
  return {
    demo: true,
    published: true,
    bestOf: 3,
    players: ['a', 'b', 'c', 'd'].map((id) => ({ id, name: '選手' + id })),
    rounds: [
      { round: 1, matches: [match('a-b', 1, 0, 'a', 'b'), match('c-d', 1, 1, 'c', 'd')] },
      { round: 2, matches: [match('final', 2, 0, 'a', 'c')] },
    ],
  };
}
const patch = (overrides: Partial<Patch> = {}): Patch => ({
  p1: 'a',
  p2: 'b',
  s1: 2,
  s2: 1,
  winner: 'a',
  status: 'done',
  ...overrides,
});
let controllers: Editor[] = [];
beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  controllers.forEach((c) => c.destroy());
  controllers = [];
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
describe('示範賽程編輯與晉級一致性', () => {
  it('改勝者會更新下一輪並清除已失效的結果，不修改原始 fixture', () => {
    const original = fixture(),
      edited = applyBracketEdit(original, 'a-b', patch({ winner: 'b', s1: 1, s2: 2 }));
    expect(edited.rounds[1]!.matches[0]).toMatchObject({
      p1: 'b',
      p2: 'c',
      s1: 0,
      s2: 0,
      winner: '',
      status: 'upcoming',
    });
    expect(original.rounds[1]!.matches[0]!.winner).toBe('a');
  });
  it('同贏家修正比分不清除有效的後續賽果', () => {
    const edited = applyBracketEdit(fixture(), 'a-b', patch({ s2: 0 }));
    expect(edited.rounds[1]!.matches[0]!.winner).toBe('a');
  });
  it('改首輪玩家採交換籤位，原場與後續結果同步失效', () => {
    const edited = applyBracketEdit(fixture(), 'a-b', patch({ p1: 'c', winner: 'c' }));
    const all = edited.rounds[0]!.matches.flatMap((m) => [m.p1, m.p2]);
    expect(new Set(all).size).toBe(4);
    expect(edited.rounds[0]!.matches[1]).toMatchObject({
      p1: 'a',
      p2: 'd',
      winner: '',
      status: 'upcoming',
    });
    expect(edited.rounds[1]!.matches[0]).toMatchObject({
      p1: 'c',
      p2: '',
      winner: '',
      status: 'upcoming',
    });
  });
  it('不能從示範編輯器修改正式資料，或填入不合法 BO3／重複選手', () => {
    expect(() => applyBracketEdit({ ...fixture(), demo: false }, 'a-b', patch())).toThrow('正式');
    for (const invalid of [
      patch({ p2: 'a' }),
      patch({ s1: 1 }),
      patch({ s2: 2 }),
      patch({ s1: -1 }),
      patch({ s1: 1.5 }),
      patch({ status: 'live' }),
      patch({ winner: 'd' }),
    ])
      expect(() => applyBracketEdit(fixture(), 'a-b', invalid)).toThrow();
    expect(() =>
      applyBracketEdit(fixture(), 'final', patch({ p1: 'd', p2: 'c', winner: 'd' })),
    ).toThrow('前一場');
  });
  it('輪空更換玩家仍然直接晉級，不製造比分', () => {
    const data = fixture();
    data.rounds[0]!.matches[0] = {
      ...data.rounds[0]!.matches[0]!,
      p2: '',
      bye: true,
      s1: 0,
      s2: 0,
    };
    const changed = applyBracketEdit(
      data,
      'a-b',
      patch({ p1: 'c', p2: '', winner: 'c', s1: 0, s2: 0 }),
    );
    expect(changed.rounds[0]!.matches[0]).toMatchObject({ p1: 'c', winner: 'c', s1: 0, s2: 0 });
  });
});
describe('自訂示範人數', () => {
  it.each([2, 3, 7, 8, 9, 15, 16, 17, 31, 32, 33, 63, 64])(
    '%i 人完成賽程有唯一冠軍、沒有虛構對手',
    (count) => {
      const data = createPreviewBracket(fixture(), count, 'finished');
      const size = 2 ** Math.ceil(Math.log2(count));
      expect(data.players).toHaveLength(count);
      expect(new Set(data.players.map((p) => p.id)).size).toBe(count);
      const first = data.rounds[0]!.matches;
      expect(first.flatMap((m) => [m.p1, m.p2]).filter(Boolean)).toHaveLength(count);
      expect(first.filter((m) => m.bye)).toHaveLength(size - count);
      for (const m of first.filter((m) => m.bye)) {
        expect(m).toMatchObject({ s1: 0, s2: 0, p2: '', winner: m.p1, status: 'done' });
      }
      for (let r = 1; r < data.rounds.length; r++) {
        for (const m of data.rounds[r]!.matches) {
          expect(m.p1).toBe(data.rounds[r - 1]!.matches[m.slot * 2]!.winner);
          expect(m.p2).toBe(data.rounds[r - 1]!.matches[m.slot * 2 + 1]!.winner);
          expect(m.bye).toBe(false);
        }
      }
      expect(data.players.some((p) => p.id === data.rounds.at(-1)!.matches[0]!.winner)).toBe(true);
    },
  );
  it.each(['upcoming', 'live'])('%s 模式不替待定的前場判勝，也不把未定席位當輪空', (mode) => {
    const data = createPreviewBracket(fixture(), 9, mode);
    const all = data.rounds.flatMap((r) => r.matches);
    expect(all.filter((m) => m.status === 'done').every((m) => m.bye)).toBe(true);
    expect(all.filter((m) => m.status === 'live')).toHaveLength(mode === 'live' ? 1 : 0);
    expect(
      data.rounds
        .slice(1)
        .flatMap((r) => r.matches)
        .every((m) => !m.bye),
    ).toBe(true);
    expect(data.rounds.at(-1)!.matches[0]!.winner).toBe('');
  });
  it('拒絕超界、小數與正式資料', () => {
    for (const n of [0, 1, 65, 8.5, NaN])
      expect(() => createPreviewBracket(fixture(), n)).toThrow();
    expect(() => createPreviewBracket({ ...fixture(), demo: false }, 8)).toThrow('示範');
  });
});

describe('示範管理介面', () => {
  function mount(key = 'finished') {
    const host = document.createElement('div');
    document.body.append(host);
    const onChange = vi.fn<(data: Data) => void>();
    const editor = createBracketEditor({ host, onChange });
    controllers.push(editor);
    editor.sync(fixture(), key);
    return { editor, onChange, host };
  }
  const value = (name: string, v: string) => {
    const target = document.querySelector<HTMLSelectElement>(`[name="${name}"]`)!;
    fireEvent.change(target, { target: { value: v } });
  };
  it('可進編輯、選贏家、自動填兩勝、儲存與復原；刷新讀回而且不跨階段', () => {
    const { editor, onChange } = mount();
    editor.open('a-b');
    value('winner', 'b');
    expect((document.querySelector('[name="s2"]') as HTMLInputElement).value).toBe('2');
    fireEvent.submit(document.querySelector('form')!);
    expect(onChange.mock.lastCall?.[0].rounds[0]!.matches[0]!.winner).toBe('b');
    expect(document.querySelector('dialog')?.open).toBe(false);
    editor.destroy();
    const restored = mount();
    expect(restored.onChange.mock.lastCall?.[0].rounds[0]!.matches[0]!.winner).toBe('b');
    fireEvent.click(screen.getByRole('button', { name: '編輯' }));
    fireEvent.click(screen.getByRole('button', { name: '復原上一步' }));
    expect(restored.onChange.mock.lastCall?.[0].rounds[0]!.matches[0]!.winner).toBe('a');
    restored.editor.sync(fixture(), 'live');
    expect(restored.onChange.mock.lastCall?.[0].rounds[0]!.matches[0]!.winner).toBe('a');
  });
  it('舊黑白配置轉為紅藍並保留已儲存的比分修改', () => {
    const { editor } = mount();
    editor.open('a-b');
    value('winner', 'b');
    fireEvent.submit(document.querySelector('form')!);
    const key = 'lunjian.bracket-editor.v1.finished';
    const saved = JSON.parse(localStorage.getItem(key)!) as { tones: string };
    saved.tones = 'white-left';
    localStorage.setItem(key, JSON.stringify(saved));
    editor.destroy();
    const restored = mount();
    expect(restored.onChange.mock.lastCall?.[0].tones).toBe('blue-left');
    expect(restored.onChange.mock.lastCall?.[0].rounds[0]!.matches[0]!.winner).toBe('b');
    fireEvent.click(screen.getByRole('button', { name: '編輯' }));
    expect(screen.getByRole('combobox', { name: '紅藍方配置' })).toHaveValue('blue-left');
  });
  it('人數、進度各自保存，刷新還原選擇，快捷獲勝按鈕可直接儲存', () => {
    const { editor, onChange } = mount();
    fireEvent.click(screen.getByRole('button', { name: '編輯' }));
    fireEvent.click(screen.getByRole('button', { name: '16 人' }));
    expect(onChange.mock.lastCall?.[0].players).toHaveLength(16);
    editor.open('m1-0');
    fireEvent.click(screen.getAllByRole('button', { name: '此方獲勝' })[1]!);
    const winner = (document.querySelector('[name="p2"]') as HTMLSelectElement).value;
    fireEvent.click(screen.getByRole('button', { name: '儲存這場比分' }));
    expect(onChange.mock.lastCall?.[0].rounds[0]!.matches[0]!.winner).toBe(winner);
    fireEvent.change(screen.getByRole('spinbutton', { name: '示範人數' }), {
      target: { value: '9' },
    });
    fireEvent.click(screen.getByRole('button', { name: '套用人數' }));
    expect(onChange.mock.lastCall?.[0].players).toHaveLength(9);
    expect(screen.getByText(/9 位選手 · 16 籤位 · 7 位輪空/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: '示範比賽進度' }), {
      target: { value: 'upcoming' },
    });
    expect(onChange.mock.lastCall?.[0].rounds.at(-1)!.matches[0]!.winner).toBe('');
    editor.destroy();
    const restored = mount();
    expect(restored.onChange.mock.lastCall?.[0].players).toHaveLength(9);
    fireEvent.click(screen.getByRole('button', { name: '編輯' }));
    expect(screen.getByRole('combobox', { name: '示範比賽進度' })).toHaveValue('upcoming');
    fireEvent.change(screen.getByRole('combobox', { name: '示範比賽進度' }), {
      target: { value: 'finished' },
    });
    fireEvent.click(screen.getByRole('button', { name: '16 人' }));
    expect(restored.onChange.mock.lastCall?.[0].rounds[0]!.matches[0]!.winner).toBe(winner);
  });
  it('紅藍方可互換、效果可重播，儲存失敗時仍可操作並提示', () => {
    const { onChange } = mount();
    fireEvent.click(screen.getByRole('button', { name: '編輯' }));
    fireEvent.change(screen.getByRole('combobox', { name: '紅藍方配置' }), {
      target: { value: 'blue-left' },
    });
    expect(onChange.mock.lastCall?.[0].tones).toBe('blue-left');
    fireEvent.click(screen.getByRole('button', { name: '重播勝敗效果' }));
    expect(onChange.mock.lastCall?.[0].effectRevision).toBe(1);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    fireEvent.change(screen.getByRole('combobox', { name: '紅藍方配置' }), {
      target: { value: 'red-left' },
    });
    expect(screen.getByRole('status')).toHaveTextContent('無法儲存');
  });
  it('不合法比分保留編輯面板與錯誤，關閉和卸載清理監聽', () => {
    const { editor, onChange } = mount();
    editor.open('a-b');
    value('s1', '-1');
    fireEvent.submit(document.querySelector('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('整數');
    expect(document.activeElement).toBe(screen.getByRole('alert'));
    expect(document.querySelector('dialog')?.open).toBe(true);
    const calls = onChange.mock.calls.length,
      submit = screen.getByRole('button', { name: '儲存這場比分' });
    editor.destroy();
    submit.click();
    expect(onChange).toHaveBeenCalledTimes(calls);
    expect(document.querySelector('dialog')).toBeNull();
  });
  it('人數錯誤位於參賽設定內，聚焦輸入；有效人數清除錯誤', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: '編輯' }));
    const count = screen.getByRole('spinbutton', { name: '示範人數' });
    fireEvent.change(count, { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: '套用人數' }));
    expect(document.activeElement).toBe(count);
    expect(screen.getByRole('alert')).toHaveTextContent('2 至 64');
    expect(screen.getByRole('alert').closest('.be-preview')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '8 人' }));
    expect(count).not.toHaveAttribute('aria-invalid');
    expect(document.querySelector('#bracket-count-error')).toHaveAttribute('hidden');
  });
  it('復原和還原的儲存失敗不被成功訊息蓋掉', () => {
    const { editor } = mount();
    editor.open('a-b');
    value('winner', 'b');
    fireEvent.submit(document.querySelector('form')!);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    fireEvent.click(screen.getByRole('button', { name: '復原上一步' }));
    expect(screen.getByRole('status')).toHaveTextContent('無法儲存');
    fireEvent.click(screen.getByRole('button', { name: '還原本階段示範' }));
    fireEvent.click(screen.getByRole('button', { name: '再次點選，確認還原' }));
    expect(screen.getByRole('status')).toHaveTextContent('無法儲存');
  });
});

describe('報名者安排首輪', () => {
  it('交換同場或跨場籤位，清除受影響結果並保留唯一選手', () => {
    for (const id of ['b', 'c']) {
      const result = applyRosterAssignment(fixture(), 'a-b', 'p1', { id, name: '選手' + id });
      expect(result.rounds[0]!.matches[0]).toMatchObject({
        p1: id,
        s1: 0,
        s2: 0,
        winner: '',
        status: 'upcoming',
      });
      const seats = result.rounds[0]!.matches.flatMap((m) => [m.p1, m.p2]);
      expect(new Set(seats).size).toBe(4);
      expect(result.rounds[1]!.matches[0]!.winner).toBe('');
    }
  });
  it('待排入報名者替換選手，保留人數、不改原始資料或無關場次', () => {
    const original = fixture();
    const result = applyRosterAssignment(original, 'a-b', 'p2', { id: 'new', name: '新報名者' });
    expect(result.players.map((p) => p.id).sort()).toEqual(['a', 'c', 'd', 'new']);
    expect(result.rounds[0]!.matches[0]!.p2).toBe('new');
    expect(result.rounds[0]!.matches[1]).toEqual(original.rounds[0]!.matches[1]);
    expect(original.players.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('輪空選手可換人並直接晉級，禁止填入輪空席位、後輪及正式資料', () => {
    const data = createPreviewBracket(fixture(), 3, 'finished');
    const bye = data.rounds[0]!.matches.find((m) => m.bye)!;
    const result = applyRosterAssignment(data, bye.id, 'p1', { id: 'new', name: '新報名者' });
    expect(result.rounds[0]!.matches.find((m) => m.id === bye.id)).toMatchObject({
      winner: 'new',
      status: 'done',
      s1: 0,
      s2: 0,
    });
    expect(() =>
      applyRosterAssignment(data, bye.id, 'p2', { id: 'new', name: '新報名者' }),
    ).toThrow('輪空');
    expect(() => applyRosterAssignment(fixture(), 'final', 'p1', { id: 'a', name: 'a' })).toThrow(
      '首輪',
    );
    expect(() =>
      applyRosterAssignment({ ...fixture(), demo: false }, 'a-b', 'p1', { id: 'a', name: 'a' }),
    ).toThrow('正式');
  });
  function mountRoster() {
    const host = document.createElement('div'),
      bracketHost = document.createElement('div');
    document.body.append(host, bracketHost);
    bracketHost.innerHTML =
      '<button class="tt-player" data-player-id="a" data-match-id="a-b" data-round="1" data-seat="0">選手卡 a</button><button class="tt-player" data-player-id="c" data-match-id="c-d" data-round="1" data-seat="0">選手卡 c</button>';
    const onChange = vi.fn<(data: Data) => void>();
    const editor = createBracketEditor({ host, bracketHost, onChange });
    controllers.push(editor);
    editor.sync(fixture(), 'finished');
    return { editor, host, bracketHost, onChange };
  }
  const edit = () => fireEvent.click(screen.getByRole('button', { name: '編輯' }));
  it('檢視收起管理操作，編輯可點選報名者換位，返回檢視停用拖曳', () => {
    const { bracketHost, onChange } = mountRoster();
    expect(screen.queryByRole('region', { name: '報名者' })).toBeNull();
    expect(screen.queryByRole('spinbutton', { name: '示範人數' })).toBeNull();
    edit();
    fireEvent.click(screen.getByRole('button', { name: '選手c，已排入' }));
    fireEvent.click(screen.getByRole('button', { name: '選手卡 a' }));
    expect(onChange.mock.lastCall?.[0].rounds[0]!.matches[0]!.p1).toBe('c');
    fireEvent.click(screen.getByRole('button', { name: '復原上一步' }));
    expect(onChange.mock.lastCall?.[0].rounds[0]!.matches[0]!.p1).toBe('a');
    fireEvent.click(screen.getByRole('button', { name: '檢視' }));
    expect(bracketHost.querySelector('button')!.draggable).toBe(false);
    expect(screen.queryByRole('region', { name: '報名者' })).toBeNull();
  });
  it('新增報名者可用下拉選位，刷新保留名單與安排並可復原', () => {
    const first = mountRoster();
    edit();
    fireEvent.change(screen.getByRole('textbox', { name: '新增報名者姓名' }), {
      target: { value: '墨客' },
    });
    fireEvent.click(screen.getByRole('button', { name: '新增報名者' }));
    fireEvent.click(screen.getByRole('button', { name: '放入籤位' }));
    expect(first.onChange.mock.lastCall?.[0].players.some((p) => p.name === '墨客')).toBe(true);
    expect(screen.getByRole('button', { name: '選手a，待排入' })).toBeInTheDocument();
    first.editor.destroy();
    first.host.remove();
    first.bracketHost.remove();
    const next = mountRoster();
    edit();
    expect(next.onChange.mock.lastCall?.[0].players.some((p) => p.name === '墨客')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '復原上一步' }));
    expect(screen.getByRole('button', { name: '墨客，待排入' })).toBeInTheDocument();
    expect(next.onChange.mock.lastCall?.[0].players).toHaveLength(4);
  });
  it('只有本編輯器發起的拖曳能換位，取消及卸載清理拖曳事件', () => {
    const { editor, bracketHost, onChange } = mountRoster();
    edit();
    const target = bracketHost.querySelector('button')!;
    fireEvent.drop(target);
    expect(onChange).toHaveBeenCalledTimes(1);
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(screen.getByRole('button', { name: '選手c，已排入' }), { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    expect(target.dataset.dropTarget).toBe('true');
    fireEvent.drop(target, { dataTransfer });
    expect(onChange.mock.lastCall?.[0].rounds[0]!.matches[0]!.p1).toBe('c');
    expect(target.dataset.dropTarget).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: '選手a，已排入' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: '放入籤位' })).toBeDisabled();
    const count = onChange.mock.calls.length;
    editor.destroy();
    fireEvent.drop(target, { dataTransfer });
    expect(onChange).toHaveBeenCalledTimes(count);
    expect(target.draggable).toBe(false);
  });
});
