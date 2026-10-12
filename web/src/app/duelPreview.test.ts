import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LUNJIAN_MARKUP } from './lunjianMarkup';
import { activityDisplay } from '../features/landing/activityDisplay';
import { TournamentPhase } from '../lib/api/gen/hestia/activity/v1/common_pb';

const source = readFileSync('web/public/lunjian/lunjian.js', 'utf8');
const stylesheet = readFileSync('web/public/lunjian/lunjian.css', 'utf8');
const element = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const click = (selector: string) => element(selector).click();
const score = () => element('#duel-score').textContent?.replace(/\s/g, '');
const artwork = () =>
  ['#arena-left-art', '#arena-right-art'].map((selector) =>
    element<HTMLImageElement>(selector).getAttribute('src'),
  );
const ctas = () =>
  [...document.querySelectorAll('[data-activity-cta]')].map((link) => ({
    href: link.getAttribute('href'),
    text: link.textContent,
  }));
function mount() {
  document.body.innerHTML = LUNJIAN_MARKUP;
  runInThisContext(source);
}
function expectUnpublishedScoreHidden() {
  expect(element('#duel').hasAttribute('data-empty')).toBe(true);
  expect(score()).toBe('');
  // The generated stylesheet owns this visibility rule; do not inject a test-only style.
  expect(stylesheet).toMatch(/\.duel\[data-empty\]\s+#duel-score[^{}]*\{[^}]*display:\s*none/);
  expect(stylesheet).toMatch(/\.duel\[data-empty\]\s+#duel-index[^{}]*\{[^}]*display:\s*none/);
  expect(stylesheet).toMatch(/\.duel\[data-empty\]\s+\.duel-foot[^{}]*\{[^}]*display:\s*none/);
  expect(stylesheet).not.toMatch(
    /\.duel\[data-empty\]\s+\.(?:duel-stage|duelist)[^{}]*\{[^}]*display:\s*none/,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  history.replaceState(null, '', '/?mode=manage&stage=2d&intro=0#duel');
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal('innerWidth', 960);
  vi.stubGlobal('scrollTo', vi.fn());
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('anime', Object.assign(vi.fn(), { remove: vi.fn(), stagger: vi.fn() }));
  vi.stubGlobal('mountInk', vi.fn());
  vi.stubGlobal('playInk', vi.fn());
  vi.stubGlobal('inkVS', () => document.createElement('span'));
  vi.stubGlobal('INK', { load: () => Promise.resolve() });
});

afterEach(() => {
  window.__LUNJIAN?.destroy();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('對決演出預覽與正式賽事隔離', () => {
  it('未公布時保留相向雙俠和單一 VS，但不展示虛構比分或選手', () => {
    mount();
    expect(document.querySelectorAll('#duel .arena-fighter.duelist')).toHaveLength(2);
    expect(document.querySelector('#duel .folio')).toBeNull();
    expect(
      element('#duel .arena-composition').closest('.folio-scene,.comic-board,.ink-frame'),
    ).toBeNull();
    expect(document.querySelectorAll('#duel-vs-slot')).toHaveLength(1);
    expect(element('#duel .duel-vs').parentElement).toBe(element('#duel .arena-composition'));
    expect(element('#duel-vs-slot').closest('.duel-stage')).toBeNull();
    expect(element('#duel-score').closest('.arena-verdict')).toBeNull();
    expect(document.querySelector('#duel-summary')).toBeNull();
    expect(element('#duel-vs-slot').hidden).toBe(false);
    expectUnpublishedScoreHidden();
    expect(element('#duel-preview-note').hidden).toBe(true);
    expect(element('[data-duel-reset]').hidden).toBe(true);
    expect(element('#duel').textContent).not.toContain('聞人夜');
    expect(element('#duel-odds').textContent).toBe('');
    expect(element('#arena-result').hidden).toBe(true);
    expect(element('#duel-outcomes').hidden).toBe(true);
    expect(element('#duel .arena-composition').dataset.outcome).toBe('none');
  });

  it('賽前、進行中與結束呈現各自比分，整段預覽持續標示示範資料', async () => {
    mount();
    const note = element('#duel-preview-note');
    const examples = [
      ['before', '0:0'],
      ['live', '1:1'],
      ['after', '2:1'],
    ] as const;
    for (const [phase, expected] of examples) {
      click(`[data-duel-preview="${phase}"]`);
      expect(score()).toBe(expected);
      expect(element('#duel').hasAttribute('data-empty')).toBe(false);
      expect(element('#duel-preview-note')).toBe(note);
      expect(note.hidden).toBe(false);
      expect(note.textContent).toContain('示範資料');
      expect(document.querySelectorAll('[data-duel-preview][aria-pressed="true"]')).toHaveLength(1);
      expect(element(`[data-duel-preview="${phase}"]`).getAttribute('aria-pressed')).toBe('true');
      expect(element('[data-duel-reset]').hidden).toBe(false);
      expect(element('#duel-outcomes').hidden).toBe(phase !== 'after');
      if (phase !== 'after') {
        expect(artwork()).toEqual([
          expect.stringContaining('/lunjian/art/player-attacker-right.webp'),
          expect.stringContaining('/lunjian/art/player-defender-left.webp'),
        ]);
        expect(element('#duel .arena-composition').dataset.outcome).toBe('none');
      }
      await vi.advanceTimersByTimeAsync(5000);
      expect(note.hidden).toBe(false);
      expect(score()).toBe(expected);
    }
    expect(artwork()).toEqual([
      expect.stringContaining('/lunjian/art/duel-victor.webp'),
      expect.stringContaining('/lunjian/art/duel-defeated.webp'),
    ]);
    expect(element('#arena-result').hidden).toBe(false);
    expect(element('#duel-vs-slot').hidden).toBe(true);
    expect(element('#duel .arena-composition').getAttribute('aria-label')).toContain('險勝');
  });

  it.each([
    ['dominant', '2:0', 'duel-dominant.webp', 'duel-crushed.webp', 'left', '輾壓'],
    ['crushed', '0:2', 'duel-crushed.webp', 'duel-dominant.webp', 'right', '慘輸'],
    ['narrow', '2:1', 'duel-victor.webp', 'duel-defeated.webp', 'left', '險勝'],
    ['draw', '1:1', 'duel-draw-left.webp', 'duel-draw-right.webp', 'draw', '平手'],
  ] as const)(
    '%s 結果套用對應比分、雙方姿態及中央結果，仍明確屬於示範',
    (outcome, expected, left, right, side, label) => {
      mount();
      click('[data-duel-preview="after"]');
      expect(element('#duel-outcomes').hidden).toBe(false);
      click(`[data-duel-outcome="${outcome}"]`);
      expect(score()).toBe(expected);
      expect(artwork()).toEqual([
        expect.stringContaining('/lunjian/art/' + left),
        expect.stringContaining('/lunjian/art/' + right),
      ]);
      expect(element('#duel .arena-composition').dataset.outcome).toBe(side);
      expect(element('#arena-result').textContent?.trim()).toBe(label);
      expect(element('#arena-result').hidden).toBe(false);
      expect(element('#duel-vs-slot').hidden).toBe(true);
      expect(element('[data-duel-preview="after"]').getAttribute('aria-pressed')).toBe('true');
      expect(document.querySelectorAll('[data-duel-outcome][aria-pressed="true"]')).toHaveLength(1);
      expect(element(`[data-duel-outcome="${outcome}"]`).getAttribute('aria-pressed')).toBe('true');
      const note = element('#duel-preview-note');
      expect(note.hidden).toBe(false);
      expect(note.textContent).toContain('示範');
      if (outcome === 'draw')
        expect(note.textContent).toContain('平手僅示範姿態，並非正式 BO3 賽果');
      else expect(note.textContent).not.toContain('平手僅示範姿態');
      click('[data-duel-preview="before"]');
      expect(element('#duel-outcomes').hidden).toBe(true);
      click(`[data-duel-outcome="${outcome}"]`);
      expect(element('[data-duel-preview="after"]').getAttribute('aria-pressed')).toBe('true');
      expect(element('#duel-outcomes').hidden).toBe(false);
      expect(score()).toBe(expected);
    },
  );

  it('結束姿態切回賽前或比賽中時恢復原雙影與 VS，清除平手提示', () => {
    mount();
    const originalArt = artwork();
    for (const phase of ['before', 'live']) {
      click('[data-duel-preview="after"]');
      click('[data-duel-outcome="draw"]');
      expect(artwork()).not.toEqual(originalArt);
      click(`[data-duel-preview="${phase}"]`);
      expect(artwork()).toEqual(originalArt);
      expect(element('#duel .arena-composition').dataset.outcome).toBe('none');
      expect(element('#duel-vs-slot').hidden).toBe(false);
      expect(element('#arena-result').hidden).toBe(true);
      expect(element('#duel-outcomes').hidden).toBe(true);
      expect(element('#duel-preview-note').textContent).not.toContain('平手僅示範姿態');
    }
  });

  it('返回賽事資訊恢復原圖、未公布狀態與焦點，比分區重新隱藏', () => {
    mount();
    const originalArt = artwork();
    click('[data-duel-preview="after"]');
    click('[data-duel-outcome="draw"]');
    expect(artwork()).not.toEqual(originalArt);
    click('[data-duel-reset]');
    expect(artwork()).toEqual(originalArt);
    expectUnpublishedScoreHidden();
    expect(element('#duel-preview-note').hidden).toBe(true);
    expect(element('[data-duel-reset]').hidden).toBe(true);
    expect(document.querySelector('#duel-summary')).toBeNull();
    expect(element('#arena-result').hidden).toBe(true);
    expect(element('#duel-vs-slot').hidden).toBe(false);
    expect(document.querySelectorAll('[data-duel-preview][aria-pressed="true"]')).toHaveLength(0);
    expect(document.activeElement).toBe(element('[data-duel-preview="before"]'));
    expect(element('#duel-outcomes').hidden).toBe(true);
    expect(element('#duel .arena-composition').dataset.outcome).toBe('none');
    const selected = [
      ...document.querySelectorAll<HTMLElement>('[data-duel-outcome][aria-pressed="true"]'),
    ];
    expect(selected.length).toBeLessThanOrEqual(1);
    expect(selected.every((button) => button.dataset.duelOutcome === 'narrow')).toBe(true);
    click('[data-duel-preview="after"]');
    expect(score()).toBe('2:1');
    expect(element('#arena-result').textContent?.trim()).toBe('險勝');
  });

  it.each([TournamentPhase.SIGNUP, TournamentPhase.IN_PROGRESS])(
    '演出切換不改活動 CTA、正式階段或瀏覽器資料（phase %i）',
    (phase) => {
      mount();
      window.__LUNJIAN!.updateActivity(activityDisplay('real-event', phase));
      const originalCtas = ctas();
      const originalPhase = document.body.dataset.phase;
      const phaseTrack = element('#phase-track').innerHTML;
      const activityStatus = [...document.querySelectorAll('[data-activity-status]')].map(
        (node) => node.textContent,
      );
      localStorage.setItem('user-preserved-fixture', 'unchanged');
      const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
      const storageRemove = vi.spyOn(Storage.prototype, 'removeItem');
      const storageClear = vi.spyOn(Storage.prototype, 'clear');
      for (const state of ['before', 'live', 'after']) {
        click(`[data-duel-preview="${state}"]`);
        expect(ctas()).toEqual(originalCtas);
        expect(document.body.dataset.phase).toBe(originalPhase);
        expect(element('#phase-track').innerHTML).toBe(phaseTrack);
        expect(
          [...document.querySelectorAll('[data-activity-status]')].map((node) => node.textContent),
        ).toEqual(activityStatus);
      }
      for (const outcome of ['dominant', 'crushed', 'narrow', 'draw']) {
        click(`[data-duel-outcome="${outcome}"]`);
        expect(ctas()).toEqual(originalCtas);
        expect(document.body.dataset.phase).toBe(originalPhase);
        expect(element('#phase-track').innerHTML).toBe(phaseTrack);
        expect(
          [...document.querySelectorAll('[data-activity-status]')].map((node) => node.textContent),
        ).toEqual(activityStatus);
      }
      click('[data-duel-reset]');
      expect(ctas()).toEqual(originalCtas);
      expect(document.body.dataset.phase).toBe(originalPhase);
      expect(storageWrite).not.toHaveBeenCalled();
      expect(storageRemove).not.toHaveBeenCalled();
      expect(storageClear).not.toHaveBeenCalled();
      expect(localStorage.getItem('user-preserved-fixture')).toBe('unchanged');
    },
  );

  it('卸載後預覽與還原按鈕不再修改畫面', () => {
    mount();
    click('[data-duel-preview="after"]');
    const art = artwork();
    const title = element('#duel-title').textContent;
    window.__LUNJIAN!.destroy();
    for (const outcome of ['dominant', 'crushed', 'draw'])
      click(`[data-duel-outcome="${outcome}"]`);
    click('[data-duel-preview="before"]');
    click('[data-duel-reset]');
    expect(score()).toBe('2:1');
    expect(artwork()).toEqual(art);
    expect(element('#duel-title').textContent).toBe(title);
    expect(element('#duel-preview-note').hidden).toBe(false);
    expect(window.__LUNJIAN).toBeUndefined();
  });
});
