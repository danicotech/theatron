import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { expectNoAxeViolations } from '@theatron/ui/testing';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PlayerStatus,
  Rank,
  RankInfoSchema,
  TournamentPhase,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';

import { MyPlayer } from './MyPlayer';

const api = vi.hoisted(() => ({ getMyPlayer: vi.fn(), listRanks: vi.fn() }));

vi.mock('../../lib/api/activity', () => ({
  activityApi: {
    signup: { getMyPlayer: api.getMyPlayer },
    tournament: { listRanks: api.listRanks },
  },
}));

const RANKS = [
  create(RankInfoSchema, { rank: Rank.KAISHAN, name: '開山', title: '初試之境' }),
  create(RankInfoSchema, { rank: Rank.FEIHUA, name: '飛花', title: '純熟之境' }),
];

function ok(over: Record<string, unknown> = {}) {
  return {
    player: {
      displayName: '李璃',
      gameId: 'liLi',
      rank: Rank.UNSPECIFIED,
      status: PlayerStatus.ACTIVE,
      seedNo: 0,
      ...over,
    },
    tournament: { slug: 's', name: '百業試鋒 2026', phase: TournamentPhase.SIGNUP },
  };
}

describe('MyPlayer', () => {
  beforeEach(() => {
    api.getMyPlayer.mockReset();
    api.listRanks.mockReset();
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

  it('沒有無障礙違規', async () => {
    api.getMyPlayer.mockResolvedValue(ok({ rank: Rank.FEIHUA, seedNo: 3 }));
    const { container } = render(<MyPlayer slug="s" />);
    await screen.findByRole('heading', { name: '李璃' });
    await expectNoAxeViolations(container);
  });
});
