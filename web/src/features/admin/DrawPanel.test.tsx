import { create } from '@bufbuild/protobuf';
import { expectNoAxeViolations } from '@theatron/ui/testing';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Rank, RankInfoSchema } from '../../lib/api/gen/hestia/activity/v1/common_pb';

import { DrawPanel } from './DrawPanel';

const api = vi.hoisted(() => ({
  drawBracket: vi.fn(),
  swapSeeds: vi.fn(),
  confirmBracket: vi.fn(),
  listPlayers: vi.fn(),
}));

vi.mock('../../lib/api/activity', () => ({
  activityApi: {
    tournament: { listPlayers: api.listPlayers },
    judge: {
      drawBracket: api.drawBracket,
      swapSeeds: api.swapSeeds,
      confirmBracket: api.confirmBracket,
    },
  },
}));

// 用 create() 而不是物件字面值:protobuf-es 的訊息帶 $typeName,
// 手捏一個「看起來像」的物件會在型別上失敗,而硬轉型只是把失敗延到執行期。
const RANKS = [
  create(RankInfoSchema, { rank: Rank.KAISHAN, name: '開山', title: '初試之境' }),
  create(RankInfoSchema, { rank: Rank.DUANSHUI, name: '斷水', title: '初成之境' }),
  create(RankInfoSchema, { rank: Rank.FEIHUA, name: '飛花', title: '純熟之境' }),
  create(RankInfoSchema, { rank: Rank.WUWO, name: '無我', title: '歷戰之境' }),
];

const SEATED = {
  players: [
    { publicId: 'p2', displayName: 'A冷', gameId: 'a', rank: 4, seedNo: 2 },
    { publicId: 'p1', displayName: '李璃', gameId: 'b', rank: 3, seedNo: 1 },
    { publicId: 'p3', displayName: '無名', gameId: 'c', rank: 1, seedNo: 3 },
  ],
};

describe('DrawPanel', () => {
  beforeEach(() => {
    Object.values(api).forEach((m) => {
      m.mockReset();
    });
    api.listPlayers.mockResolvedValue({ players: [] });
    api.drawBracket.mockResolvedValue({ seed: 1234n, byePlayerPublicIds: ['p3'], rounds: [] });
    api.swapSeeds.mockResolvedValue({});
    api.confirmBracket.mockResolvedValue({});
  });

  it('還沒抽時邀請動作,而不是說沒有資料', async () => {
    render(<DrawPanel slug="s" ranks={RANKS} onConfirmed={vi.fn()} />);
    expect(await screen.findByText(/還沒抽/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '抽籤' })).toBeInTheDocument();
  });

  it('抽完依籤位排序顯示,並標出輪空與種子', async () => {
    render(<DrawPanel slug="s" ranks={RANKS} onConfirmed={vi.fn()} />);
    api.listPlayers.mockResolvedValue(SEATED);
    await userEvent.click(await screen.findByRole('button', { name: '抽籤' }));

    const seats = await screen.findAllByRole('button', { pressed: false });
    const names = seats.map((b) => b.textContent ?? '');
    expect(names[0]).toContain('李璃');
    expect(names[1]).toContain('A冷');
    expect(screen.getByText('1234')).toBeInTheDocument();
    expect(screen.getByText('輪空')).toBeInTheDocument();
  });

  // 交換需要兩個人,所以第一下只是選起來 —— 那一下不該送出任何東西。
  it('點第一位只是選起來,點第二位才交換', async () => {
    render(<DrawPanel slug="s" ranks={RANKS} onConfirmed={vi.fn()} />);
    api.listPlayers.mockResolvedValue(SEATED);
    await userEvent.click(await screen.findByRole('button', { name: '抽籤' }));

    await userEvent.click(await screen.findByRole('button', { name: /李璃/ }));
    expect(api.swapSeeds).not.toHaveBeenCalled();
    expect(screen.getByText('再點一位就交換。')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /A冷/ }));
    expect(api.swapSeeds).toHaveBeenCalledWith({
      playerAPublicId: 'p1',
      playerBPublicId: 'p2',
      note: '裁判於抽籤階段交換籤位',
    });
  });

  // 確認是不可逆的:一按下去對戰表就公布出去,改不回來。
  it('確認要按兩次,而且中間說清楚後果', async () => {
    const onConfirmed = vi.fn();
    render(<DrawPanel slug="s" ranks={RANKS} onConfirmed={onConfirmed} />);
    api.listPlayers.mockResolvedValue(SEATED);
    await userEvent.click(await screen.findByRole('button', { name: '抽籤' }));

    await userEvent.click(await screen.findByRole('button', { name: '確認對戰表' }));
    expect(api.confirmBracket).not.toHaveBeenCalled();
    expect(screen.getByText(/不能再重抽或交換/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '確認這張對戰表' }));
    expect(api.confirmBracket).toHaveBeenCalledWith({ tournamentSlug: 's', confirm: true });
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it('反悔得回去,不會被困在確認畫面', async () => {
    render(<DrawPanel slug="s" ranks={RANKS} onConfirmed={vi.fn()} />);
    api.listPlayers.mockResolvedValue(SEATED);
    await userEvent.click(await screen.findByRole('button', { name: '抽籤' }));
    await userEvent.click(await screen.findByRole('button', { name: '確認對戰表' }));
    await userEvent.click(screen.getByRole('button', { name: '再看看' }));
    expect(screen.getByRole('button', { name: '確認對戰表' })).toBeInTheDocument();
    expect(api.confirmBracket).not.toHaveBeenCalled();
  });

  it('沒有無障礙違規', async () => {
    api.listPlayers.mockResolvedValue(SEATED);
    const { container } = render(<DrawPanel slug="s" ranks={RANKS} onConfirmed={vi.fn()} />);
    await screen.findByText(/李璃/);
    await expectNoAxeViolations(container);
  });
});
