import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Page from './page';

vi.mock('../../../../../features/bracket/MatchPage', () => ({
  MatchPage: ({
    slug,
    matchId,
    selectedPlayerId,
  }: {
    slug: string;
    matchId: string;
    selectedPlayerId: string;
  }) => (
    <div data-testid="match" data-slug={slug} data-match={matchId} data-player={selectedPlayerId} />
  ),
}));
vi.mock('../../../../../features/betting', () => ({ BetSlip: () => <div data-testid="slip" /> }));

describe('比賽下注交接路由', () => {
  it('等待 Next searchParams 後只傳選手 ID，保留既有投注單', async () => {
    render(
      await Page({
        params: Promise.resolve({ slug: 'event', matchId: 'match-1' }),
        searchParams: Promise.resolve({ player: 'player-2' }),
      }),
    );
    expect(screen.getByTestId('match')).toHaveAttribute('data-player', 'player-2');
    expect(screen.getByTestId('match')).toHaveAttribute('data-match', 'match-1');
    expect(screen.getByTestId('slip')).toBeInTheDocument();
  });
  it('重複 player 參數不擅自挑選一人', async () => {
    render(
      await Page({
        params: Promise.resolve({ slug: 'event', matchId: 'match-1' }),
        searchParams: Promise.resolve({ player: ['p1', 'p2'] }),
      }),
    );
    expect(screen.getByTestId('match')).toHaveAttribute('data-player', '');
  });
});
