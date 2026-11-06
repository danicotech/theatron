import { labSource } from '../../../scripts/lab-source';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apply, buildEvent, defaultSnapshot, initialState } from '../features/sportsbook/engine';
import { present } from '../features/sportsbook/SportsbookBridge';
import { LUNJIAN_MARKUP } from './lunjianMarkup';
import { activityDisplay } from '../features/landing/activityDisplay';
import type { TournamentDisplay } from '../features/landing/tournamentDisplay';
import { TournamentPhase } from '../lib/api/gen/hestia/activity/v1/common_pb';

const source = readFileSync('web/public/lunjian/lunjian.js', 'utf8')
  .replace(
    /import\('[^']*bracket-editor\.js[^']*'\)/g,
    'Promise.resolve({createBracketEditor:globalThis.testCreateEditor})',
  )
  .replace(
    // The page loads battle-view.js, whose schedule wraps this same tree; the wiring is what is tested here.
    /import\('[^']*(?:bracket-tree|battle-view)\.js[^']*'\)/g,
    'Promise.resolve({createBracketTree:globalThis.testCreateTree,createBattleDuel:globalThis.testCreateDuel})',
  )
  .replace(
    /import\('[^']*arena-ticket\.js[^']*'\)/g,
    'Promise.resolve({createArenaTicket:globalThis.testCreateTicket})',
  );
function factory(file: string, name: string): unknown {
  return runInThisContext(
    '(function(){' +
      readFileSync(labSource(file), 'utf8').replace(/export /g, '') +
      ';return ' +
      name +
      ';})()',
  );
}
const element = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const click = (selector: string) => element(selector).click();
type Runtime = NonNullable<Window['__LUNJIAN']> & { selectDuelMatch: (id: string) => void };
const runtime = () => window.__LUNJIAN! as Runtime;
const formal = (): TournamentDisplay => ({
  kind: 'ready',
  slug: 'autumn-cup',
  bestOf: 3,
  published: true,
  players: [
    { id: 'p/a', name: '蒼松', rank: 2, rankName: '斷水', seed: 1 },
    { id: 'p?b', name: '夜雨', rank: 3, rankName: '飛花', seed: 2 },
    { id: 'p-c', name: '<img src=x onerror=alert(1)>', rank: 1, rankName: '開山', seed: 3 },
    { id: 'p-d', name: '遠山', rank: 4, rankName: '無我', seed: 4 },
  ],
  rounds: [
    {
      round: 1,
      label: '準決賽',
      matches: [
        {
          id: 'match/one',
          round: 1,
          slot: 0,
          p1: 'p/a',
          p2: 'p?b',
          winner: '',
          status: 'live',
          bye: false,
          kind: 'bracket',
          s1: 0,
          s2: 1,
        },
        {
          id: 'match-two',
          round: 1,
          slot: 1,
          p1: 'p-c',
          p2: 'p-d',
          winner: 'p-d',
          status: 'done',
          bye: false,
          kind: 'bracket',
          s1: 0,
          s2: 2,
        },
      ],
    },
  ],
});
async function mount(url = '/?stage=2d&intro=0#schedule') {
  history.replaceState(null, '', url);
  document.body.innerHTML = LUNJIAN_MARKUP;
  runInThisContext(source);
  await vi.advanceTimersByTimeAsync(1);
}
async function publish() {
  runtime().updateActivity(activityDisplay('autumn-cup', TournamentPhase.IN_PROGRESS));
  runtime().updateTournament(formal());
  await vi.advanceTimersByTimeAsync(1);
}
function node(id: string) {
  return [
    ...document.querySelectorAll<HTMLButtonElement>('#bracket-host .tt-node[data-match-id]'),
  ].find((button) => button.dataset.matchId === id)!;
}
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('pointer: fine'),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal('innerWidth', 1440);
  vi.stubGlobal('innerHeight', 900);
  vi.stubGlobal('scrollTo', vi.fn());
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('anime', Object.assign(vi.fn(), { remove: vi.fn(), stagger: vi.fn() }));
  vi.stubGlobal('mountInk', vi.fn());
  vi.stubGlobal('playInk', vi.fn());
  vi.stubGlobal('inkVS', () => document.createElement('span'));
  vi.stubGlobal('INK', { load: () => Promise.resolve() });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('testCreateEditor', factory('bracket-editor.js', 'createBracketEditor'));
  vi.stubGlobal('testCreateTree', factory('bracket-tree.js', 'createBracketTree'));
  vi.stubGlobal('testCreateTicket', factory('arena-ticket.js', 'createArenaTicket'));
});
afterEach(() => {
  window.__LUNJIAN?.destroy();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('賽程 → 指定場次比武 → 選手與投注', () => {
  it('預覽編輯可改決賽贏家，冠軍與比武同步；離開模式恢復查看入口', async () => {
    await mount('/?mode=manage&preview=1&phase=finished&stage=2d&intro=0#schedule');
    await vi.advanceTimersByTimeAsync(1);
    const edit = [...document.querySelectorAll<HTMLButtonElement>('#bracket-tools button')].find(
      (b) => b.textContent === '編輯',
    )!;
    expect(edit).toBeDefined();
    edit.click();
    node('m3-0').click();
    const dialog = element<HTMLDialogElement>('.bracket-editor-dialog');
    expect(dialog.open).toBe(true);
    const p1 = element<HTMLSelectElement>('.bracket-editor-dialog [name="p1"]');
    const winner = element<HTMLSelectElement>('.bracket-editor-dialog [name="winner"]');
    winner.value = p1.value;
    winner.dispatchEvent(new Event('change', { bubbles: true }));
    const name = p1.selectedOptions[0]!.textContent;
    element<HTMLFormElement>('.bracket-editor-dialog form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    expect(dialog.open).toBe(false);
    expect(element('.tt-champion-name').textContent).toBe(name);
    expect(location.hash).toBe('#schedule');
    [...document.querySelectorAll<HTMLButtonElement>('#bracket-tools button')]
      .find((b) => b.textContent === '檢視')!
      .click();
    node('m3-0').click();
    await vi.advanceTimersByTimeAsync(4000);
    expect(location.hash).toBe('#duel');
    expect(element('#duel-title').textContent).toContain(name);
    expect(localStorage.getItem('lunjian.bracket-editor.v1.finished')).toContain('m3-0');
  });

  it('編輯報名者換位後更新真正樹節點，復原與檢視入口不受干擾', async () => {
    await mount('/?mode=manage&preview=1&phase=finished&stage=2d&intro=0#schedule');
    await vi.advanceTimersByTimeAsync(1);
    [...document.querySelectorAll<HTMLButtonElement>('#bracket-tools button')]
      .find((b) => b.textContent === '編輯')!
      .click();
    const seats = [
      ...document.querySelectorAll<HTMLButtonElement>('#bracket-host .tt-player[data-round="1"]'),
    ];
    const target = seats[0]!,
      other = seats[2]!,
      id = other.dataset.playerId!;
    expect(target.draggable).toBe(true);
    [...document.querySelectorAll<HTMLButtonElement>('[data-registrant-id]')]
      .find((b) => b.dataset.registrantId === id)!
      .click();
    target.click();
    const replaced = element<HTMLButtonElement>(
      `#bracket-host .tt-player[data-match-id="${target.dataset.matchId}"][data-seat="${target.dataset.seat}"]`,
    );
    expect(replaced.dataset.playerId).toBe(id);
    expect(replaced.draggable).toBe(true);
    expect(element<HTMLDialogElement>('.bracket-editor-dialog').open).toBe(false);
    expect(location.hash).toBe('#schedule');
    [...document.querySelectorAll<HTMLButtonElement>('#bracket-tools button')]
      .find((b) => b.textContent === '復原上一步')!
      .click();
    expect(
      element<HTMLButtonElement>(
        `#bracket-host .tt-player[data-match-id="${target.dataset.matchId}"][data-seat="${target.dataset.seat}"]`,
      ).dataset.playerId,
    ).toBe(target.dataset.playerId);
  });

  it('點名帖留在賽程查看指定選手，輪詢後關閉仍還原焦點，面板可前往同場比武', async () => {
    await mount();
    await publish();
    const player = () =>
      [...document.querySelectorAll<HTMLButtonElement>('#bracket-host .tt-player')].find(
        (button) => button.dataset.matchId === 'match/one' && button.dataset.seat === '1',
      )!;
    player().focus();
    player().click();
    expect(location.hash).toBe('#schedule');
    expect(element('#psheet').hidden).toBe(false);
    expect(element('#dz-title').textContent).toBe('夜雨');
    expect(element('#dz-actions').textContent).toContain('返回賽程');
    const updated = formal();
    updated.rounds[0]!.matches[0]!.s1 = 1;
    runtime().updateTournament(updated);
    await vi.advanceTimersByTimeAsync(1);
    click('#dz-actions [data-dz-close]');
    expect(document.activeElement).toBe(player());
    player().click();
    click('[data-dz-match]');
    await vi.advanceTimersByTimeAsync(4000);
    expect(location.hash).toBe('#duel');
    expect(new URL(location.href).searchParams.get('match')).toBe('match/one');
    expect(element('#duel-name-r').textContent).toBe('夜雨');
    expect(element('#psheet').hidden).toBe(true);
  });

  it.each(['bracket', 'duel'])(
    '已開啟的 %s 選手配置隨確認更新同步，保留閱讀位置與焦點',
    async (origin) => {
      await mount();
      await publish();
      const initial = formal();
      initial.players[0]!.character = {
        style: '裂石鈞',
        weapon: '劍',
        equipment: '',
        arts: '',
        snapshotJson: 'old-confirmed',
      };
      runtime().updateTournament(initial);
      const updates: string[] = [];
      const listener = (event: Event) => {
        const detail = (
          event as CustomEvent<{ host: HTMLElement; character: { snapshotJson: string } }>
        ).detail;
        event.preventDefault();
        detail.host.textContent = detail.character.snapshotJson;
        updates.push(detail.character.snapshotJson);
      };
      document.addEventListener('lunjian:dossier-loadout', listener);
      try {
        if (origin === 'duel') {
          runtime().selectDuelMatch('match/one');
          await vi.advanceTimersByTimeAsync(4000);
          click('#duel .duelist[data-side="left"]');
        } else click('#bracket-host .tt-player[data-player-id="p/a"]');
        element('.dz-sheet').scrollTop = 260;
        const close = element<HTMLButtonElement>('.dz-close');
        close.focus();
        const updated = structuredClone(initial);
        updated.players[0]!.character!.snapshotJson = 'latest-confirmed';
        runtime().updateTournament(updated);
        await vi.advanceTimersByTimeAsync(50);
        expect(updates).toEqual(['old-confirmed', 'latest-confirmed']);
        expect(element('#dz-body').textContent).toContain('latest-confirmed');
        expect(element('#psheet').hidden).toBe(false);
        expect(element('.dz-sheet').scrollTop).toBe(260);
        expect(document.activeElement).toBe(close);
        runtime().updateTournament(structuredClone(updated));
        expect(updates).toHaveLength(2);
        const removed = structuredClone(updated);
        removed.players = removed.players.filter((p) => p.id !== 'p/a');
        runtime().updateTournament(removed);
        expect(element('#psheet').hidden).toBe(true);
      } finally {
        document.removeEventListener('lunjian:dossier-loadout', listener);
      }
    },
  );

  it('從賽程選取指定場次，網址、雙方、比分與勝者同步，保留原滿版比武', async () => {
    await mount();
    await publish();
    node('match-two').focus();
    node('match-two').click();
    await vi.advanceTimersByTimeAsync(4000);
    expect(location.hash).toBe('#duel');
    expect(new URL(location.href).searchParams.get('match')).toBe('match-two');
    expect(document.querySelector('.chapter[data-on]')?.id).toBe('duel');
    expect(document.activeElement).toBe(element('#duel .duelist[data-side="left"]'));
    expect(element('#duel-name-l').textContent).toBe('<img src=x onerror=alert(1)>');
    expect(element('#duel-name-r').textContent).toBe('遠山');
    expect(element('#duel-score').textContent).toBe('0 : 2');
    expect(element('#duel-title').textContent).toContain('遠山 勝出');
    expect(element('#duel .arena-composition').dataset.outcome).toBe('right');
    expect(element('#vs').hidden).toBe(true);
    expect(element('#duel-name-l').querySelector('img')).toBeNull();
  });

  it('深連結等候 API 後仍選對場；詳情與正式下注目的地帶入同一選手，不補造裝備', async () => {
    await mount('/?stage=2d&intro=0&match=match%2Fone#duel');
    await publish();
    expect(element('#duel-name-l').textContent).toBe('蒼松');
    expect(element('#duel-name-r').textContent).toBe('夜雨');
    expect(element('#duel-score').textContent).toBe('0 : 1');
    expect(element('#duel-odds').textContent).toBe('');
    click('#duel .duelist[data-side="right"]');
    expect(element('#psheet').hidden).toBe(false);
    expect(element('#dz-title').textContent).toBe('夜雨');
    expect(element('#dz-body').textContent).toContain('尚未提交參賽配置');
    expect(element('#dz-body').textContent).not.toMatch(/危寂長劍|積矩九劍|百鬼打穴手/);
    expect(element('#dz-actions [data-duel-markets]').getAttribute('data-duel-markets')).toBe(
      'match/one',
    );
    expect(element('#dz-actions [data-outcome]').getAttribute('data-outcome')).toBe('p2');
    // 比武底部不再放選手快捷下注，下注只從詳情與觀局雅集進入。
    expect(element('#duel-bet-actions').children).toHaveLength(0);
    expect(document.querySelector('[data-arena-bet]')).toBeNull();
  });

  it('瀏覽器上一頁／下一頁依網址還原場次，未知結果不虛構勝者或倒地人物', async () => {
    await mount('/?stage=2d&intro=0&match=match%2Fone#duel');
    await publish();
    runtime().selectDuelMatch('match-two');
    await vi.advanceTimersByTimeAsync(4000);
    history.replaceState(null, '', '/?stage=2d&intro=0&match=match%2Fone#duel');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(element('#duel-name-l').textContent).toBe('蒼松');
    expect(element('#duel-score').textContent).toBe('0 : 1');
    expect(element('#duel .arena-composition').dataset.outcome).toBe('none');
    const update = formal();
    update.rounds[0]!.matches[0]!.status = 'done';
    runtime().updateTournament(update);
    expect(element('#duel .arena-composition').dataset.outcome).toBe('none');
    expect(element<HTMLImageElement>('#arena-left-art').src).not.toContain('defeated');
    expect(element<HTMLImageElement>('#arena-right-art').src).not.toContain('defeated');
    expect(element('#duel-title').textContent).not.toContain('勝出');
  });

  it('已選場次消失時清除雙方與下注入口，不偷偷換成其他比賽', async () => {
    await mount('/?stage=2d&intro=0&match=missing#duel');
    await publish();
    expect(element('#duel-name-l').textContent).toBe('左方選手');
    expect(element('#duel-name-r').textContent).toBe('右方選手');
    expect(element('#duel-match-label').textContent).toContain('此場次目前無法讀取');
    expect(element('#duel-bet-actions').children).toHaveLength(0);
    expect(element('#duel-score').textContent).toBe('');
  });

  it('示範比武交接同一場次與右側選手到運彩中心，先還原焦點且不直接扣點', async () => {
    await mount('/?mode=manage&preview=1&phase=live&stage=2d&intro=0#schedule');
    node('m2-1').click();
    await vi.advanceTimersByTimeAsync(4000);
    const rightName = element('#duel-name-r').textContent;
    expect(rightName).not.toBe('右方選手');
    click('#duel .duelist[data-side="right"]');
    expect(element('#dz-title').textContent).toContain(rightName);
    const handoff = vi.fn();
    document.addEventListener('lunjian:sports-open', handoff, { once: true });
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const store = vi.spyOn(Storage.prototype, 'setItem');
    click('#dz-actions [data-arena-bet="right"]');
    await vi.advanceTimersByTimeAsync(1);
    expect(element('#psheet').hidden).toBe(true);
    expect(handoff).toHaveBeenCalledTimes(1);
    const detail = (
      handoff.mock.calls[0]![0] as CustomEvent<{
        matchId: string;
        outcome: string;
        snapshot: {
          players: { id: string; name: string }[];
          rounds: { matches: { id: string; p2: string }[] }[];
        };
      }>
    ).detail;
    expect(detail.matchId).toBe('m2-1');
    expect(detail.outcome).toBe('p2');
    const match = detail.snapshot.rounds
      .flatMap((r) => r.matches)
      .find((m) => m.id === detail.matchId)!;
    expect(detail.snapshot.players.find((p) => p.id === match.p2)?.name).toBe(rightName);
    expect(document.activeElement).toBe(element('#duel .duelist[data-side="right"]'));
    expect(fetch).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
    runtime().destroy();
    expect(document.querySelector('#arena-ticket')).toBeNull();
  });
  it('試玩快照同步賽程與比武，停用舊拖曳編輯避免改寫投注對象', async () => {
    await mount('/?preview=1&phase=live&stage=2d&intro=0#schedule');
    const e = buildEvent(initialState(), defaultSnapshot(4), '試玩快照');
    runtime().applySportsbookEvent!(present(e));
    expect(element('#bracket-tools').hidden).toBe(true);
    expect(element('#bracket-host').dataset.editing).toBe('false');
    expect(document.querySelector('.tt-player[draggable="true"]')).toBeNull();
    expect(element('#bracket-host').textContent).toContain('季軍賽');
    node('m1-0').click();
    await vi.advanceTimersByTimeAsync(4000);
    expect(element('#duel-name-l').textContent).toBe('聞人夜');
    expect(element('#duel-name-r').textContent).toBe('白十七');
    const handoff = vi.fn();
    document.addEventListener('lunjian:sports-open', handoff, { once: true });
    click('[data-sports-center]');
    expect((handoff.mock.calls[0]![0] as CustomEvent).detail).toMatchObject({ eventId: e.id });
  });
});

it('本機報名活動不誤判完賽，報名與管理入口帶上同屆識別', async () => {
  await mount('/?preview=1&stage=2d&intro=0#register');
  const s = initialState();
  const id = apply(s, { type: 'activity-create', name: '春日會', capacity: 8 }, 'activity');
  runtime().applySportsbookEvent!(present(s.events[0]!));
  const registrationUrl = new URL(element<HTMLAnchorElement>('[data-activity-cta]').href);
  expect(registrationUrl.searchParams.get('event')).toBe(id);
  expect(registrationUrl.searchParams.get('tab')).toBe('participation');
  expect(element('#local-event-tools').hidden).toBe(false);
  expect(element<HTMLAnchorElement>('#local-event-manage').href).toContain(
    `event=${id}&mode=manage`,
  );
  expect(element('#bracket-host').textContent).not.toContain('聞人夜');
});
it('報名者角色帶入比武詳情，姓名與配置以文字安全呈現', async () => {
  await mount('/?preview=1&stage=2d&intro=0#schedule');
  const e = buildEvent(initialState(), defaultSnapshot(4), '本機');
  e.players[0]!.name = '<img src=x onerror=alert(1)>';
  e.players[0]!.character = {
    style: '劍客',
    weapon: '青鋒',
    equipment: '<script>alert(1)</script>',
    arts: '自填武學',
  };
  runtime().applySportsbookEvent!(present(e));
  await vi.advanceTimersByTimeAsync(1);
  node('m1-0').click();
  await vi.advanceTimersByTimeAsync(4000);
  click('#duel .duelist[data-side="left"]');
  expect(element('#dz-body').textContent).toContain('青鋒');
  expect(element('#dz-body').textContent).toContain('<script>alert(1)</script>');
  expect(element('#dz-body').querySelector('script,img')).toBeNull();
});

// The page itself loads battle-view.js; these run the real module so its shadow-DOM wiring is covered.
describe('賽程戰局（battle view）實際接線', () => {
  beforeEach(async () => {
    const module = (await import(/* @vite-ignore */ labSource('battle-view.js'))) as {
      createBracketTree: unknown;
      createBattleDuel: unknown;
    };
    vi.stubGlobal('testCreateTree', module.createBracketTree);
    vi.stubGlobal('testCreateDuel', module.createBattleDuel);
    // jsdom has no modal dialog methods; the battle view opens its player card with them.
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.open = true;
      this.querySelector('button')?.focus();
    };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.open = false;
    };
  });
  const battleRoot = () => document.querySelector('#bracket-host .battle-art-host')!.shadowRoot!;

  it('掛上戰局並保留完整對戰表；點場次籤進入同場比武', async () => {
    await mount();
    await publish();
    const host = element('#bracket-host');
    expect(host.classList.contains('battle-live')).toBe(true);
    expect(battleRoot().querySelector('.ab-tree')).not.toBeNull();
    expect(host.querySelector('details.battle-results .tt-player')).not.toBeNull();
    // A hostile name renders as text, never as markup.
    expect(battleRoot().querySelector('img[src="x"]')).toBeNull();
    battleRoot().querySelector<HTMLButtonElement>('[data-match-open="match-two"]')!.click();
    await vi.advanceTimersByTimeAsync(4000);
    expect(location.hash).toBe('#duel');
    expect(new URL(location.href).searchParams.get('match')).toBe('match-two');
    expect(element('#duel-name-r').textContent).toBe('遠山');
    // The duel keeps the silhouette arena (user, 2026-11-01): the C–H battle art is not mounted.
    expect(element('#duel').classList.contains('battle-art-ready')).toBe(false);
    expect(document.querySelector('#battle-duel-host .battle-art-host')).toBeNull();
  });

  it('從戰局名牌開啟配置，即時更新重建名牌後關閉，焦點回到同一名牌', async () => {
    await mount();
    await publish();
    const seat = () =>
      battleRoot().querySelector<HTMLButtonElement>('[data-player="p?b"][data-match="match/one"]')!;
    seat().focus();
    seat().click();
    battleRoot().querySelector<HTMLButtonElement>('[data-configuration="p?b"]')!.click();
    expect(element('#psheet').hidden).toBe(false);
    expect(element('#dz-title').textContent).toBe('夜雨');
    const before = seat();
    const updated = formal();
    updated.rounds[0]!.matches[0]!.s1 = 1;
    runtime().updateTournament(updated);
    await vi.advanceTimersByTimeAsync(1);
    expect(before.isConnected).toBe(false);
    click('#dz-actions [data-dz-close]');
    expect(battleRoot().activeElement).toBe(seat());
  });

  it('選手資料開著時遇到即時更新，從同一名牌重新開啟，焦點留在對話框內', async () => {
    await mount();
    await publish();
    battleRoot()
      .querySelector<HTMLButtonElement>('[data-player="p?b"][data-match="match/one"]')!
      .click();
    const before = battleRoot().querySelector<HTMLDialogElement>('#champion-dialog')!;
    expect(before.open).toBe(true);
    const updated = formal();
    updated.rounds[0]!.matches[0]!.s1 = 1;
    runtime().updateTournament(updated);
    await vi.advanceTimersByTimeAsync(1);
    expect(before.isConnected).toBe(false);
    const dialog = battleRoot().querySelector<HTMLDialogElement>('#champion-dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('h3')!.textContent).toBe('夜雨');
    expect(dialog.contains(battleRoot().activeElement)).toBe(true);
  });

  it('管理員切到編輯時，完整對戰表立即展開', async () => {
    await mount('/?mode=manage&preview=1&phase=finished&stage=2d&intro=0#schedule');
    await vi.advanceTimersByTimeAsync(1);
    const table = element<HTMLDetailsElement>('#bracket-host details.battle-results');
    expect(table.open).toBe(false);
    [...document.querySelectorAll<HTMLButtonElement>('#bracket-tools button')]
      .find((b) => b.textContent === '編輯')!
      .click();
    await vi.advanceTimersByTimeAsync(1);
    expect(table.hidden).toBe(false);
    expect(table.open).toBe(true);
  });
});
