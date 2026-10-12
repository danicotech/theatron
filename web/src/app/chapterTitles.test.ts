import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LUNJIAN_MARKUP } from './lunjianMarkup';

type Controller = {
  enter: (section: string | Element) => boolean;
  setStatic: (value: boolean) => void;
  clear: () => void;
  destroy: () => void;
};
type CreateTitles = (options?: {
  root?: Document | HTMLElement;
  staticMode?: boolean;
}) => Controller;
type Glyph = { s: string[]; m: number[][][] };
type StrokeSVG = (word: string, options?: Record<string, unknown>) => string | null;

const glyphs = JSON.parse(readFileSync('web/public/lunjian/glyphs.json', 'utf8')) as Record<
  string,
  Glyph
>;
const brushSource = readFileSync('web/public/lunjian/brush.js', 'utf8');
const inkSource = readFileSync('web/public/lunjian/ink-title.js', 'utf8');
const titleSource = readFileSync('web/public/lunjian/chapter-titles.js', 'utf8');
const createChapterTitles = runInThisContext(
  '(function(){' + titleSource.replace(/export /g, '') + ';return createChapterTitles;})()',
) as CreateTitles;
const chapters = [
  ['prologue', '宗旨', 14],
  ['rules', '規則說明', 42],
  ['invitation', '讓武', 32],
  ['register', '報名', 18],
  ['duel', '比武', 12],
  ['schedule', '賽程', 29],
  ['rewards', '獎賞', 30],
] as const;
const heading = (id: string) => document.querySelector<HTMLElement>(`#${id} [data-chapter-title]`)!;
const nibs = (host: HTMLElement) => [...host.querySelectorAll<SVGElement>('.ink-nib')];
const controllers: Controller[] = [];
let reduced = false;
let motionChanges: Set<() => void>;

function mount(staticMode = false) {
  const controller = createChapterTitles({ root: document, staticMode });
  controllers.push(controller);
  return controller;
}
function finish(nib: SVGElement, animationName = 'ink-draw') {
  const event = new Event('animationend', { bubbles: true });
  Object.defineProperty(event, 'animationName', { value: animationName });
  nib.dispatchEvent(event);
}
function expectReadable(host: HTMLElement, text: string) {
  expect(host.textContent).toBe(text);
  expect(host.querySelector('.ink-svg')).toBeNull();
  expect(host.closest('[hidden],[inert]')).toBeNull();
  expect(host.style.opacity).not.toBe('0');
  expect(host.style.visibility).not.toBe('hidden');
}

beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  motionChanges = new Set();
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return reduced;
    },
    addEventListener: (_name: string, listener: () => void) => motionChanges.add(listener),
    removeEventListener: (_name: string, listener: () => void) => motionChanges.delete(listener),
  }));
  // Execute the shipped brush and glyph engines, not a fixture SVG or a mocked renderer.
  const strokeSVG = runInThisContext(
    '(function(){' +
      brushSource +
      '\n' +
      inkSource +
      '\nINK.glyphs=' +
      JSON.stringify(glyphs) +
      ';return strokeSVG;})()',
  ) as StrokeSVG;
  vi.stubGlobal('strokeSVG', strokeSVG);
  document.body.innerHTML = LUNJIAN_MARKUP;
});

afterEach(() => {
  controllers.splice(0).forEach((controller) => controller.destroy());
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('七章真實毛筆筆順與閱讀保護', () => {
  it('整頁一個主標題，章節名稱是 H2，標語不搶標題層級', () => {
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    for (const id of ['prologue', 'rules', 'invitation']) {
      expect(document.querySelector(`#${id}-title`)?.tagName).toBe('H2');
      expect(document.querySelector(`#${id} .chapter-tagline`)).toBeNull();
    }
    expect(document.querySelector('.schedule-edition')).toBeNull();
    expect(document.querySelector('.schedule-heading > p')).toBeNull();
  });
  it('報名在 2.6 秒內逐筆寫完，其他章節保持原有速度', () => {
    const controller = mount();
    controller.enter('register');
    const last = nibs(heading('register')).at(-1)!;
    const end =
      parseFloat(last.style.getPropertyValue('--at')) +
      parseFloat(last.style.getPropertyValue('--dur'));
    expect(end).toBeLessThan(2600);
    expect(end).toBeGreaterThan(1500);
    controller.enter('rules');
    const rulesLast = nibs(heading('rules')).at(-1)!;
    expect(parseFloat(rulesLast.style.getPropertyValue('--at'))).toBeGreaterThan(3000);
  });
  it.each(chapters)('%s 的「%s」以 %i 個獨立筆畫依序書寫', (id, text, expectedCount) => {
    const controller = mount();
    const host = heading(id);
    expect(host.dataset.chapterTitle).toBe(text);
    expect(controller.enter(id)).toBe(true);
    const svg = host.querySelector<SVGElement>('.ink-svg')!;
    expect(svg.getAttribute('aria-label')).toBe(text);
    expect(svg.classList.contains('writing')).toBe(true);
    expect(host.dataset.titleState).toBe('writing');
    const strokes = nibs(host);
    expect(strokes).toHaveLength(expectedCount);
    const ids = strokes.map((nib) => nib.parentElement!.id);
    expect(new Set(ids).size).toBe(expectedCount);
    let previousEnd = -1;
    for (const nib of strokes) {
      const mask = nib.parentElement!;
      expect(mask.tagName.toLowerCase()).toBe('mask');
      const outline = svg.querySelector(`.ink-body path[mask="url(#${mask.id})"]`)!;
      expect(outline.getAttribute('d')).toMatch(/^M.+Z$/);
      expect(outline.getAttribute('d')!.length).toBeGreaterThan(100);
      expect(nib.getAttribute('d')).toMatch(/^M.+ L/);
      const start = parseFloat(nib.style.getPropertyValue('--at'));
      const duration = parseFloat(nib.style.getPropertyValue('--dur'));
      expect(start).toBeGreaterThan(previousEnd);
      expect(duration).toBeGreaterThan(0);
      previousEnd = start + duration;
    }
    finish(strokes[0]!);
    expect(host.dataset.titleState).toBe('writing');
    finish(strokes.at(-1)!, 'unrelated-animation');
    expect(host.dataset.titleState).toBe('writing');
    finish(strokes.at(-1)!);
    expect(host.dataset.titleState).toBe('complete');
  });

  it('同一章重入不更換筆畫或重播，切章與 clear 立即還原可讀章名', () => {
    const controller = mount();
    controller.enter('rules');
    const host = heading('rules');
    const svg = host.querySelector('.ink-svg');
    const last = nibs(host).at(-1)!;
    expect(controller.enter(document.querySelector('#rules')!)).toBe(true);
    expect(host.querySelector('.ink-svg')).toBe(svg);
    finish(last);
    controller.enter('#rules');
    expect(host.dataset.titleState).toBe('complete');
    expect(host.querySelector('.ink-svg')).toBe(svg);
    controller.enter('duel');
    expectReadable(host, '規則說明');
    finish(last);
    expect(host.dataset.titleState).toBe('plain');
    controller.clear();
    expectReadable(heading('duel'), '比武');
  });

  it.each(['reading', 'reduced-motion'])('%s 初始模式直接顯示完整七章名稱', (mode) => {
    reduced = mode === 'reduced-motion';
    const controller = mount(mode === 'reading');
    for (const [id, text] of chapters) {
      expect(controller.enter(id)).toBe(false);
      expectReadable(heading(id), text);
    }
  });

  it('書寫中切換閱讀或 reduced-motion，會清除未完成筆畫且不再隱藏章名', () => {
    const controller = mount();
    controller.enter('rules');
    const last = nibs(heading('rules')).at(-1)!;
    controller.setStatic(true);
    finish(last);
    for (const [id, text] of chapters) expectReadable(heading(id), text);
    expect(controller.enter('rules')).toBe(false);
    controller.setStatic(false);
    expect(controller.enter('rules')).toBe(true);
    reduced = true;
    motionChanges.forEach((listener) => listener());
    for (const [id, text] of chapters) expectReadable(heading(id), text);
    expect(controller.enter('rewards')).toBe(false);
  });

  it('卸載還原原始章名，舊完成事件、延遲及 controller 呼叫不再寫 DOM', async () => {
    const readTitles = () =>
      chapters.map(([id]) => {
        const host = heading(id);
        return {
          html: host.innerHTML,
          aspectRatio: host.style.aspectRatio,
          state: host.getAttribute('data-title-state'),
          chars: host.style.getPropertyValue('--title-chars'),
        };
      });
    const originals = readTitles();
    const controller = mount();
    controller.enter('rewards');
    const last = nibs(heading('rewards')).at(-1)!;
    controller.destroy();
    expect(readTitles()).toEqual(originals);
    expect(motionChanges.size).toBe(0);
    const restored = document.body.innerHTML;
    finish(last);
    expect(controller.enter('rules')).toBe(false);
    controller.setStatic(true);
    controller.clear();
    await vi.advanceTimersByTimeAsync(10000);
    expect(document.body.innerHTML).toBe(restored);
    const remounted = mount();
    expect(remounted.enter('duel')).toBe(true);
    expect(nibs(heading('duel'))).toHaveLength(12);
  });
});
