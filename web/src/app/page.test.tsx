import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '@theatron/ui/testing';

import HomePage from './page';
import { LUNJIAN_MARKUP } from './lunjianMarkup';

/**
 * 首頁的驗收條件。
 *
 * 取代了 `features/landing/theatre.test.tsx` —— 那一份驗的是三幕劇場版的首頁，
 * 而首頁在 2026-09-17 那一輪換成了從 lab 生成的《論劍》版面（見 ../MERGE.md）。
 * 它找的 `#stop-*` 錨點在新版面裡一個都沒有，所以那七條從換版那天起就一直紅著。
 * 舊版面的元件都還在 `features/landing/` 底下，備份在 `_page.theatre.tsx.bak`，
 * 要對照隨時看得到；只是首頁不再是那一份，驗收條件也就不該還照那一份寫。
 *
 * 驗的仍然是同一件事：**沒有 3D、沒有捲動、沒有動畫時，資訊仍然讀得到**。
 * jsdom 裡沒有 WebGL 也沒有捲動位置，所以這裡看到的就是最壞情況下的頁面 ——
 * 標記是伺服器端就算好的語意化 HTML，動的只是上面那層布景。
 */
describe('首頁 · 論劍', () => {
  // 七格的錨點。順序就是捲下去的順序，導覽列與進度軌都照它走。
  const STOPS = ['prologue', 'rules', 'invitation', 'register', 'duel', 'schedule', 'rewards'];

  it('七格的錨點都在，而且 id 互不重複', () => {
    const { container } = render(<HomePage />);
    for (const id of STOPS) {
      expect(container.querySelectorAll(`section#${id}`)).toHaveLength(1);
    }
    expect([...container.querySelectorAll('section.chapter')].map((el) => el.id)).toEqual(STOPS);
  });

  it('關掉 JS 也讀得到每一格的標題', () => {
    const { container } = render(<HomePage />);
    // h1 是站名，七格各自有自己的 h2。標題沒了就等於這一頁只剩布景。
    expect(container.querySelector('h1')?.textContent).toContain('百業試鋒');
    expect(container.querySelectorAll('h2').length).toBeGreaterThanOrEqual(6);
  });

  it('導覽列列得出七格，連結都指向真的錨點', () => {
    render(<HomePage />);
    const nav = screen.getByRole('navigation', { name: '主要導覽' });
    const hrefs = within(nav)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
      .filter((h): h is string => !!h && h.startsWith('#'));
    expect(hrefs.map((h) => h.slice(1))).toEqual(STOPS);
  });

  it('沒有樣板變數外洩到畫面上', () => {
    const { container } = render(<HomePage />);
    expect(container.textContent).not.toContain('{{');
    expect(container.textContent).not.toContain('undefined');
  });

  /* 生成物的防呆。標記是 lab 生成的字串常數，只要有人手改 `lunjianMarkup.ts`
     而不是改 lab 再重跑腳本，兩邊就分岔了 —— 這一條攔不住手改，
     但至少攔得住「腳本沒跑成功、常數變空的」那種。 */
  it('標記不是空的', () => {
    expect(LUNJIAN_MARKUP.length).toBeGreaterThan(5000);
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(<HomePage />);
    await expectNoAxeViolations(container);
  });
});
