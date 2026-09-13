import { expectNoAxeViolations } from '@theatron/ui/testing';
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CHAPTERS } from './chapters';
import { CONTENT } from './content';
import {
  installFrames,
  installMatchMedia,
  installObserver,
  type FakeObserver,
} from './testHarness';

/**
 * 首頁是伺服器元件,而入口連結在模組載入時就由環境變數算好(那是部署設定,
 * 不是狀態),所以要先設環境再載入模組;每個測試各自載一次。
 */
async function loadPage(slug: string) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_TOURNAMENT_SLUG', slug);
  const mod = await import('../../app/page');
  return mod.default;
}

describe('首頁 · 七章', () => {
  let made: FakeObserver[];

  beforeEach(() => {
    made = installObserver();
    installMatchMedia(false);
    installFrames();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('七章都在,順序與帳冊一致,而且每一章都由自己的標題命名', async () => {
    const Page = await loadPage('jianzhong-01');
    const { container } = render(<Page />);
    const marks = Array.from(container.querySelectorAll('[data-chapter-section]'), (s) =>
      s.getAttribute('data-chapter-section'),
    );
    expect(marks).toEqual(['01', '02', '03', '04', '05', '06', '07']);

    for (const s of container.querySelectorAll('[data-chapter-section]')) {
      const id = s.getAttribute('aria-labelledby');
      expect(id).not.toBeNull();
      expect(container.querySelector(`#${id!}`)).not.toBeNull();
    }
  });

  it('每一章的錨點就是帳冊寫的那一個,三份目錄連到同一批', async () => {
    const Page = await loadPage('jianzhong-01');
    const { container } = render(<Page />);
    for (const c of CHAPTERS) {
      expect(container.querySelector(`#${c.anchor}`)).not.toBeNull();
    }
    const hrefs = (name: string) =>
      within(screen.getByRole('navigation', { name }))
        .getAllByRole('link')
        .map((a) => a.getAttribute('href'));
    const expected = CHAPTERS.map((c) => `#${c.anchor}`);
    expect(hrefs('章節目錄')).toEqual(expected);
    expect(hrefs('章節捷徑')).toEqual(expected);
    expect(hrefs('頁尾章節捷徑')).toEqual(expected);
  });

  // 比賽事實還沒定案。站上寫「待公布」,不是把大括號印出來,更不是編一個。
  it('沒定案的欄位一律是「待公布」,而且不會漏出 {{PLACEHOLDER}}', async () => {
    const Page = await loadPage('jianzhong-01');
    const { container } = render(<Page />);
    const text = container.textContent ?? '';
    expect(text).not.toContain('PLACEHOLDER');
    expect(text).not.toContain('{{');
    expect(screen.getAllByText('待公布').length).toBeGreaterThan(0);
    // 代號不是待公布 —— 它是這一版視覺真的有的名字。
    expect(text).toContain(CONTENT.workingTitle);
  });

  it('七章的資訊各自有家:賽制、獎賞、時程、報名、落款', async () => {
    const Page = await loadPage('jianzhong-01');
    const { container } = render(<Page />);
    expect(container.querySelector('[data-testid="rule-scroll"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="prize-wall"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="plum-dates"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="seal-button"]')).not.toBeNull();
    for (const head of ['組別', '規則', '評審']) {
      expect(screen.getByRole('heading', { name: head, level: 3 })).toBeInTheDocument();
    }
    for (const label of ['主辦', '合作', '聯繫']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('有賽事代號才有入口', async () => {
    const Page = await loadPage('jianzhong-01');
    render(<Page />);
    const enter = screen.getByRole('navigation', { name: '進入本屆賽事' });
    expect(within(enter).getByRole('link', { name: '進入本屆賽事' })).toHaveAttribute(
      'href',
      '/t/jianzhong-01',
    );
  });

  // 給一個會 404 的按鈕比不給更糟;但也要說清楚為什麼沒有。
  it('沒有賽事代號就說入口關著,不給按鈕', async () => {
    const Page = await loadPage('');
    render(<Page />);
    expect(screen.queryByRole('navigation', { name: '進入本屆賽事' })).not.toBeInTheDocument();
    expect(screen.getByText('本屆還沒開賽,賽事頁尚未開放。')).toBeInTheDocument();
  });

  it('捲到哪一章,近景就換到哪一章', async () => {
    const Page = await loadPage('jianzhong-01');
    const { container } = render(<Page />);
    const stage = container.querySelector('[data-testid="foreground-stage"]')!;
    expect(stage.querySelector('[data-fg-set="01"]')).not.toBeNull();

    const sections = Array.from(container.querySelectorAll<HTMLElement>('[data-chapter-section]'));
    const chapterIo = made.find((o) => o.options?.rootMargin === '-12% 0px -12% 0px')!;
    act(() => {
      chapterIo.emit([{ target: sections[6]!, ratio: 0.8 }]);
    });
    expect(stage.querySelector('[data-fg-set="07"]')).not.toBeNull();
  });

  it('鍵盤走得到每一個控制項', async () => {
    const Page = await loadPage('jianzhong-01');
    const { container } = render(<Page />);
    const focusable = container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    expect(focusable.length).toBeGreaterThan(0);
    for (const el of focusable) {
      // 焦點進得去,而且每一個都有無障礙名稱 —— 一個沒有名字的焦點站是死路。
      el.focus();
      expect(document.activeElement).toBe(el);
      const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
      expect(name).not.toBe('');
    }
  });

  it('沒有無障礙違規', async () => {
    const Page = await loadPage('jianzhong-01');
    const { container } = render(<Page />);
    await expectNoAxeViolations(container);
  });
});

describe('首頁 · 不想看到動的人', () => {
  beforeEach(() => {
    installObserver();
    installMatchMedia(true);
    installFrames();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  // 減少動態不是「動快一點」,是所有東西一開始就在它該在的位置上。
  it('所有會出場的東西一開始就已經出場了', async () => {
    const Page = await loadPage('jianzhong-01');
    const { container } = render(<Page />);
    const reveals = container.querySelectorAll('[data-rv]');
    expect(reveals.length).toBeGreaterThan(0);
    for (const el of reveals) expect(el).toHaveAttribute('data-rv-in');
  });

  it('序幕換成靜態殘旗海報,而且不建畫布', async () => {
    const Page = await loadPage('jianzhong-01');
    const { container } = render(<Page />);
    expect(container.querySelector('[data-testid="static-poster"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="prologue-canvas"]')).toBeNull();
    expect(container.querySelector('[data-testid="world-canvas"]')).toBeNull();
    // 墨暈轉場整層不掛 —— 它沒有承載任何資訊。
    expect(container.querySelector('[data-testid="ink-wipe"]')).toBeNull();
  });

  // 這是這一段最重要的一條:少的是動,不是內容。
  it('七章的比賽資訊一字不少', async () => {
    const Page = await loadPage('jianzhong-01');
    const { container } = render(<Page />);
    const marks = Array.from(container.querySelectorAll('[data-chapter-section]'), (s) =>
      s.getAttribute('data-chapter-section'),
    );
    expect(marks).toEqual(['01', '02', '03', '04', '05', '06', '07']);
    for (const head of ['組別', '規則', '評審']) {
      expect(screen.getByRole('heading', { name: head, level: 3 })).toBeInTheDocument();
    }
    expect(container.querySelector('[data-testid="plum-dates"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="seal-button"]')).not.toBeNull();
    for (const label of ['主辦', '合作', '聯繫']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('沒有無障礙違規', async () => {
    const Page = await loadPage('jianzhong-01');
    const { container } = render(<Page />);
    await expectNoAxeViolations(container);
  });
});

describe('首頁 · 沒有 WebGL', () => {
  beforeEach(() => {
    installObserver();
    installMatchMedia(false);
    installFrames();
    // jsdom 沒有 WebGL,所以這就是真實的「探測失敗」路徑,不必再假造。
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  // 沒有 WebGL 與減少動態走的是同一條路:同一份完整的字,加一張看得懂的畫面。
  it('一樣是完整的七章加靜態海報', async () => {
    const Page = await loadPage('jianzhong-01');
    const { container } = render(<Page />);
    expect(container.querySelector('[data-testid="static-poster"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-chapter-section]').length).toBe(7);
    expect(container.textContent).not.toContain('PLACEHOLDER');
  });
});
