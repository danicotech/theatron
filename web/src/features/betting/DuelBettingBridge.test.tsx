import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DuelBettingBridge } from './DuelBettingBridge';
vi.mock('../../lib/api/activity', () => ({
  activityApi: {
    tournament: {
      getBracket: vi.fn().mockResolvedValue({
        rounds: [{ matches: [{ publicId: 'm1', p1PlayerPublicId: 'a', p2PlayerPublicId: 'b' }] }],
        players: [
          { publicId: 'a', displayName: '甲' },
          { publicId: 'b', displayName: '乙' },
        ],
      }),
    },
  },
}));
vi.mock('./MyBets', () => ({ MyBets: ({ slug }: { slug: string }) => <p>注單來源 {slug}</p> }));
vi.mock('./MarketBoard', () => ({
  MarketBoard: ({ matchPublicId, returnTo }: { matchPublicId: string; returnTo: string }) => (
    <p data-testid="markets" data-return={returnTo}>
      {matchPublicId}
    </p>
  ),
}));
vi.mock('./BetSlip', () => ({
  BetSlip: ({ onMyBets }: { onMyBets: () => void }) => (
    <button onClick={onMyBets}>查看我的注單</button>
  ),
}));
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_TOURNAMENT_SLUG', 'real-event');
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  history.replaceState(null, '', '/#duel');
  document.body.innerHTML =
    '<button data-duel-my-bets>我的注單</button><button data-duel-markets="m1">觀局雅集</button><button data-duel-lobby>開啟觀局</button>';
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  document.body.innerHTML = '';
});
it('opens my bets in-place, closes and restores the arena trigger', async () => {
  render(<DuelBettingBridge />);
  const trigger = screen.getByRole('button', { name: '我的注單' });
  fireEvent.click(trigger);
  expect(await screen.findByRole('dialog')).toBeVisible();
  expect(screen.getByText('注單來源 real-event')).toBeVisible();
  expect(location.hash).toBe('#duel');
  fireEvent.click(screen.getByRole('button', { name: '關閉注單視窗' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
it('requires a published match context and switches to history without navigation', async () => {
  render(<DuelBettingBridge />);
  fireEvent.click(screen.getByRole('button', { name: '觀局雅集' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  await act(() =>
    document.dispatchEvent(
      new CustomEvent('lunjian:duel-context', { detail: { matchId: 'm1', p1: 'a', p2: 'b' } }),
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: '觀局雅集' }));
  expect(await screen.findByTestId('markets')).toHaveTextContent('m1');
  expect(screen.getByTestId('markets')).toHaveAttribute(
    'data-return',
    '/?match=m1&panel=markets#duel',
  );
  fireEvent.click(screen.getByRole('button', { name: '查看我的注單' }));
  expect(screen.getByText('注單來源 real-event')).toBeVisible();
  expect(location.hash).toBe('#duel');
});
it('legacy match deep links wait for the actual selected match', async () => {
  history.replaceState(null, '', '/?match=m1&panel=markets#duel');
  render(<DuelBettingBridge />);
  await act(() =>
    document.dispatchEvent(
      new CustomEvent('lunjian:duel-context', { detail: { matchId: 'other' } }),
    ),
  );
  expect(screen.queryByRole('dialog')).toBeNull();
  await act(() =>
    document.dispatchEvent(new CustomEvent('lunjian:duel-context', { detail: { matchId: 'm1' } })),
  );
  await waitFor(() => expect(screen.getByTestId('markets')).toHaveTextContent('m1'));
});

it('central arena entry opens betting without navigating when schedule is unpublished', async () => {
  render(<DuelBettingBridge />);
  const trigger = screen.getByRole('button', { name: '開啟觀局' });
  fireEvent.click(trigger);
  expect(await screen.findByText('請選擇觀局場次。')).toBeVisible();
  expect(screen.getByRole('combobox', { name: '觀局場次' })).toBeVisible();
  expect(location.hash).toBe('#duel');
  fireEvent.click(screen.getByRole('button', { name: '觀局紀錄' }));
  expect(screen.getByText('注單來源 real-event')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '選場下注' }));
  expect(screen.getByRole('combobox')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '關閉注單視窗' }));
  expect(document.activeElement).toBe(trigger);
});
