import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { expectNoAxeViolations } from '@theatron/ui/testing';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MarketKind,
  MarketOddsSchema,
  MarketStatus,
  MatchOddsSchema,
} from '../../lib/api/gen/hestia/activity/v1/betting_pb';

import { readSlip } from './betSlipStore';
import { MarketBoard } from './MarketBoard';

const api = vi.hoisted(() => ({
  getOdds: vi.fn(),
  vote: vi.fn(),
  getProfile: vi.fn(),
}));

vi.mock('../../lib/api/activity', () => ({
  activityApi: { betting: { getOdds: api.getOdds, vote: api.vote } },
}));
vi.mock('../../lib/api/client', () => ({
  platformApi: { me: { getProfile: api.getProfile } },
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/t/s/match/m1',
}));

// 用 create() 而不是物件字面值:protobuf-es 的訊息帶 $typeName,
// 手捏一個「看起來像」的物件會在型別上失敗,而硬轉型只是把失敗延到執行期。
const WINNER = create(MarketOddsSchema, {
  marketPublicId: 'mk-w',
  matchPublicId: 'm1',
  kind: MarketKind.MATCH_WINNER,
  status: MarketStatus.OPEN,
  openForBets: true,
  outcomes: [
    { outcome: 'p1', label: '李璃', votes: 12, oddsMilli: 1430n },
    { outcome: 'p2', label: 'A冷', votes: 5, oddsMilli: 2860n },
  ],
});

const ROUND1 = create(MarketOddsSchema, {
  marketPublicId: 'mk-r1',
  matchPublicId: 'm1',
  kind: MarketKind.ROUND_WINNER,
  roundNo: 1,
  status: MarketStatus.OPEN,
  openForBets: true,
  outcomes: [
    { outcome: 'p1', label: '李璃', votes: 3, oddsMilli: 1800n },
    { outcome: 'p2', label: 'A冷', votes: 3, oddsMilli: 1800n },
  ],
});

const ROUND2 = create(MarketOddsSchema, {
  ...ROUND1,
  marketPublicId: 'mk-r2',
  roundNo: 2,
});

const DURATION1_CLOSED = create(MarketOddsSchema, {
  marketPublicId: 'mk-d1',
  matchPublicId: 'm1',
  kind: MarketKind.DURATION,
  roundNo: 1,
  lineSeconds: 90n,
  status: MarketStatus.CLOSED,
  openForBets: false,
  myVote: 'over',
  outcomes: [
    { outcome: 'over', label: '超過 90 秒', votes: 8, oddsMilli: 1900n },
    { outcome: 'under', label: '90 秒內', votes: 2, oddsMilli: 1900n },
  ],
});

// 刻意亂序:排序是元件的事。
const ODDS = {
  odds: [
    create(MatchOddsSchema, {
      matchPublicId: 'm1',
      markets: [ROUND2, DURATION1_CLOSED, WINNER, ROUND1],
    }),
  ],
};

describe('MarketBoard', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.values(api).forEach((m) => {
      m.mockReset();
    });
    api.getOdds.mockResolvedValue(ODDS);
    api.getProfile.mockResolvedValue({});
  });

  it('賠率從 1430 顯示成 1.43,票數在旁邊', async () => {
    render(<MarketBoard slug="s" matchPublicId="m1" />);
    const winner = await screen.findByRole('region', { name: '整場勝負' });
    expect(within(winner).getByText('1.43')).toBeInTheDocument();
    expect(within(winner).getByText('2.86')).toBeInTheDocument();
    expect(within(winner).getByText('12')).toBeInTheDocument();
    expect(api.getOdds).toHaveBeenCalledWith({ matchPublicIds: ['m1'] });
  });

  it('整場與比分在前,逐回合的盤口依回合排', async () => {
    render(<MarketBoard slug="s" matchPublicId="m1" />);
    await screen.findByRole('region', { name: '整場勝負' });
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(['整場勝負', '第 1 回合勝負', '第 2 回合勝負', '第 1 回合時長']);
  });

  // 投完票的回應是那一刻的真相;就算重讀還沒回來,畫面也要先跟上。
  it('投票後用回應更新那一個盤口,然後重讀', async () => {
    api.getOdds.mockResolvedValueOnce(ODDS).mockReturnValue(new Promise(() => undefined));
    api.vote.mockResolvedValue({
      odds: create(MarketOddsSchema, {
        marketPublicId: 'mk-w',
        matchPublicId: 'm1',
        kind: MarketKind.MATCH_WINNER,
        status: MarketStatus.OPEN,
        openForBets: true,
        myVote: 'p1',
        outcomes: [
          { outcome: 'p1', label: '李璃', votes: 13, oddsMilli: 1380n },
          { outcome: 'p2', label: 'A冷', votes: 5, oddsMilli: 2990n },
        ],
      }),
    });
    render(<MarketBoard slug="s" matchPublicId="m1" />);

    await userEvent.click(await screen.findByRole('button', { name: '投 整場勝負 李璃' }));
    expect(api.vote).toHaveBeenCalledWith({ marketPublicId: 'mk-w', outcome: 'p1' });

    const winner = screen.getByRole('region', { name: '整場勝負' });
    expect(await within(winner).findByText('1.38')).toBeInTheDocument();
    expect(within(winner).getByText('13')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '投 整場勝負 李璃' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // 別的盤口不受影響。
    expect(
      within(screen.getByRole('region', { name: '第 1 回合勝負' })).getAllByText('1.80'),
    ).toHaveLength(2);
    expect(api.getOdds).toHaveBeenCalledTimes(2);
  });

  it('沒登入時,投票鍵是一條回到這一頁的登入路', async () => {
    api.getProfile.mockRejectedValue(new ConnectError('no', Code.Unauthenticated));
    render(<MarketBoard slug="s" matchPublicId="m1" />);
    const links = await screen.findAllByRole('link', { name: '登入後投票' });
    expect(links[0]).toHaveAttribute('href', '/login?redirect=%2Ft%2Fs%2Fmatch%2Fm1');
    expect(screen.queryByRole('button', { name: /^投 / })).not.toBeInTheDocument();
  });

  // 一場只能一腿(伺服器規則)。第二個結果要「換掉」,而且按鈕得把這件事說出來。
  it('同一場再挑一個結果是換腿,按鈕直說「換成這個」', async () => {
    render(<MarketBoard slug="s" matchPublicId="m1" />);
    await userEvent.click(await screen.findByRole('button', { name: '加入投注單 整場勝負 李璃' }));
    expect(readSlip('s').legs.map((l) => l.outcome)).toEqual(['p1']);

    expect(screen.getByRole('button', { name: '從投注單移除 整場勝負 李璃' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // 同場的每一個其他結果 —— 包括別的盤口 —— 都是「換」,不是「加」。
    expect(screen.getByRole('button', { name: '換成這個 整場勝負 A冷' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '換成這個 第 2 回合勝負 李璃' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^加入投注單/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '換成這個 第 2 回合勝負 李璃' }));
    const legs = readSlip('s').legs;
    expect(legs).toHaveLength(1);
    expect(legs[0]?.marketPublicId).toBe('mk-r2');
    expect(legs[0]?.marketTitle).toBe('第 2 回合勝負');
    expect(legs[0]?.oddsMilli).toBe(1800n);
  });

  it('封盤的盤口照樣列出,但沒有任何按鈕,只有狀態字', async () => {
    render(<MarketBoard slug="s" matchPublicId="m1" />);
    const closed = await screen.findByRole('region', { name: '第 1 回合時長' });
    expect(within(closed).getByText('已封盤')).toBeInTheDocument();
    expect(within(closed).getByText('超過 90 秒')).toBeInTheDocument();
    expect(within(closed).queryByRole('button')).not.toBeInTheDocument();
    expect(within(closed).getByText('我投了這個')).toBeInTheDocument();
  });

  it('首頁選手帶到整場勝負的相同一側，只聚焦一次且不自動投票或下注', async () => {
    const view = render(<MarketBoard slug="s" matchPublicId="m1" selectedOutcome="p2" />);
    const row = await screen.findByRole('listitem', { name: '整場勝負 A冷，首頁所選選手' });
    expect(row).toHaveFocus();
    expect(screen.getAllByText('首頁所選')).toHaveLength(1);
    expect(api.vote).not.toHaveBeenCalled();
    expect(readSlip('s').legs).toEqual([]);
    const chosen = within(row).getByRole('button', { name: '加入投注單 整場勝負 A冷' });
    chosen.focus();
    view.rerender(<MarketBoard slug="s" matchPublicId="m1" selectedOutcome="p2" />);
    expect(chosen).toHaveFocus();
    await userEvent.click(chosen);
    expect(readSlip('s').legs).toMatchObject([{ outcome: 'p2', marketPublicId: 'mk-w' }]);
    expect(api.vote).not.toHaveBeenCalled();
  });

  it('已封盤的首頁所選結果可以讀取，但不重新開放按鈕', async () => {
    api.getOdds.mockResolvedValue({
      odds: [
        create(MatchOddsSchema, {
          matchPublicId: 'm1',
          markets: [
            create(MarketOddsSchema, {
              ...WINNER,
              status: MarketStatus.CLOSED,
              openForBets: false,
            }),
          ],
        }),
      ],
    });
    render(<MarketBoard slug="s" matchPublicId="m1" selectedOutcome="p1" />);
    const row = await screen.findByRole('listitem', { name: '整場勝負 李璃，首頁所選選手' });
    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
    expect(api.vote).not.toHaveBeenCalled();
    expect(readSlip('s').legs).toEqual([]);
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(<MarketBoard slug="s" matchPublicId="m1" />);
    await screen.findByRole('region', { name: '整場勝負' });
    await expectNoAxeViolations(container);
  });
});
