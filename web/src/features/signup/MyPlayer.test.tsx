import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { expectNoAxeViolations } from '@theatron/ui/testing';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PlayerStatus,
  Rank,
  RankInfoSchema,
  TournamentPhase,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';

import { MyPlayer } from './MyPlayer';

const api = vi.hoisted(() => ({
  getMyPlayer: vi.fn(),
  listRanks: vi.fn(),
  updateRegistration: vi.fn(),
}));

vi.mock('../../lib/api/activity', () => ({
  activityApi: {
    signup: { getMyPlayer: api.getMyPlayer, updateRegistration: api.updateRegistration },
    tournament: { listRanks: api.listRanks },
  },
}));

const RANKS = [
  create(RankInfoSchema, { rank: Rank.KAISHAN, name: '開山', title: '初試之境' }),
  create(RankInfoSchema, { rank: Rank.FEIHUA, name: '飛花', title: '純熟之境' }),
];

function ok(over: Record<string, unknown> = {}, phase = TournamentPhase.SIGNUP) {
  return {
    registration: {
      displayName: '李璃',
      discordName: 'liLi_discord',
      selfRatedRank: Rank.FEIHUA,
      ladderRank: '玄鐵',
      ladderScore: 1820,
      artsNote: '常用太玄經',
      availabilityNote: '',
    },
    player: {
      displayName: '李璃',
      gameId: 'liLi',
      rank: Rank.UNSPECIFIED,
      status: PlayerStatus.ACTIVE,
      seedNo: 0,
      ...over,
    },
    tournament: { slug: 's', name: '百業試鋒 2026', phase },
  };
}

describe('MyPlayer', () => {
  beforeEach(() => {
    api.getMyPlayer.mockReset();
    api.listRanks.mockReset();
    api.updateRegistration.mockReset();
    api.updateRegistration.mockResolvedValue({});
    api.listRanks.mockResolvedValue({ ranks: RANKS, bpPerRankGap: 8n });
  });

  // 使用者實際回報的問題:進站成功與沒進站在畫面上長得一樣。
  it('說得出我是誰', async () => {
    api.getMyPlayer.mockResolvedValue(ok());
    render(<MyPlayer slug="s" />);
    expect(await screen.findByRole('heading', { name: '李璃' })).toBeInTheDocument();
    expect(screen.getByText('liLi')).toBeInTheDocument();
    expect(screen.getByText('參賽中')).toBeInTheDocument();
  });

  it('還沒評段時段位是未評定,不是空白', async () => {
    api.getMyPlayer.mockResolvedValue(ok());
    render(<MyPlayer slug="s" />);
    expect(await screen.findByRole('img', { name: '未評定段位' })).toBeInTheDocument();
  });

  it('評完段位就顯示段位', async () => {
    api.getMyPlayer.mockResolvedValue(ok({ rank: Rank.FEIHUA }));
    render(<MyPlayer slug="s" />);
    expect(await screen.findByRole('img', { name: /飛花/ })).toBeInTheDocument();
  });

  it('沒抽籤就不顯示籤位欄位', async () => {
    api.getMyPlayer.mockResolvedValue(ok());
    render(<MyPlayer slug="s" />);
    await screen.findByRole('heading', { name: '李璃' });
    expect(screen.queryByText('籤位')).not.toBeInTheDocument();
  });

  // 沒進站不是錯誤畫面,是還沒做那一步 —— 給路,不要道歉。
  it('沒進站時給進站與報名兩條路', async () => {
    api.getMyPlayer.mockRejectedValue(new ConnectError('未認證', Code.Unauthenticated));
    render(<MyPlayer slug="s" />);
    expect(await screen.findByRole('link', { name: '用遊戲ID 進站' })).toHaveAttribute(
      'href',
      '/t/s/login',
    );
    expect(screen.getByRole('link', { name: '還沒報名' })).toHaveAttribute('href', '/t/s/signup');
  });

  it('每個狀態都說得出現在在等什麼', async () => {
    api.getMyPlayer.mockResolvedValue(ok({ status: PlayerStatus.WITHDRAWN }));
    render(<MyPlayer slug="s" />);
    expect(await screen.findByText(/已經棄賽/)).toBeInTheDocument();
  });

  it('看得到自己填了什麼,沒填的欄位寫「未填」而不是空白', async () => {
    api.getMyPlayer.mockResolvedValue(ok());
    render(<MyPlayer slug="s" />);
    expect(await screen.findByText('liLi_discord')).toBeInTheDocument();
    expect(screen.getByText('玄鐵 · 1820')).toBeInTheDocument();
    expect(screen.getByText('常用太玄經')).toBeInTheDocument();
    expect(screen.getByText('未填')).toBeInTheDocument();
  });

  it('報名期可以改,送出的是整份資料', async () => {
    api.getMyPlayer.mockResolvedValue(ok());
    render(<MyPlayer slug="s" />);
    await userEvent.click(await screen.findByRole('button', { name: '修改' }));

    const discord = screen.getByLabelText('Discord 名稱');
    await userEvent.clear(discord);
    await userEvent.type(discord, '新名字');
    await userEvent.click(screen.getByRole('button', { name: '儲存' }));

    expect(api.updateRegistration).toHaveBeenCalledTimes(1);
    const sent = api.updateRegistration.mock.calls[0]?.[0] as {
      registration: Record<string, unknown>;
    };
    expect(sent.registration).toMatchObject({
      discordName: '新名字',
      ladderRank: '玄鐵',
      ladderScore: 1820,
      artsNote: '常用太玄經',
    });
  });

  // 表單帶入既有的值,不是叫人重打一次。
  it('修改表單預先填好目前的內容', async () => {
    api.getMyPlayer.mockResolvedValue(ok());
    render(<MyPlayer slug="s" />);
    await userEvent.click(await screen.findByRole('button', { name: '修改' }));
    expect(screen.getByLabelText('Discord 名稱')).toHaveValue('liLi_discord');
    expect(screen.getByLabelText('論劍積分')).toHaveValue('1820');
  });

  it('取消不送出任何東西', async () => {
    api.getMyPlayer.mockResolvedValue(ok());
    render(<MyPlayer slug="s" />);
    await userEvent.click(await screen.findByRole('button', { name: '修改' }));
    await userEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(api.updateRegistration).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '修改' })).toBeInTheDocument();
  });

  // 報名截止之後那些內容就是評段的依據,不該再動。
  it('報名期以外沒有修改按鈕,並說明為什麼', async () => {
    api.getMyPlayer.mockResolvedValue(ok({}, TournamentPhase.RANKING));
    render(<MyPlayer slug="s" />);
    await screen.findByRole('heading', { name: '李璃' });
    expect(screen.queryByRole('button', { name: '修改' })).not.toBeInTheDocument();
    expect(screen.getByText(/御風羽正是照著它們評段/)).toBeInTheDocument();
  });

  it('儲存失敗時顯示伺服器給的理由,而且留在編輯畫面', async () => {
    const { Code: C, ConnectError: CE } = await import('@connectrpc/connect');
    api.getMyPlayer.mockResolvedValue(ok());
    api.updateRegistration.mockRejectedValue(
      new CE('目前賽事階段不允許這個操作', C.FailedPrecondition),
    );
    render(<MyPlayer slug="s" />);
    await userEvent.click(await screen.findByRole('button', { name: '修改' }));
    await userEvent.click(screen.getByRole('button', { name: '儲存' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('目前賽事階段不允許這個操作');
    expect(screen.getByRole('button', { name: '儲存' })).toBeInTheDocument();
  });

  it('沒有無障礙違規', async () => {
    api.getMyPlayer.mockResolvedValue(ok({ rank: Rank.FEIHUA, seedNo: 3 }));
    const { container } = render(<MyPlayer slug="s" />);
    await screen.findByRole('heading', { name: '李璃' });
    await expectNoAxeViolations(container);
  });
});
