import { expectNoAxeViolations } from '@theatron/ui/testing';
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('首頁', () => {
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

  it('使用者自己寫的三句話一字不動', async () => {
    const Page = await loadPage('shifeng-01');
    const { container } = render(<Page />);
    const text = container.textContent ?? '';
    expect(text).toContain('段位定其差,BP 量其讓;鋒芒雖受束,勝負仍由場上分曉。');
    expect(text).toContain('BP 不保證弱者獲勝,只賦予後進要求強者以更困難方式取勝的權利。');
    expect(text).toContain('讓武不是放水。');
  });

  it('五章都在,而且每一章都認得自己是第幾章', async () => {
    const Page = await loadPage('shifeng-01');
    const { container } = render(<Page />);
    const marks = Array.from(container.querySelectorAll('[data-chapter-section]'), (s) =>
      s.getAttribute('data-chapter-section'),
    );
    expect(marks).toEqual(['00', '01', '02', '03', '04']);
    // 每一章都由自己的標題命名 —— 螢幕閱讀器的地標清單才有內容。
    for (const s of container.querySelectorAll('[data-chapter-section]')) {
      const id = s.getAttribute('aria-labelledby');
      expect(id).not.toBeNull();
      expect(container.querySelector(`#${id!}`)).not.toBeNull();
    }
  });

  it('六步是一個序列,順序本身就是規則', async () => {
    const Page = await loadPage('shifeng-01');
    render(<Page />);
    const steps = screen.getAllByRole('heading', { level: 3 });
    expect(steps.map((h) => h.textContent)).toEqual([
      '報名',
      '評段',
      '段位公布',
      '抽籤',
      '選讓武',
      '開打',
    ]);
  });

  it('四段的徽記看得出高低,不是四種顏色', async () => {
    const Page = await loadPage('shifeng-01');
    render(<Page />);
    expect(screen.getByLabelText('段位 開山 初試之境')).toBeInTheDocument();
    expect(screen.getByLabelText('段位 無我 歷戰之境')).toBeInTheDocument();
  });

  it('有賽事代號才有入口', async () => {
    const Page = await loadPage('shifeng-01');
    render(<Page />);
    const enter = screen.getByRole('navigation', { name: '進入本屆賽事' });
    expect(within(enter).getByRole('link', { name: '進入本屆賽事' })).toHaveAttribute(
      'href',
      '/t/shifeng-01',
    );
    expect(within(enter).getByRole('link', { name: '看對戰表' })).toHaveAttribute(
      'href',
      '/t/shifeng-01/bracket',
    );
    expect(within(enter).getByRole('link', { name: '規則與讓武項目' })).toHaveAttribute(
      'href',
      '/t/shifeng-01/rules',
    );
  });

  // 給一個會 404 的按鈕比不給更糟;但也要說清楚為什麼沒有。
  it('沒有賽事代號就說入口關著,不給按鈕', async () => {
    const Page = await loadPage('');
    render(<Page />);
    expect(screen.queryByRole('navigation', { name: '進入本屆賽事' })).not.toBeInTheDocument();
    expect(screen.getByText('本屆還沒開賽,入口關著。')).toBeInTheDocument();
  });

  it('章節目錄與右緣軌道連到同一批錨點', async () => {
    const Page = await loadPage('shifeng-01');
    const { container } = render(<Page />);
    const toc = screen.getByRole('navigation', { name: '章節目錄' });
    const rail = screen.getByRole('navigation', { name: '章節捷徑' });
    const hrefs = (nav: HTMLElement) =>
      within(nav)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href'));
    expect(hrefs(toc)).toEqual(hrefs(rail));
    for (const href of hrefs(toc)) {
      expect(container.querySelector(`#${href!.slice(1)}`)).not.toBeNull();
    }
  });

  it('捲到哪一章,場景與近景就換到哪一章', async () => {
    const Page = await loadPage('shifeng-01');
    const { container } = render(<Page />);
    const stage = container.querySelector('[data-testid="foreground-stage"]')!;
    expect(stage.querySelector('[data-fg-set="00"]')).not.toBeNull();

    const sections = Array.from(container.querySelectorAll<HTMLElement>('[data-chapter-section]'));
    const chapterIo = made.find((o) => o.options?.rootMargin === '-12% 0px -12% 0px')!;
    act(() => {
      chapterIo.emit([{ target: sections[2]!, ratio: 0.8 }]);
    });

    expect(stage.querySelector('[data-fg-set="02"]')).not.toBeNull();
    // 雪場那張板子這時才掛進來,而序章那張還在 —— 交叉淡出要兩張同時在場。
    const plates = Array.from(container.querySelectorAll('[class*="art"]'), (img) =>
      img.getAttribute('src'),
    );
    expect(plates).toContain('/world/bg-snow-arena.webp');
    expect(plates).toContain('/world/bg-night-crow-courtyard.webp');
  });

  it('沒有無障礙違規', async () => {
    const Page = await loadPage('shifeng-01');
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
    const Page = await loadPage('shifeng-01');
    const { container } = render(<Page />);
    const reveals = container.querySelectorAll('[data-rv]');
    expect(reveals.length).toBeGreaterThan(0);
    for (const el of reveals) expect(el).toHaveAttribute('data-rv-in');
  });

  it('近景直接站在定位上,沒有東西在退場', async () => {
    const Page = await loadPage('shifeng-01');
    const { container } = render(<Page />);
    const stage = container.querySelector('[data-testid="foreground-stage"]')!;
    expect(stage.querySelectorAll('[data-fg-set]').length).toBe(1);
    expect(stage.innerHTML).not.toContain('retiring');
  });
});
