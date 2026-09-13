import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { expectNoAxeViolations } from '@theatron/ui/testing';
import { act, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BetSchema,
  BetStatus,
  LegResult,
  MarketKind,
} from '../../lib/api/gen/hestia/activity/v1/betting_pb';

import { notifyBetPlaced } from './betSlipStore';
import { MyBets } from './MyBets';

const api = vi.hoisted(() => ({
  listMyBets: vi.fn(),
  getProfile: vi.fn(),
}));

vi.mock('../../lib/api/activity', () => ({
  activityApi: { betting: { listMyBets: api.listMyBets } },
}));
vi.mock('../../lib/api/client', () => ({
  platformApi: { me: { getProfile: api.getProfile } },
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/t/s/bets',
}));

const WON = create(BetSchema, {
  publicId: '01J0BET000000000000000000A',
  stake: 100n,
  potentialPayout: 152n,
  status: BetStatus.WON,
  payoutRecalculated: true,
  createdAt: timestampFromDate(new Date('2026-09-13T13:04:00Z')),
  settledAt: timestampFromDate(new Date('2026-09-14T02:30:00Z')),
  legs: [
    {
      matchPublicId: 'm1',
      matchLabel: '首輪 · 李璃 vs A冷',
      marketPublicId: 'mk-1',
      kind: MarketKind.MATCH_WINNER,
      outcome: 'p1',
      outcomeLabel: '李璃',
      oddsMilli: 1520n,
      result: LegResult.WON,
    },
    {
      matchPublicId: 'm2',
      matchLabel: '首輪 · 無名 vs 御風',
      marketPublicId: 'mk-2',
      kind: MarketKind.DURATION,
      roundNo: 2,
      outcome: 'over',
      outcomeLabel: '超過 90 秒',
      oddsMilli: 2860n,
      result: LegResult.VOID,
    },
  ],
});

const OPEN = create(BetSchema, {
  publicId: '01J0BET000000000000000000B',
  stake: 50n,
  potentialPayout: 71n,
  status: BetStatus.OPEN,
  createdAt: timestampFromDate(new Date('2026-09-13T13:10:00Z')),
  legs: [
    {
      matchPublicId: 'm3',
      matchLabel: '八強 · 李璃 vs 無名',
      marketPublicId: 'mk-3',
      kind: MarketKind.SCORE,
      outcome: 'p1_2_0',
      outcomeLabel: '2:0',
      oddsMilli: 1430n,
      result: LegResult.PENDING,
    },
  ],
});

describe('MyBets', () => {
  beforeEach(() => {
    Object.values(api).forEach((m) => {
      m.mockReset();
    });
    api.listMyBets.mockResolvedValue({ bets: [WON, OPEN] });
  });

  it('每張票根列出各腿、鎖定賠率、結果與狀態', async () => {
    render(<MyBets slug="s" />);
    const won = await screen.findByRole('region', { name: '注單 01J0BET000000000000000000A' });
    expect(api.listMyBets).toHaveBeenCalledWith({ tournamentSlug: 's' });

    expect(within(won).getByText('中獎')).toBeInTheDocument();
    expect(within(won).getByText('首輪 · 李璃 vs A冷')).toBeInTheDocument();
    expect(within(won).getByText('整場勝負')).toBeInTheDocument();
    expect(within(won).getByText('李璃')).toBeInTheDocument();
    expect(within(won).getByText('1.52')).toBeInTheDocument();
    expect(within(won).getByText('中')).toBeInTheDocument();
    expect(within(won).getByText('第 2 回合時長')).toBeInTheDocument();
    expect(within(won).getByText('超過 90 秒')).toBeInTheDocument();
    expect(within(won).getByText('不成立')).toBeInTheDocument();
    expect(within(won).getByText(/派彩已按其餘各腿的鎖定賠率重算/)).toBeInTheDocument();
    expect(within(won).getByText(/結算/)).toBeInTheDocument();
    expect(within(won).getByLabelText('派彩 152')).toBeInTheDocument();

    const open = screen.getByRole('region', { name: '注單 01J0BET000000000000000000B' });
    expect(within(open).getByText('未結')).toBeInTheDocument();
    expect(within(open).getByText('2:0')).toBeInTheDocument();
    expect(within(open).getByLabelText('可拿 71')).toBeInTheDocument();
    // 待定的腿不出字:整張票已經說了「未結」。
    expect(within(open).queryByText('待定')).not.toBeInTheDocument();
    expect(within(open).queryByText(/結算/)).not.toBeInTheDocument();
  });

  it('沒登入:給一條回到這一頁的登入路', async () => {
    api.listMyBets.mockRejectedValue(new ConnectError('no', Code.Unauthenticated));
    render(<MyBets slug="s" />);
    const link = await screen.findByRole('link', { name: '登入' });
    expect(link).toHaveAttribute('href', '/login?redirect=%2Ft%2Fs%2Fbets');
  });

  it('沒有注單是邀請動作,不是說沒有資料', async () => {
    api.listMyBets.mockResolvedValue({ bets: [] });
    render(<MyBets slug="s" />);
    expect(await screen.findByText(/還沒有注單/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '對戰表' })).toHaveAttribute('href', '/t/s/bracket');
  });

  it('同一頁下注成功就立刻補讀一次', async () => {
    render(<MyBets slug="s" />);
    await screen.findByRole('region', { name: '注單 01J0BET000000000000000000A' });
    expect(api.listMyBets).toHaveBeenCalledTimes(1);
    await act(async () => {
      notifyBetPlaced();
      await Promise.resolve();
    });
    expect(api.listMyBets).toHaveBeenCalledTimes(2);
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(<MyBets slug="s" />);
    await screen.findByRole('region', { name: '注單 01J0BET000000000000000000A' });
    await expectNoAxeViolations(container);
  });
});
