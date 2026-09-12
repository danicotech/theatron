import { expectNoAxeViolations } from '@theatron/ui/testing';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TournamentPhase } from '../../lib/api/gen/hestia/activity/v1/common_pb';

import { TournamentHome } from './TournamentHome';

const api = vi.hoisted(() => ({ getTournament: vi.fn() }));

vi.mock('../../lib/api/activity', () => ({
  activityApi: { tournament: { getTournament: api.getTournament } },
}));

function t(phase: TournamentPhase) {
  return {
    tournament: {
      slug: 's',
      name: '百業試鋒 2026 春季賽',
      phase,
      bpPerRankGap: 8n,
      playerCount: 12,
    },
  };
}

describe('TournamentHome', () => {
  beforeEach(() => {
    api.getTournament.mockReset();
  });

  // 「現在該做什麼」是這一頁唯一要回答的問題,所以行動隨階段換,
  // 不是六個連結一直擺著讓人自己判斷哪一個有用。
  it('報名期才出現報名入口', async () => {
    api.getTournament.mockResolvedValue(t(TournamentPhase.SIGNUP));
    render(<TournamentHome slug="s" />);
    expect(await screen.findByRole('link', { name: '報名參賽' })).toHaveAttribute(
      'href',
      '/t/s/signup',
    );
  });

  it('報名截止後就沒有報名入口了', async () => {
    api.getTournament.mockResolvedValue(t(TournamentPhase.RANKING));
    render(<TournamentHome slug="s" />);
    await screen.findByRole('heading', { name: '百業試鋒 2026 春季賽' });
    expect(screen.queryByRole('link', { name: '報名參賽' })).not.toBeInTheDocument();
  });

  it('每個階段都說得出現在在等什麼', async () => {
    api.getTournament.mockResolvedValue(t(TournamentPhase.RANKED));
    render(<TournamentHome slug="s" />);
    expect(await screen.findByText(/抽籤之後就不能改/)).toBeInTheDocument();
  });

  it('規則頁的入口任何階段都在 —— 選讓武時要查得到', async () => {
    api.getTournament.mockResolvedValue(t(TournamentPhase.IN_PROGRESS));
    render(<TournamentHome slug="s" />);
    expect(await screen.findByRole('link', { name: '規則與讓武項目' })).toHaveAttribute(
      'href',
      '/t/s/rules',
    );
  });

  it('沒有無障礙違規', async () => {
    api.getTournament.mockResolvedValue(t(TournamentPhase.SIGNUP));
    const { container } = render(<TournamentHome slug="s" />);
    await screen.findByRole('heading', { name: '百業試鋒 2026 春季賽' });
    await expectNoAxeViolations(container);
  });
});
