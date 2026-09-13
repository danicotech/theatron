import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { expectNoAxeViolations } from '@theatron/ui/testing';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BetSchema,
  BetStatus,
  MarketKind,
  MarketOddsSchema,
  MarketStatus,
  MatchOddsSchema,
} from '../../lib/api/gen/hestia/activity/v1/betting_pb';

import { BetSlip } from './BetSlip';
import { addLeg, readSlip, setStake, type SlipLeg } from './betSlipStore';

const api = vi.hoisted(() => ({
  placeBet: vi.fn(),
  getOdds: vi.fn(),
  getProfile: vi.fn(),
}));

vi.mock('../../lib/api/activity', () => ({
  activityApi: { betting: { placeBet: api.placeBet, getOdds: api.getOdds } },
}));
vi.mock('../../lib/api/client', () => ({
  platformApi: { me: { getProfile: api.getProfile } },
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/t/s/match/m1',
}));

const LEG_A: SlipLeg = {
  matchPublicId: 'm1',
  marketPublicId: 'mk-1',
  outcome: 'p1',
  label: '李璃',
  oddsMilli: 1430n,
  marketTitle: '整場勝負',
};

const LEG_B: SlipLeg = {
  matchPublicId: 'm2',
  marketPublicId: 'mk-2',
  outcome: 'over',
  label: '超過 90 秒',
  oddsMilli: 2860n,
  marketTitle: '第 1 回合時長',
};

const PLACED = {
  bet: create(BetSchema, {
    publicId: '01J0BET000000000000000000A',
    stake: 100n,
    potentialPayout: 408n,
    status: BetStatus.OPEN,
    legs: [
      {
        matchPublicId: 'm1',
        matchLabel: '首輪 · 李璃 vs A冷',
        marketPublicId: 'mk-1',
        kind: MarketKind.MATCH_WINNER,
        outcome: 'p1',
        outcomeLabel: '李璃',
        oddsMilli: 1430n,
      },
    ],
  }),
  replayed: false,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function seed() {
  addLeg('s', LEG_A);
  addLeg('s', LEG_B);
  setStake('s', '100');
}

async function confirm() {
  await userEvent.click(screen.getByRole('button', { name: '送出注單' }));
  await userEvent.click(screen.getByRole('button', { name: '確認下注 100' }));
}

describe('BetSlip', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.values(api).forEach((m) => {
      m.mockReset();
    });
    api.placeBet.mockResolvedValue(PLACED);
  });

  it('收合的 bar 說幾關、總賠率、可拿多少;點了才展開', async () => {
    seed();
    render(<BetSlip slug="s" />);
    const bar = screen.getByRole('button', { name: '2 關 · 4.08× · 可拿 408' });
    expect(bar).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(bar);
    expect(bar).toHaveAttribute('aria-expanded', 'true');
  });

  it('空的投注單是邀請,不是道歉', () => {
    render(<BetSlip slug="s" />);
    expect(screen.getByText(/從賠率表挑一個結果加進來/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '送出注單' })).toBeDisabled();
  });

  it('每一腿都能移除,總額跟著變', async () => {
    seed();
    render(<BetSlip slug="s" />);
    await userEvent.click(screen.getByRole('button', { name: '移除 超過 90 秒' }));
    expect(screen.getByRole('button', { name: '1 關 · 1.43× · 可拿 143' })).toBeInTheDocument();
    expect(readSlip('s').legs).toHaveLength(1);
  });

  // 「送出注單」只是攤開總結;動錢的是「確認下注」。冪等鍵與預期賠付都要跟著走。
  it('送出先攤開總結,確認才下注,並帶冪等鍵與預期賠付', async () => {
    seed();
    render(<BetSlip slug="s" />);

    await userEvent.click(screen.getByRole('button', { name: '送出注單' }));
    expect(api.placeBet).not.toHaveBeenCalled();
    expect(screen.getByText(/送出後不能取消/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '確認下注 100' }));
    expect(api.placeBet).toHaveBeenCalledTimes(1);
    expect(api.placeBet).toHaveBeenCalledWith({
      tournamentSlug: 's',
      stake: 100n,
      legs: [
        { marketPublicId: 'mk-1', outcome: 'p1' },
        { marketPublicId: 'mk-2', outcome: 'over' },
      ],
      idempotencyKey: expect.stringMatching(UUID) as string,
      expectedPayout: 408n,
    });

    // 成功:票根出現、投注單清空。
    expect(await screen.findByText('注單已成立。')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '注單 01J0BET000000000000000000A' }),
    ).toBeInTheDocument();
    expect(readSlip('s').legs).toHaveLength(0);
    expect(localStorage.getItem('bet-slip:s')).toBeNull();
  });

  it('反悔得回去改,不會困在確認畫面', async () => {
    seed();
    render(<BetSlip slug="s" />);
    await userEvent.click(screen.getByRole('button', { name: '送出注單' }));
    await userEvent.click(screen.getByRole('button', { name: '回去改' }));
    expect(screen.getByRole('button', { name: '送出注單' })).toBeInTheDocument();
    expect(api.placeBet).not.toHaveBeenCalled();
  });

  // 同一把冪等鍵配不同內容會被伺服器拒絕;內容一變就不是同一張單,退回去重看。
  it('確認中投注單被改了,就退回第一步', async () => {
    seed();
    render(<BetSlip slug="s" />);
    await userEvent.click(screen.getByRole('button', { name: '送出注單' }));
    expect(screen.getByRole('button', { name: '確認下注 100' })).toBeInTheDocument();

    addLeg('s', { ...LEG_A, outcome: 'p2', label: 'A冷', oddsMilli: 2860n });
    expect(await screen.findByRole('button', { name: '送出注單' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /確認下注/ })).not.toBeInTheDocument();
  });

  // bet_odds_moved:不靜默重送。重抓賠率、換一把鍵、讓人看著新數字再按一次。
  it('賠率變了:重抓賠率、換冪等鍵、要人再確認一次', async () => {
    seed();
    api.placeBet
      .mockRejectedValueOnce(
        new ConnectError(
          '賠率已變動',
          Code.Aborted,
          new Headers({ 'hestia-error-reason': 'bet_odds_moved' }),
        ),
      )
      .mockResolvedValueOnce(PLACED);
    api.getOdds.mockResolvedValue({
      odds: [
        create(MatchOddsSchema, {
          matchPublicId: 'm1',
          markets: [
            create(MarketOddsSchema, {
              marketPublicId: 'mk-1',
              matchPublicId: 'm1',
              kind: MarketKind.MATCH_WINNER,
              status: MarketStatus.OPEN,
              openForBets: true,
              outcomes: [
                { outcome: 'p1', label: '李璃', votes: 20, oddsMilli: 1520n },
                { outcome: 'p2', label: 'A冷', votes: 5, oddsMilli: 2600n },
              ],
            }),
          ],
        }),
      ],
    });
    render(<BetSlip slug="s" />);

    await confirm();
    expect(await screen.findByText('賠率變了,重新確認。')).toBeInTheDocument();
    expect(api.getOdds).toHaveBeenCalledWith({ matchPublicIds: ['m1', 'm2'] });
    // 100 × (1520 × 2860 / 1000 = 4347) / 1000 = 434
    expect(screen.getByRole('button', { name: '2 關 · 4.34× · 可拿 434' })).toBeInTheDocument();
    expect(readSlip('s').legs[0]?.oddsMilli).toBe(1520n);

    await userEvent.click(screen.getByRole('button', { name: '確認下注 100' }));
    expect(api.placeBet).toHaveBeenCalledTimes(2);
    const first = api.placeBet.mock.calls[0]?.[0] as { idempotencyKey: string };
    const second = api.placeBet.mock.calls[1]?.[0] as {
      idempotencyKey: string;
      expectedPayout: bigint;
    };
    expect(second.expectedPayout).toBe(434n);
    expect(second.idempotencyKey).toMatch(UUID);
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
    expect(await screen.findByText('注單已成立。')).toBeInTheDocument();
  });

  it('沒登入:給一條回到這一頁的登入路,投注單留著', async () => {
    seed();
    api.placeBet.mockRejectedValue(new ConnectError('no', Code.Unauthenticated));
    render(<BetSlip slug="s" />);
    await confirm();
    const link = await screen.findByRole('link', { name: '登入' });
    expect(link).toHaveAttribute('href', '/login?redirect=%2Ft%2Fs%2Fmatch%2Fm1');
    expect(readSlip('s').legs).toHaveLength(2);
  });

  it('其他錯誤依 reason 說清楚下一步', async () => {
    seed();
    api.placeBet.mockRejectedValue(
      new ConnectError(
        '超過上限',
        Code.FailedPrecondition,
        new Headers({ 'hestia-error-reason': 'bet_stake_too_large' }),
      ),
    );
    render(<BetSlip slug="s" />);
    await confirm();
    expect(await screen.findByRole('alert')).toHaveTextContent('超過單筆下注上限,降低本金再送。');
    expect(screen.getByRole('button', { name: '送出注單' })).toBeInTheDocument();
  });

  it('投注單活過重新整理', () => {
    seed();
    const first = render(<BetSlip slug="s" />);
    first.unmount();
    render(<BetSlip slug="s" />);
    expect(screen.getByRole('button', { name: '2 關 · 4.08× · 可拿 408' })).toBeInTheDocument();
    expect(screen.getByLabelText('本金')).toHaveValue('100');
  });

  it('沒有無障礙違規', async () => {
    seed();
    const { container } = render(<BetSlip slug="s" />);
    await userEvent.click(screen.getByRole('button', { name: /2 關/ }));
    await expectNoAxeViolations(container);
  });
});
