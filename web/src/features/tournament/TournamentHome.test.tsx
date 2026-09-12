import { expectNoAxeViolations } from '@theatron/ui/testing';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TournamentPhase } from '../../lib/api/gen/hestia/activity/v1/common_pb';

import { TournamentHome } from './TournamentHome';

const api = vi.hoisted(() => ({ getTournament: vi.fn(), getMyPlayer: vi.fn() }));

vi.mock('../../lib/api/activity', () => ({
  activityApi: {
    tournament: { getTournament: api.getTournament },
    signup: { getMyPlayer: api.getMyPlayer },
  },
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
    api.getMyPlayer.mockReset();
    // 預設當作沒進站 —— 這一頁是公開的,GetMyPlayer 失敗不是錯誤。
    api.getMyPlayer.mockRejectedValue(new Error('unauthenticated'));
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

  // 進站與沒進站在畫面上長得一樣,是使用者實際回報的問題。
  it('沒進站時給的是進站入口', async () => {
    api.getTournament.mockResolvedValue(t(TournamentPhase.SIGNUP));
    render(<TournamentHome slug="s" />);
    expect(await screen.findByRole('link', { name: '我已報名,進站' })).toHaveAttribute(
      'href',
      '/t/s/login',
    );
  });

  it('進站後看得到自己是誰,連到我的報名', async () => {
    api.getTournament.mockResolvedValue(t(TournamentPhase.SIGNUP));
    api.getMyPlayer.mockResolvedValue({ player: { displayName: '李璃' } });
    render(<TournamentHome slug="s" />);
    expect(await screen.findByRole('link', { name: '我的報名(李璃)' })).toHaveAttribute(
      'href',
      '/t/s/me',
    );
    expect(screen.queryByRole('link', { name: '我已報名,進站' })).not.toBeInTheDocument();
  });

  it('沒有無障礙違規', async () => {
    api.getTournament.mockResolvedValue(t(TournamentPhase.SIGNUP));
    const { container } = render(<TournamentHome slug="s" />);
    await screen.findByRole('heading', { name: '百業試鋒 2026 春季賽' });
    await expectNoAxeViolations(container);
  });
});
