import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '@theatron/ui/testing';

import HomePage from '../../app/page';

import { STOPS } from './acts';
import { BP_PER_GAP, HANDICAP_CATEGORIES, HANDICAP_TOTAL, RANKS } from './format';
import { installFrames } from './testHarness';

/**
 * 首頁的驗收條件。取代七章時代的 landing.test.tsx。
 *
 * 驗的全部是**沒有 3D、沒有捲動、沒有動畫**時仍然成立的事 ——
 * 那正是這一頁的設計前提:布景是布景,資訊是 HTML。
 * 在 jsdom 裡沒有 WebGL、沒有捲動位置,所以這裡看到的就是最壞情況下的頁面。
 */
describe('首頁 · 三幕六帖', () => {
  function mount() {
    installFrames();
    return render(<HomePage />);
  }

  it('六個定格點的錨點都在,而且 id 互不重複', () => {
    const { container } = mount();
    const ids = STOPS.map((s) => `stop-${s.id}`);
    for (const id of ids) {
      expect(container.querySelectorAll(`#${id}`)).toHaveLength(1);
    }
  });

  // 沒有 WebGL、沒有捲動的情況下,六張卡的字必須一個都不少 ——
  // 「3D 只負責氣氛」如果只是句口號,這一條就會紅。
  it('不靠捲動也讀得到每一帖要記的那件事', () => {
    mount();
    for (const s of STOPS) {
      if (s.id === 'prologue') continue;
      expect(screen.getAllByText(s.remember).length).toBeGreaterThan(0);
    }
  });

  it('沒有 {{PLACEHOLDER}} 外洩到畫面上', () => {
    const { container } = mount();
    expect(container.textContent).not.toContain('{{');
    // 未定案的欄位要畫成「待公布」,而且標得出來是缺口不是值。
    expect(container.querySelectorAll('[data-placeholder]').length).toBeGreaterThan(0);
  });

  // 使用者要求首頁的卡「真的講 BP 讓武」,不是一句「詳見規則頁」。
  it('賽制卡講得出段位四階與 BP 取得', () => {
    mount();
    for (const r of RANKS) {
      expect(screen.getAllByText(r.name).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText(String(BP_PER_GAP)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(String(BP_PER_GAP * 3)).length).toBeGreaterThan(0);
  });

  it('讓武六大類是表格,每一類都有點數區間', () => {
    mount();
    const table = screen.getByRole('table');
    for (const c of HANDICAP_CATEGORIES) {
      const row = within(table).getByRole('rowheader', { name: c.name }).closest('tr')!;
      expect(row.textContent).toContain(`${c.cost[0]}–${c.cost[1]}`);
    }
  });

  // 三十項的權威位置是 hestia 的 seed,首頁只講總數 —— 抄一份就會有兩個地方要維護。
  it('只講項目總數,不把三十項抄一份到首頁', () => {
    const { container } = mount();
    expect(screen.getAllByText(String(HANDICAP_TOTAL)).length).toBeGreaterThan(0);
    const rows = container.querySelectorAll('table tbody tr');
    expect(rows).toHaveLength(HANDICAP_CATEGORIES.length);
  });

  it('頁尾列得出六帖,順序與帳冊一致', () => {
    mount();
    const nav = screen.getByRole('navigation', { name: '頁尾定格點捷徑' });
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(STOPS.length);
    links.forEach((a, i) => {
      expect(a.getAttribute('href')).toBe(`#stop-${STOPS[i]!.id}`);
    });
  });

  it('沒有無障礙違規', async () => {
    const { container } = mount();
    await expectNoAxeViolations(container);
  });
});
