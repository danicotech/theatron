import { create } from '@bufbuild/protobuf';
import { expectNoAxeViolations } from '@theatron/ui/testing';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Rank, RankInfoSchema } from '../../lib/api/gen/hestia/activity/v1/common_pb';

import { RankingPanel } from './RankingPanel';

const api = vi.hoisted(() => ({ listUnranked: vi.fn(), assignRank: vi.fn() }));

vi.mock('../../lib/api/activity', () => ({
  activityApi: { judge: { listUnranked: api.listUnranked, assignRank: api.assignRank } },
}));

// 用 create() 而不是物件字面值:protobuf-es 的訊息帶 $typeName,
// 手捏一個「看起來像」的物件會在型別上失敗,而硬轉型只是把失敗延到執行期。
const RANKS = [
  create(RankInfoSchema, { rank: Rank.KAISHAN, name: '開山', title: '初試之境' }),
  create(RankInfoSchema, { rank: Rank.DUANSHUI, name: '斷水', title: '初成之境' }),
  create(RankInfoSchema, { rank: Rank.FEIHUA, name: '飛花', title: '純熟之境' }),
  create(RankInfoSchema, { rank: Rank.WUWO, name: '無我', title: '歷戰之境' }),
];

function dossier(id: string, name: string) {
  return {
    player: { publicId: id, displayName: name, gameId: `${name}_01`, rank: 0, seedNo: 0 },
    discordName: `${name}_discord`,
    selfRatedRank: 3,
    ladderRank: '玄鐵',
    ladderScore: 1820,
    artsNote: '常用太玄經,擅長遠距消耗',
    availabilityNote: '週末晚間',
    previousRank: 0,
    tournamentsPlayed: 0,
    wins: 0,
    losses: 0,
  };
}

describe('RankingPanel', () => {
  beforeEach(() => {
    api.listUnranked.mockReset();
    api.assignRank.mockReset();
    api.assignRank.mockResolvedValue({});
    api.listUnranked.mockResolvedValue({ players: [dossier('p1', '李璃'), dossier('p2', 'A冷')] });
  });

  it('一次只評一個人,並說還剩幾人', async () => {
    render(<RankingPanel slug="s" ranks={RANKS} onRanked={vi.fn()} />);
    expect(await screen.findByText('李璃')).toBeInTheDocument();
    expect(screen.queryByText('A冷')).not.toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('把判斷需要的東西擺出來:自評、論劍、戰績、自述', async () => {
    render(<RankingPanel slug="s" ranks={RANKS} onRanked={vi.fn()} />);
    await screen.findByText('李璃');
    expect(screen.getByText('李璃_01')).toBeInTheDocument();
    expect(screen.getByText('玄鐵 · 1820')).toBeInTheDocument();
    expect(screen.getByText(/太玄經/)).toBeInTheDocument();
    // 初次參賽要講出來,不是留一個空白讓人猜。
    expect(screen.getByText('初次參賽')).toBeInTheDocument();
  });

  it('沒選段位不能送出,而且按鈕直說要先選', async () => {
    render(<RankingPanel slug="s" ranks={RANKS} onRanked={vi.fn()} />);
    await screen.findByText('李璃');
    expect(screen.getByRole('button', { name: '先選一個段位' })).toBeDisabled();
  });

  it('評完換下一位,並把理由一起送出去', async () => {
    const onRanked = vi.fn();
    render(<RankingPanel slug="s" ranks={RANKS} onRanked={onRanked} />);
    await screen.findByText('李璃');

    await userEvent.click(screen.getByRole('button', { name: /飛花/ }));
    await userEvent.type(screen.getByLabelText('評定理由'), '論劍積分與實戰都到位');
    await userEvent.click(screen.getByRole('button', { name: '評為 飛花' }));

    expect(api.assignRank).toHaveBeenCalledWith({
      playerPublicId: 'p1',
      rank: 3,
      note: '論劍積分與實戰都到位',
    });
    expect(onRanked).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('A冷')).toBeInTheDocument();
  });

  // 評完之後的空狀態要說「接下來做什麼」,而且要提醒那段異議時間的意義。
  it('全部評完時說明接下來是公布與異議', async () => {
    api.listUnranked.mockResolvedValue({ players: [] });
    render(<RankingPanel slug="s" ranks={RANKS} onRanked={vi.fn()} />);
    expect(await screen.findByText('所有選手都評完了。')).toBeInTheDocument();
    expect(screen.getByText(/異議/)).toBeInTheDocument();
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(<RankingPanel slug="s" ranks={RANKS} onRanked={vi.fn()} />);
    await screen.findByText('李璃');
    await expectNoAxeViolations(container);
  });
});
