import { expectNoAxeViolations } from '@theatron/ui/testing';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { CreatedTournament } from './CreateTournamentForm';

import { JudgeEntry } from './JudgeEntry';

const CREATED: CreatedTournament = { slug: 'demo', name: '百業試鋒', handicapItemCount: 12 };

// 表單本身是 CreateTournamentForm 自己測的東西;這裡要的只是「建立成功之後的那張紙」,
// 所以用一顆按鈕把那個狀態叫出來,不重跑一次建立流程。
vi.mock('./CreateTournamentForm', () => ({
  CreateTournamentForm: ({ onCreated }: { onCreated: (t: CreatedTournament) => void }) => (
    <button
      type="button"
      onClick={() => {
        onCreated(CREATED);
      }}
    >
      建立
    </button>
  ),
}));

describe('JudgeEntry', () => {
  // 建立成功後不自動跳轉,所以那條「進裁判台」是唯一往下走的路 ——
  // 它換成共用的 InkLink 之後仍然要是一條聚焦得到的連結。
  it('建立完成後給一條進裁判台的路,而且聚焦得到', async () => {
    render(<JudgeEntry />);
    await userEvent.click(screen.getByRole('button', { name: '建立' }));

    const link = screen.getByRole('link', { name: '進入這一屆的裁判台' });
    expect(link).toHaveAttribute('href', '/judge/demo');
    link.focus();
    expect(link).toHaveFocus();
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(<JudgeEntry />);
    await userEvent.click(screen.getByRole('button', { name: '建立' }));
    await screen.findByRole('link', { name: '進入這一屆的裁判台' });
    await expectNoAxeViolations(container);
  });
});
