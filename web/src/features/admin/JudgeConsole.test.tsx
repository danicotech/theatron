import { Code, ConnectError } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import { expectNoAxeViolations } from '@theatron/ui/testing';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  Rank,
  RankInfoSchema,
  TournamentPhase,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';

import { JudgeConsole } from './JudgeConsole';

const api = vi.hoisted(() => ({
  getTournament: vi.fn(),
  listRanks: vi.fn(),
  advancePhase: vi.fn(),
  listUnranked: vi.fn(),
  listPlayers: vi.fn(),
  getProfile: vi.fn(),
}));

vi.mock('../../lib/api/activity', () => ({
  activityApi: {
    tournament: {
      getTournament: api.getTournament,
      listRanks: api.listRanks,
      listPlayers: api.listPlayers,
    },
    judge: { advancePhase: api.advancePhase, listUnranked: api.listUnranked },
  },
}));

vi.mock('../../lib/api/client', () => ({
  platformApi: { me: { getProfile: api.getProfile } },
}));

// 用 create() 而不是物件字面值:protobuf-es 的訊息帶 $typeName,
// 手捏一個「看起來像」的物件會在型別上失敗,而硬轉型只是把失敗延到執行期。
const RANKS = [
  create(RankInfoSchema, { rank: Rank.KAISHAN, name: '開山', title: '初試之境' }),
  create(RankInfoSchema, { rank: Rank.DUANSHUI, name: '斷水', title: '初成之境' }),
  create(RankInfoSchema, { rank: Rank.FEIHUA, name: '飛花', title: '純熟之境' }),
  create(RankInfoSchema, { rank: Rank.WUWO, name: '無我', title: '歷戰之境' }),
];

function tournament(phase: TournamentPhase) {
  return {
    tournament: {
      publicId: '01J0',
      slug: '2026-baiye-shifeng',
      name: '百業試鋒',
      phase,
      bpPerRankGap: 8n,
      playerCount: 12,
    },
  };
}

describe('JudgeConsole', () => {
  beforeEach(() => {
    Object.values(api).forEach((m) => {
      m.mockReset();
    });
    api.listRanks.mockResolvedValue({ ranks: RANKS, bpPerRankGap: 8n });
    api.getProfile.mockResolvedValue({});
    api.listUnranked.mockResolvedValue({ players: [] });
    api.listPlayers.mockResolvedValue({ players: [] });
  });

  it('賽事讀進來就顯示名稱、人數與每段 BP', async () => {
    api.getTournament.mockResolvedValue(tournament(TournamentPhase.SIGNUP));
    render(<JudgeConsole slug="2026-baiye-shifeng" />);
    expect(await screen.findByText('百業試鋒')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('8 BP')).toBeInTheDocument();
  });

  // 沒登入不是錯誤畫面:賽事本身是公開的,只有動作要身分。
  it('沒登入時顯示登入入口,而且不顯示推進階段的按鈕', async () => {
    api.getProfile.mockRejectedValue(new ConnectError('未認證', Code.Unauthenticated));
    api.getTournament.mockResolvedValue(tournament(TournamentPhase.SIGNUP));
    render(<JudgeConsole slug="2026-baiye-shifeng" />);

    // 帶著回程:登入完要回到他原本要做事的那一頁。
    expect(await screen.findByRole('link', { name: '用 Discord 登入' })).toHaveAttribute(
      'href',
      '/api/auth/discord/start?redirect=%2Fjudge%2F2026-baiye-shifeng',
    );
    expect(screen.queryByRole('button', { name: /推進到/ })).not.toBeInTheDocument();
  });

  it('推進按鈕寫的是下一個階段的名字,不是「下一步」', async () => {
    api.getTournament.mockResolvedValue(tournament(TournamentPhase.SIGNUP));
    render(<JudgeConsole slug="2026-baiye-shifeng" />);
    expect(await screen.findByRole('button', { name: '推進到「報名截止」' })).toBeInTheDocument();
  });

  it('最後一個階段沒有推進按鈕', async () => {
    api.getTournament.mockResolvedValue(tournament(TournamentPhase.FINISHED));
    render(<JudgeConsole slug="2026-baiye-shifeng" />);
    await screen.findByText('百業試鋒');
    expect(screen.queryByRole('button', { name: /推進到/ })).not.toBeInTheDocument();
  });

  it('評段階段才出現評段面板', async () => {
    api.getTournament.mockResolvedValue(tournament(TournamentPhase.RANKING));
    render(<JudgeConsole slug="2026-baiye-shifeng" />);
    await waitFor(() => {
      expect(api.listUnranked).toHaveBeenCalledWith({ tournamentSlug: '2026-baiye-shifeng' });
    });
  });

  it('報名階段說的是現在在等什麼,不是「沒有資料」', async () => {
    api.getTournament.mockResolvedValue(tournament(TournamentPhase.SIGNUP));
    render(<JudgeConsole slug="2026-baiye-shifeng" />);
    expect(await screen.findByText(/報名開著,等選手填表/)).toBeInTheDocument();
    expect(api.listUnranked).not.toHaveBeenCalled();
  });

  it('推進階段被伺服器拒絕時,顯示伺服器給的理由', async () => {
    api.getTournament.mockResolvedValue(tournament(TournamentPhase.RANKED));
    api.advancePhase.mockRejectedValue(
      new ConnectError('尚有選手未評定段位', Code.FailedPrecondition),
    );
    render(<JudgeConsole slug="2026-baiye-shifeng" />);
    await userEvent.click(await screen.findByRole('button', { name: '推進到「抽籤」' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('尚有選手未評定段位');
  });

  it('沒有無障礙違規', async () => {
    api.getTournament.mockResolvedValue(tournament(TournamentPhase.SIGNUP));
    const { container } = render(<JudgeConsole slug="2026-baiye-shifeng" />);
    await screen.findByText('百業試鋒');
    await expectNoAxeViolations(container);
  });
});
