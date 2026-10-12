import { labSource } from '../../../scripts/lab-source';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Player = { id: string; name: string; rank: number; seed: number; rankName?: string };
type Match = {
  id: string;
  round: number;
  slot: number;
  p1: string;
  p2: string;
  winner: string;
  status: 'upcoming' | 'live' | 'done';
  bye: boolean;
  kind: 'bracket' | 'third';
  s1: number;
  s2: number;
  nextMatchId?: string;
  nextSlot?: number;
};
type Data = {
  players: Player[];
  rounds: { round: number; label: string; matches: Match[] }[];
  bestOf: number;
  tones?: string;
  effectRevision?: number;
  layoutPreference?: string;
  demo: boolean;
  published: boolean;
};
type Controller = { render: (data: Data) => void; destroy: () => void };
type CreateTree = (options: {
  host: HTMLElement;
  onSelect?: (id: string, button: HTMLButtonElement) => void;
  onPlayer?: (playerId: string, matchId: string, trigger: HTMLButtonElement) => void;
  signal?: AbortSignal;
  previewEmpty?: boolean;
}) => Controller;
const source = readFileSync(labSource('bracket-tree.js'), 'utf8');
const createBracketTree = runInThisContext(
  '(function(){' + source.replace(/export /g, '') + ';return createBracketTree;})()',
) as CreateTree;
const controllers: Controller[] = [];
let host: HTMLElement;
let mobile = false;
let mediaListeners: Set<() => void>;
class Observer {
  static instances: Observer[] = [];
  readonly observe = vi.fn<(target: Element) => void>();
  readonly disconnect = vi.fn();
  constructor(readonly callback: () => void) {
    Observer.instances.push(this);
  }
  notify() {
    this.callback();
  }
}
function fixture(count: number): Data {
  const players = Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `選手${i + 1}`,
    rank: (i % 4) + 1,
    seed: i + 1,
  }));
  const size = 2 ** Math.ceil(Math.log2(count));
  let cursor = 0;
  const rounds: Data['rounds'] = [];
  for (let round = 1, matches = size / 2; matches >= 1; round++, matches /= 2) {
    rounds.push({
      round,
      label: matches === 1 ? '決賽' : matches === 2 ? '準決賽' : `第${round}輪`,
      matches: Array.from({ length: matches }, (_, slot) => {
        const bye = round === 1 && slot < size - count;
        return {
          id: `m${round}-${slot}`,
          round,
          slot,
          p1: round === 1 ? players[cursor++]!.id : '',
          p2: round === 1 && !bye ? players[cursor++]!.id : '',
          winner: '',
          status: 'upcoming',
          bye,
          kind: 'bracket',
          s1: 0,
          s2: 0,
        };
      }),
    });
  }
  return { players, rounds, bestOf: 3, demo: true, published: true };
}
function mount(data: Data, onSelect?: (id: string, button: HTMLButtonElement) => void) {
  const tree = createBracketTree({ host, ...(onSelect ? { onSelect } : {}) });
  controllers.push(tree);
  tree.render(data);
  return tree;
}
const node = (id: string) =>
  [...host.querySelectorAll<HTMLButtonElement>('.tt-node')].find(
    (button) => button.dataset.matchId === id,
  )!;
const group = (id: string) => node(id).parentElement!;
const seat = (id: string, index = 0) =>
  group(id).querySelector<HTMLButtonElement>(`.tt-player[data-seat="${index}"]`)!;
const panel = (round: number) =>
  host.querySelector<HTMLElement>(`.tt-round[data-round="${round}"]`)!;
const tab = (round: number) =>
  host.querySelector<HTMLButtonElement>(`.tt-tab[data-round="${round}"]`)!;
const x = (button: HTMLElement) => parseFloat(button.style.left);
function key(target: HTMLElement, value: string) {
  const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  vi.useFakeTimers();
  mobile = false;
  mediaListeners = new Set();
  Observer.instances = [];
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return mobile;
    },
    addEventListener: (_name: string, listener: () => void) => mediaListeners.add(listener),
    removeEventListener: (_name: string, listener: () => void) => mediaListeners.delete(listener),
  }));
  vi.stubGlobal('ResizeObserver', Observer);
  host = document.createElement('div');
  document.body.append(host);
});
afterEach(() => {
  controllers.splice(0).forEach((tree) => tree.destroy());
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('完整左右晉級賽程樹', () => {
  it('敗者才有右上至左下刀痕與兩片卡面，重繪不重播，改判會移除舊刀痕', () => {
    const data = fixture(4),
      match = data.rounds[0]!.matches[0]!;
    Object.assign(match, { status: 'done', winner: match.p1 });
    const onPlayer = vi.fn();
    const tree = createBracketTree({ host, onPlayer });
    controllers.push(tree);
    tree.render(data);
    const loser = seat(match.id, 1);
    expect(loser.querySelectorAll('.tt-cut-piece')).toHaveLength(2);
    expect(loser.querySelector('.tt-cut-flash path')).toHaveAttribute('d', 'M 96 0 L 4 100');
    expect(loser.querySelector('.tt-cut-flash')).toHaveAttribute('aria-hidden', 'true');
    expect(loser.querySelectorAll('.tt-name')).toHaveLength(1);
    expect(seat(match.id).querySelector('.tt-cut-piece')).toBeNull();
    loser.click();
    expect(onPlayer).toHaveBeenCalledWith(match.p2, match.id, loser);
    expect(loser.dataset.resultEnter).toBe('true');
    tree.render(data);
    expect(seat(match.id, 1).dataset.resultEnter).toBeUndefined();
    data.effectRevision = 2;
    tree.render(data);
    expect(seat(match.id, 1).dataset.resultEnter).toBe('true');
    match.winner = match.p2;
    tree.render(data);
    expect(seat(match.id, 1).querySelector('.tt-cut-piece')).toBeNull();
    expect(seat(match.id).querySelectorAll('.tt-cut-piece')).toHaveLength(2);
  });

  it('冠軍效果只在確認、更換冠軍或手動重播時出現', () => {
    const data = fixture(8),
      final = data.rounds.at(-1)!.matches[0]!;
    const tree = mount(data);
    const crown = () => host.querySelector<HTMLElement>('.tt-champion')!;
    expect(crown().querySelector('.tt-champion-stamp')).toBeNull();
    Object.assign(final, { p1: 'p1', p2: 'p2', status: 'done', winner: 'p1' });
    tree.render(data);
    expect(crown().dataset.resultEnter).toBe('true');
    expect(crown().querySelector('.tt-champion-stamp')).toHaveTextContent('魁');
    tree.render(data);
    expect(crown().dataset.resultEnter).toBeUndefined();
    final.winner = 'p2';
    tree.render(data);
    expect(crown().dataset.resultEnter).toBe('true');
    data.effectRevision = 4;
    tree.render(data);
    expect(crown().dataset.resultEnter).toBe('true');
    final.status = 'upcoming';
    tree.render(data);
    expect(crown().querySelector('.tt-champion-stamp')).toBeNull();
  });
  it('64 人可手選完整樹與分輪，手機維持可讀分輪', () => {
    Object.defineProperty(host, 'clientWidth', { configurable: true, value: 1100 });
    const data = fixture(64),
      tree = mount(data);
    expect(host.dataset.view).toBe('round');
    data.layoutPreference = 'tree';
    tree.render(data);
    expect(host.dataset.view).toBe('tree');
    expect(host.querySelectorAll('.tt-node')).toHaveLength(63);
    data.layoutPreference = 'round';
    tree.render(data);
    expect(host.dataset.view).toBe('round');
    mobile = true;
    data.layoutPreference = 'tree';
    tree.render(data);
    expect(host.dataset.view).toBe('round');
  });

  it.each([375, 390, 768, 900, 960, 1024, 1100, 1173, 1440])(
    '可用容器 %ipx 時卡片保持可讀，完整樹不超出容器',
    (width) => {
      Object.defineProperty(host, 'clientWidth', { configurable: true, value: width });
      mount(fixture(8));
      const canvas = host.querySelector<HTMLElement>('.tt-canvas')!;
      if (host.dataset.view === 'tree') {
        expect(parseFloat(canvas.style.width)).toBeLessThanOrEqual(width - 24);
        expect(
          parseFloat(canvas.style.getPropertyValue('--tree-node-width')),
        ).toBeGreaterThanOrEqual(112);
        expect(
          [...host.querySelectorAll<HTMLElement>('.tt-round')].every((round) => !round.hidden),
        ).toBe(true);
      } else {
        expect(host.querySelector<HTMLElement>('.tt-tabs')!.hidden).toBe(false);
        expect(
          [...host.querySelectorAll<HTMLElement>('.tt-round')].filter((round) => !round.hidden),
        ).toHaveLength(1);
      }
      expect(host.dataset.view).toBe(width >= 1100 ? 'tree' : 'round');
    },
  );

  it.each([0, 1])('決賽第 %i 席勝出時，冠軍線水平直接接卡，比分不在路徑內', (winnerSeat) => {
    const data = fixture(8),
      final = data.rounds.at(-1)!.matches[0]!;
    Object.assign(final, {
      p1: 'p1',
      p2: 'p2',
      status: 'done',
      winner: winnerSeat === 0 ? 'p1' : 'p2',
    });
    mount(data);
    const crown = host.querySelector<HTMLElement>('.tt-champion')!;
    const y = parseFloat(seat(final.id).style.top) + 34;
    const winnerPath = [...host.querySelectorAll<SVGPathElement>('.tt-branch[data-winner]')].find(
      (path) => path.dataset.playerId === final.winner,
    )!;
    const edge = x(crown) + (winnerSeat === 1 ? parseFloat(crown.style.width) : 0);
    expect(winnerPath.getAttribute('d')).toBe(
      `M ${x(seat(final.id, winnerSeat)) + (winnerSeat === 0 ? 128 : 0)} ${y} H ${edge}`,
    );
    expect(host.querySelector('.tt-crown-line')).toBeNull();
    expect(parseFloat(node(final.id).style.top)).toBeGreaterThan(parseFloat(crown.style.top) + 156);
  });

  it('容器縮窄與放大保留鍵盤所在輪次，卡片重新適應寬度', async () => {
    let width = 1173;
    Object.defineProperty(host, 'clientWidth', { configurable: true, get: () => width });
    mount(fixture(8));
    seat('m1-0').focus();
    width = 900;
    Observer.instances.at(-1)!.notify();
    await vi.advanceTimersByTimeAsync(30);
    expect(host.dataset.view).toBe('round');
    expect(panel(1).hidden).toBe(false);
    expect(document.activeElement).toBe(seat('m1-0'));
    tab(1).focus();
    width = 1440;
    Observer.instances.at(-1)!.notify();
    await vi.advanceTimersByTimeAsync(30);
    expect(host.dataset.view).toBe('tree');
    expect(document.activeElement).toBe(node('m1-0'));
    expect(
      parseFloat(host.querySelector<HTMLElement>('.tt-canvas')!.style.width),
    ).toBeLessThanOrEqual(width - 24);
  });

  it('紅藍卡面可互換，胜章只在結果變化或主動重播時進場', () => {
    const data = fixture(4);
    const first = data.rounds[0]!.matches[0]!;
    first.status = 'done';
    first.winner = first.p1;
    const tree = mount(data);
    expect(seat('m1-0').dataset.tone).toBe('red');
    expect(seat('m1-1').dataset.tone).toBe('blue');
    expect(seat('m1-0', 1).dataset.tone).toBe('red');
    expect(seat('m1-0', 1).dataset.eliminated).toBe('true');
    expect(host.querySelector('.tt-tone-label')).toBeNull();
    expect(seat('m1-0').getAttribute('aria-label')).toContain('紅方');
    expect(seat('m1-0').querySelector('.tt-victory-stamp')).toHaveTextContent('勝');
    expect(seat('m1-0').dataset.resultEnter).toBe('true');
    expect(host.querySelector('.tt-flow')).not.toBeNull();
    tree.render(data);
    expect(seat('m1-0').dataset.resultEnter).toBeUndefined();
    data.tones = 'blue-left';
    tree.render(data);
    expect(seat('m1-0').dataset.tone).toBe('blue');
    expect(seat('m1-1').dataset.tone).toBe('red');
    data.effectRevision = 1;
    tree.render(data);
    expect(seat('m1-0').dataset.resultEnter).toBe('true');
  });

  it('缺少目標席位或兩個來源爭同席時，不畫出誤導的晉級線', () => {
    const data = fixture(8);
    data.demo = false;
    const first = data.rounds[0]!.matches[0]!,
      second = data.rounds[0]!.matches[1]!;
    first.nextMatchId = 'm2-0';
    const tree = mount(data);
    expect(host.querySelectorAll('.tt-advance')).toHaveLength(0);
    first.nextSlot = 0;
    second.nextMatchId = 'm2-0';
    second.nextSlot = 0;
    tree.render(data);
    expect(host.querySelectorAll('.tt-advance')).toHaveLength(0);
    expect(seat('m2-0').textContent).toContain('待上一輪勝者');
    expect(node(first.id).getAttribute('aria-label')).not.toContain('0 比 0');
  });

  it('名帖與比分為獨立按鈕：姓名開選手，匯合處開場次，輪詢保留名帖焦點', () => {
    const data = fixture(8),
      onPlayer = vi.fn(),
      onSelect = vi.fn();
    const tree = createBracketTree({ host, onPlayer, onSelect });
    controllers.push(tree);
    tree.render(data);
    expect(host.querySelector('button button')).toBeNull();
    seat('m1-0', 1).focus();
    seat('m1-0', 1).click();
    expect(onPlayer).toHaveBeenCalledWith('p2', 'm1-0', seat('m1-0', 1));
    expect(onSelect).not.toHaveBeenCalled();
    tree.render(data);
    expect(document.activeElement).toBe(seat('m1-0', 1));
    node('m1-0').click();
    expect(onSelect).toHaveBeenCalledWith('m1-0', node('m1-0'));
    seat('m2-0').click();
    expect(onPlayer).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenLastCalledWith('m2-0', seat('m2-0'));
  });

  it('每張名帖單獨落位，勝者染出晉級線，敗者止步且懸停只突出本人路徑', () => {
    const data = fixture(8),
      first = data.rounds[0]!.matches[0]!;
    first.status = 'done';
    first.winner = first.p1;
    first.s1 = 2;
    first.s2 = 1;
    data.rounds[1]!.matches[0]!.p1 = first.p1;
    mount(data);
    expect(parseFloat(seat(first.id, 0).style.top)).toBeLessThan(
      parseFloat(seat(first.id, 1).style.top),
    );
    expect(seat(first.id, 1).dataset.eliminated).toBe('true');
    expect(seat(first.id, 1).querySelector('.tt-defeat-stamp')).toHaveTextContent('敗');
    seat(first.id).dispatchEvent(new Event('pointerenter'));
    const highlighted = [...host.querySelectorAll('[data-highlight]')];
    expect(highlighted.length).toBeGreaterThan(2);
    expect(highlighted.every((item) => (item as HTMLElement).dataset.playerId === first.p1)).toBe(
      true,
    );
    expect(host.querySelector('.tt-advance[data-from="m1-0"]')?.getAttribute('data-winner')).toBe(
      'true',
    );
    expect(
      host.querySelectorAll(`.tt-branch[data-player-id="${first.p2}"][data-winner]`),
    ).toHaveLength(0);
  });

  it.each([4, 8, 16, 24])('%i 位選手保留完整籤位，兩側逐輪向中央決賽匯合', (count) => {
    const data = fixture(count);
    mount(data);
    const size = 2 ** Math.ceil(Math.log2(count));
    expect(host.querySelectorAll('.tt-node')).toHaveLength(size - 1);
    expect(host.querySelectorAll('.tt-connectors .tt-advance')).toHaveLength(size - 2);
    expect(host.dataset.links).toBe('complete');
    const finalRound = data.rounds.at(-1)!;
    const final = node(finalRound.matches[0]!.id);
    expect(final.dataset.side).toBe('final');
    for (const round of data.rounds.slice(0, -1)) {
      const left = node(round.matches[0]!.id);
      const right = node(round.matches.at(-1)!.id);
      expect(left.dataset.side).toBe('left');
      expect(right.dataset.side).toBe('right');
      expect(x(left)).toBeLessThan(x(final));
      expect(x(right)).toBeGreaterThan(x(final));
      expect(x(final) - x(left)).toBe(x(right) - x(final));
      expect([...panel(round.round).querySelectorAll('.tt-node')]).toHaveLength(
        round.matches.length,
      );
    }
    for (const path of host.querySelectorAll('.tt-connectors .tt-advance')) {
      // Every edge contains both horizontal reaches and a vertical branch, not a decorative dash.
      expect(path.getAttribute('d')).toMatch(/^M [\d.]+ [\d.]+ H [\d.]+ V [\d.]+ H [\d.]+$/);
    }
    const byes = [...host.querySelectorAll('.tt-node .tt-state')].filter(
      (state) => state.textContent === '輪空',
    );
    expect(byes).toHaveLength(size - count);
    if (count === 24) expect(host.textContent).not.toContain('選手25');
    if (count === 16)
      expect(
        parseFloat(host.querySelector<HTMLElement>('.tt-canvas')!.style.width),
      ).toBeGreaterThan(1100);
  });

  it.each([4, 8, 16])(
    '%i 人名帖遇到長姓名增高時，冠軍位於決賽雙席之間，長姓名與季軍戰不互相壓住',
    (count) => {
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: HTMLElement,
      ) {
        return new DOMRect(0, 0, 164, this.classList.contains('tt-player') ? 240 : 0);
      });
      const data = fixture(count),
        final = data.rounds.at(-1)!.matches[0]!;
      data.rounds.at(-1)!.matches.push({ ...final, id: 'third', kind: 'third', slot: 1 });
      mount(data);
      const crest = host.querySelector<HTMLElement>('.tt-final-crest')!;
      expect(parseFloat(crest.style.top)).toBeGreaterThanOrEqual(92);
      const finalTop = parseFloat(seat(final.id).style.top);
      expect(parseFloat(crest.style.top) + 78).toBe(finalTop + 120);
      expect(x(crest)).toBeGreaterThan(x(seat(final.id)) + 128);
      expect(x(crest) + parseFloat(crest.style.width)).toBeLessThan(x(seat(final.id, 1)));
      expect(parseFloat(seat('third').style.top)).toBeGreaterThanOrEqual(finalTop + 240 + 24);
      expect(
        parseFloat(host.querySelector<HTMLElement>('.tt-canvas')!.style.height),
      ).toBeGreaterThan(parseFloat(seat('third').style.top) + 240);
      expect(
        group(data.rounds[0]!.matches[0]!.id).querySelectorAll('.tt-player-seal'),
      ).toHaveLength(2);
      expect(
        group(data.rounds[0]!.matches[0]!.id)
          .querySelector('.tt-player-seal')
          ?.getAttribute('aria-hidden'),
      ).toBe('true');
    },
  );

  it('未決位置顯示前場勝者來源，已決賽路徑與選手標記點亮並保留比分', () => {
    const data = fixture(8),
      first = data.rounds[0]!.matches[0]!;
    first.status = 'done';
    first.winner = first.p1;
    first.s1 = 2;
    first.s2 = 1;
    mount(data);
    expect(group('m2-0').textContent).toContain('第1輪第1場勝者');
    expect(group('m2-0').textContent).toContain('第1輪第2場勝者');
    expect(
      [...group(first.id).querySelectorAll('.tt-score')].map((score) => score.textContent),
    ).toEqual(['2', '1']);
    expect(group(first.id).querySelector('.tt-player[data-winner] .tt-name')?.textContent).toBe(
      '選手1',
    );
    expect(
      host
        .querySelector('.tt-connectors .tt-advance[data-from="m1-0"]')
        ?.getAttribute('data-winner'),
    ).toBe('true');
    expect(host.querySelectorAll('.tt-demo')).toHaveLength(1);
  });

  it('正式資料只接已知路徑；部分與未知關係不猜下一場或對手', () => {
    const data = fixture(8);
    data.demo = false;
    const tree = mount(data);
    expect(host.dataset.links).toBe('unknown');
    expect(host.querySelectorAll('.tt-connectors .tt-advance')).toHaveLength(0);
    expect(group('m2-0').textContent).toContain('待上一輪勝者');
    expect(group('m2-0').textContent).not.toContain('第1輪第1場勝者');
    const first = data.rounds[0]!.matches[0]!;
    first.nextMatchId = 'm2-1';
    first.nextSlot = 1;
    tree.render(data);
    expect(host.dataset.links).toBe('partial');
    expect(host.querySelectorAll('.tt-connectors .tt-advance')).toHaveLength(1);
    expect(host.querySelector('.tt-connectors .tt-advance')?.getAttribute('data-to')).toBe('m2-1');
    expect(group('m2-1').textContent).toContain('第1輪第1場勝者');
    expect(group('m2-0').textContent).not.toContain('第1輪第1場勝者');
    first.nextMatchId = 'unknown-id';
    tree.render(data);
    expect(host.querySelectorAll('.tt-connectors .tt-advance')).toHaveLength(0);
  });

  it('正式賽果只接下一輪唯一相符的勝者席位，輪空與不戰而勝不捏造比分', () => {
    const data = fixture(8);
    data.demo = false;
    const first = data.rounds[0]!.matches[0]!;
    first.status = 'done';
    first.winner = first.p1;
    first.bye = true;
    first.p2 = '';
    data.rounds[1]!.matches[0]!.p2 = first.winner;
    data.players[0]!.seed = 0;
    const tree = mount(data);
    expect(host.dataset.links).toBe('partial');
    const link = host.querySelector('.tt-connectors .tt-advance');
    expect(link?.getAttribute('data-from')).toBe(first.id);
    expect(link?.getAttribute('data-to')).toBe('m2-0');
    expect(link?.getAttribute('data-winner')).toBe('true');
    expect(group(first.id).querySelector('.tt-state')).toHaveTextContent('輪空');
    expect(
      [...group(first.id).querySelectorAll('.tt-score')].every(
        (score) => score.textContent === '—',
      ),
    ).toBe(true);
    expect(group(first.id).querySelector('.tt-seed')).toBeNull();
    expect(host.textContent).not.toContain('#0');
    first.p2 = 'p2';
    tree.render(data);
    expect(group(first.id).querySelector('.tt-state')?.textContent).toBe('不戰而勝');
    expect(group(first.id).textContent).not.toContain('輪空');
    expect(
      [...group(first.id).querySelectorAll('.tt-score')].every(
        (score) => score.textContent === '—',
      ),
    ).toBe(true);
  });

  it('不從重複勝者、重複下一輪席位、跨輪資料或未確認賽果推論連線', () => {
    const data = fixture(8);
    data.demo = false;
    const first = data.rounds[0]!.matches[0]!,
      next = data.rounds[1]!.matches[0]!;
    first.status = 'done';
    first.winner = first.p1;
    next.p1 = first.winner;
    const tree = mount(data);
    expect(host.querySelectorAll('.tt-connectors .tt-advance')).toHaveLength(1);
    next.p2 = first.winner;
    tree.render(data);
    expect(host.querySelectorAll('.tt-connectors .tt-advance')).toHaveLength(0);
    next.p2 = '';
    const duplicate = data.rounds[0]!.matches[1]!;
    duplicate.status = 'done';
    duplicate.winner = first.winner;
    duplicate.p1 = first.winner;
    tree.render(data);
    expect(host.querySelectorAll('.tt-connectors .tt-advance')).toHaveLength(0);
    duplicate.winner = '';
    duplicate.status = 'upcoming';
    first.status = 'live';
    tree.render(data);
    expect(host.querySelectorAll('.tt-connectors .tt-advance')).toHaveLength(0);
    first.status = 'done';
    const skipped = { ...data, rounds: [data.rounds[0]!, { ...data.rounds[1]!, round: 3 }] };
    tree.render(skipped);
    expect(host.querySelectorAll('.tt-connectors .tt-advance')).toHaveLength(0);
    first.winner = 'unrelated-player';
    next.p1 = first.winner;
    tree.render(data);
    expect(host.querySelectorAll('.tt-connectors .tt-advance')).toHaveLength(0);
    expect(host.dataset.links).toBe('unknown');
  });

  it('明示晉級關係優先，確認勝者不可佔用已有來源的席位', () => {
    const data = fixture(8);
    data.demo = false;
    const first = data.rounds[0]!.matches[0]!,
      second = data.rounds[0]!.matches[1]!;
    first.status = 'done';
    first.winner = first.p1;
    data.rounds[1]!.matches[0]!.p1 = first.winner;
    second.nextMatchId = 'm2-0';
    second.nextSlot = 0;
    mount(data);
    expect(host.querySelectorAll('.tt-connectors .tt-advance')).toHaveLength(1);
    expect(host.querySelector('.tt-connectors .tt-advance')?.getAttribute('data-from')).toBe(
      second.id,
    );
  });

  it('不規則示範不推測拓樸，季軍賽獨立顯示且不接入冠軍路徑', () => {
    const data = fixture(8);
    const final = data.rounds.at(-1)!;
    final.matches.push({ ...final.matches[0]!, id: 'third', kind: 'third', slot: 1 });
    mount(data);
    expect(node('third').dataset.side).toBe('third');
    expect(group('third').textContent).toContain('季軍賽');
    expect(host.querySelectorAll('.tt-connectors .tt-advance')).toHaveLength(6);
    expect(host.querySelector('[data-from="third"],[data-to="third"]')).toBeNull();
    const irregular = fixture(8);
    irregular.rounds[0]!.matches.pop();
    const second = mount(irregular);
    expect(host.querySelectorAll('.tt-connectors .tt-advance')).toHaveLength(0);
    expect(host.dataset.links).toBe('unknown');
    second.destroy();
  });

  it('姓名完整保留且不執行 HTML，姓名區不再顯示段位、籤號與勝敗文字', () => {
    const data = fixture(4);
    data.players[0]!.name = '<img src=x onerror=alert(1)>這是一位名字很長的參賽者';
    const tree = mount(data);
    expect(group('m1-0').querySelector('.tt-name')?.textContent).toBe(data.players[0]!.name);
    expect(host.querySelector('.tt-name img,.tt-champion-name img,script,[onerror]')).toBeNull();
    expect(host.querySelector('.tt-player-meta,.tt-rank,.tt-seed')).toBeNull();
    expect(seat('m1-0').querySelector('.tt-identity')?.textContent).toBe(data.players[0]!.name);
    data.players[1]!.rankName = '大會認定段位';
    tree.render(data);
    expect(group('m1-0').textContent).not.toContain('大會認定段位');
  });

  it('中央冠軍卡等待已確認決賽勝者，更新保留焦點且點卡進入決賽', () => {
    const data = fixture(8),
      final = data.rounds.at(-1)!.matches[0]!,
      onSelect = vi.fn();
    final.p1 = 'p1';
    final.p2 = 'p2';
    final.winner = 'p2';
    const tree = mount(data, onSelect);
    const crown = () => host.querySelector<HTMLButtonElement>('.tt-champion')!;
    expect(crown().textContent).toContain('冠軍待定');
    final.status = 'live';
    tree.render(data);
    expect(crown().dataset.confirmed).toBeUndefined();
    crown().focus();
    final.status = 'done';
    tree.render(data);
    expect(crown().querySelector('.tt-champion-name')?.textContent).toBe('選手2');
    expect(crown().dataset.confirmed).toBe('true');
    expect(document.activeElement).toBe(crown());
    crown().click();
    expect(onSelect).toHaveBeenCalledWith(final.id, crown());
    final.winner = 'missing';
    tree.render(data);
    expect(crown().textContent).toContain('冠軍待定');
    final.winner = 'p8';
    tree.render(data);
    expect(crown().textContent).toContain('冠軍待定');
  });

  it('手機冠軍卡只隨決賽輪出現，桌機與手機共用同一份冠軍資料', () => {
    mobile = true;
    mount(fixture(8));
    const crown = host.querySelector<HTMLElement>('.tt-champion')!;
    expect(crown.closest('[hidden]')).toBe(panel(3));
    tab(3).click();
    expect(crown.closest('[hidden]')).toBeNull();
    expect(crown.previousElementSibling).toBe(seat('m3-0'));
    expect(crown.nextElementSibling).toBe(seat('m3-0', 1));
  });

  it('待定場次也是原生按鈕，點擊傳回場次與觸發按鈕', () => {
    const onSelect = vi.fn<(id: string, button: HTMLButtonElement) => void>();
    mount(fixture(8), onSelect);
    const button = node('m3-0');
    expect(button.tagName).toBe('BUTTON');
    expect(button.type).toBe('button');
    expect(button.disabled).toBe(false);
    button.focus();
    expect(document.activeElement).toBe(button);
    button.click();
    expect(onSelect).toHaveBeenCalledWith('m3-0', button);
  });

  it.each(['live', 'pending', 'finished'])('手機預設 %s 輪，兩半場都在同一個輪次面板', (state) => {
    mobile = true;
    const data = fixture(16);
    for (const round of data.rounds) for (const match of round.matches) match.status = 'done';
    const expected = state === 'finished' ? 4 : 2;
    if (state !== 'finished')
      data.rounds[1]!.matches[0]!.status = state === 'live' ? 'live' : 'upcoming';
    mount(data);
    expect(host.dataset.view).toBe('round');
    expect(tab(expected).getAttribute('aria-selected')).toBe('true');
    expect(
      [...host.querySelectorAll<HTMLElement>('.tt-round')].filter((round) => !round.hidden),
    ).toEqual([panel(expected)]);
    expect(panel(expected).getAttribute('role')).toBe('tabpanel');
    expect(panel(expected).querySelectorAll('.tt-node')).toHaveLength(
      data.rounds[expected - 1]!.matches.length,
    );
    tab(1).click();
    expect(panel(1).querySelectorAll('.tt-node[data-side="left"]')).toHaveLength(4);
    expect(panel(1).querySelectorAll('.tt-node[data-side="right"]')).toHaveLength(4);
  });

  it('輪次按鍵不穿透章節，重繪保留選擇，舊按鈕與 observer 回呼不再作用', async () => {
    mobile = true;
    const data = fixture(8),
      onSelect = vi.fn();
    const tree = mount(data, onSelect);
    const propagate = vi.fn();
    document.addEventListener('keydown', propagate);
    tab(1).focus();
    expect(key(tab(1), 'ArrowRight').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(tab(2));
    expect(propagate).not.toHaveBeenCalled();
    key(tab(2), 'End');
    expect(document.activeElement).toBe(tab(3));
    key(tab(3), 'Home');
    expect(document.activeElement).toBe(tab(1));
    key(tab(1), 'ArrowLeft');
    expect(document.activeElement).toBe(tab(3));
    key(tab(3), 'ArrowDown');
    expect(document.activeElement).toBe(seat('m3-0'));
    key(node('m3-0'), 'ArrowLeft');
    key(node('m3-0'), 'PageDown');
    expect(propagate).not.toHaveBeenCalled();
    document.removeEventListener('keydown', propagate);
    const oldNode = node('m1-0'),
      oldTab = tab(1),
      oldObserver = Observer.instances[0]!;
    oldObserver.notify();
    tree.render(data);
    expect(tab(3).getAttribute('aria-selected')).toBe('true');
    expect(oldObserver.disconnect).toHaveBeenCalledOnce();
    oldNode.click();
    oldTab.click();
    oldObserver.notify();
    const html = host.innerHTML;
    await vi.advanceTimersByTimeAsync(100);
    expect(host.innerHTML).toBe(html);
    expect(onSelect).not.toHaveBeenCalled();
    mobile = false;
    mediaListeners.forEach((listener) => listener());
    expect(
      [...host.querySelectorAll<HTMLElement>('.tt-round')].every((round) => !round.hidden),
    ).toBe(true);
    expect(host.dataset.view).toBe('tree');
  });

  it.each([false, true])(
    '輪詢重繪保留比賽焦點與圖內位置（手機=%s），外部焦點不被搶走',
    (compact) => {
      mobile = compact;
      const data = fixture(8),
        tree = mount(data);
      if (compact) tab(2).click();
      const old = node('m2-0');
      old.focus();
      const viewport = host.querySelector<HTMLElement>('.tt-viewport')!;
      viewport.scrollLeft = 84;
      viewport.scrollTop = 110;
      data.rounds[1]!.matches[0]!.s1 = 1;
      tree.render(data);
      expect(document.activeElement).toBe(node('m2-0'));
      expect(document.activeElement).not.toBe(old);
      expect(tab(2).getAttribute('aria-selected')).toBe('true');
      expect(host.querySelector<HTMLElement>('.tt-viewport')!.scrollLeft).toBe(84);
      expect(host.querySelector<HTMLElement>('.tt-viewport')!.scrollTop).toBe(110);
      const outside = document.createElement('button');
      document.body.append(outside);
      outside.focus();
      tree.render(data);
      expect(document.activeElement).toBe(outside);
    },
  );

  it('手機保留輪次按鈕焦點，移除場次回到同輪按鈕；斷點變更不留下隱藏焦點', () => {
    mobile = true;
    const data = fixture(8),
      tree = mount(data);
    tab(2).focus();
    tab(2).click();
    tree.render(data);
    expect(document.activeElement).toBe(tab(2));
    node('m2-0').focus();
    data.rounds[1]!.matches.shift();
    tree.render(data);
    expect(document.activeElement).toBe(tab(2));
    mobile = false;
    mediaListeners.forEach((listener) => listener());
    expect(document.activeElement).toBe(node('m2-1'));
    node('m1-0').focus();
    mobile = true;
    mediaListeners.forEach((listener) => listener());
    expect(panel(1).hidden).toBe(false);
    expect(document.activeElement).toBe(node('m1-0'));
    tree.render({ ...data, published: false });
    expect(document.activeElement).toBe(host.querySelector('.tt-empty'));
    expect(document.activeElement?.textContent).toContain('對戰表尚未公布');
  });

  it('空白樹不洩漏未公布選手、不開啟假場次，公布後恢復實際資料', () => {
    const onSelect = vi.fn(),
      onPlayer = vi.fn();
    const tree = createBracketTree({ host, previewEmpty: true, onSelect, onPlayer });
    controllers.push(tree);
    const data = { ...fixture(8), published: false };
    const original = JSON.stringify(data);
    tree.render(data);
    expect(host.hasAttribute('data-placeholder')).toBe(true);
    expect(host.dataset.links).toBe('complete');
    expect(host.querySelectorAll('.tt-node')).toHaveLength(3);
    expect(host.textContent).not.toContain('選手1');
    expect(host.textContent).not.toContain('8 位選手');
    expect(host.textContent).toContain('實際輪次與籤位待公布');
    host
      .querySelectorAll<HTMLButtonElement>('.tt-player,.tt-node,.tt-champion')
      .forEach((button) => {
        expect(button.disabled).toBe(true);
        button.click();
      });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onPlayer).not.toHaveBeenCalled();
    expect(JSON.stringify(data)).toBe(original);
    mobile = true;
    mediaListeners.forEach((listener) => listener());
    tab(2).click();
    expect(panel(2).hidden).toBe(false);
    tree.render({ ...data, published: true });
    expect(host.hasAttribute('data-placeholder')).toBe(false);
    expect(host.querySelectorAll('.tt-node')).toHaveLength(7);
    node('m1-0').click();
    expect(onSelect).toHaveBeenCalledOnce();
    tree.destroy();
    expect(host.hasAttribute('data-placeholder')).toBe(false);
  });

  it('未公布不泄漏 fixture，Abort/destroy 清理 observer、事件與非同步版面工作', async () => {
    const data = fixture(8),
      abort = new AbortController(),
      onSelect = vi.fn();
    const tree = createBracketTree({ host, onSelect, signal: abort.signal });
    controllers.push(tree);
    tree.render({ ...data, published: false });
    expect(host.textContent).toContain('對戰表尚未公布');
    expect(host.querySelectorAll('.tt-node')).toHaveLength(0);
    tree.render(data);
    const button = node('m1-0'),
      observer = Observer.instances.at(-1)!;
    observer.notify();
    abort.abort();
    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(mediaListeners.size).toBe(0);
    expect(host.childElementCount).toBe(0);
    button.click();
    observer.notify();
    tree.render(data);
    await vi.advanceTimersByTimeAsync(100);
    expect(onSelect).not.toHaveBeenCalled();
    expect(host.childElementCount).toBe(0);
  });
});
