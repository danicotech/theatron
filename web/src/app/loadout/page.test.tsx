import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '@theatron/ui/testing';

import LoadoutPage from './page';
import { LOADOUT_MARKUP } from './loadoutMarkup';

/**
 * 備戰方案的驗收條件。
 *
 * 這一頁的內容幾乎全部是 `loadout.js` 在客戶端畫出來的（流派、倉庫卡片、
 * 雷達、報名文字），jsdom 裡那支不會跑 —— 所以這裡**不驗那些**。
 * 這裡驗的是骨架：三欄在不在、工具列的按鈕在不在、標記有沒有壞掉。
 * 行為由 `scratchpad` 的 selfcheck 用真瀏覽器驗，那一支同時打 lab 與這一頁。
 *
 * 版面與行為的正本是 `scrollcraft/builds/lunjian/lab/loadout.html`，
 * 由 `lab/tools/loadout-to-theatron.py` 生成，見 ../../../../MERGE.md。
 */
describe('備戰方案', () => {
  it('三欄都在', () => {
    const { container } = render(<LoadoutPage />);
    for (const n of [1, 2, 3]) {
      expect(container.querySelectorAll(`.col-${n}`)).toHaveLength(1);
    }
  });

  /* 這四顆是這一頁自己的頁首。它們曾經被 theatron 的 SiteNav 蓋住點不到 ——
     `SiteChrome` 的 OWN_CHROME 名單就是為了這件事，見 MERGE.md 第三輪。 */
  it('自帶的工具列四顆鈕都在', () => {
    render(<LoadoutPage />);
    for (const name of ['規則', '匯入', '匯出 JSON', '複製配置']) {
      expect(screen.getAllByRole('button', { name }).length).toBeGreaterThan(0);
    }
  });

  it('關掉 JS 也看得到各區的標題', () => {
    const { container } = render(<LoadoutPage />);
    const heads = [...container.querySelectorAll('h2')].map((h) => h.textContent || '');
    // 「報名欄位」在 2026-09-20 改名成「準備報名」：那一區的重點從
    // 「這裡有一段文字」變成「把這個角色的報名做完」。
    for (const t of ['心法', '奇術', '裝備', '裝備倉庫', '戰力', '準備報名']) {
      expect(heads.some((h) => h.includes(t))).toBe(true);
    }
  });

  it('沒有樣板變數外洩到畫面上', () => {
    const { container } = render(<LoadoutPage />);
    expect(container.textContent).not.toContain('{{');
    expect(container.textContent).not.toContain('undefined');
  });

  it('標記不是空的', () => {
    expect(LOADOUT_MARKUP.length).toBeGreaterThan(5000);
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(<LoadoutPage />);
    await expectNoAxeViolations(container);
  });
});
