import { create, type MessageInitShape } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { expectNoAxeViolations } from '@theatron/ui/testing';
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  HandicapCategory,
  MatchHandicapsSchema,
  MatchResultKind,
  MatchSchema,
  MatchStatus,
  PlayerSchema,
  Rank,
  RankInfoSchema,
  TournamentPhase,
  TournamentSchema,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';

import { MatchPage } from './MatchPage';

const api = vi.hoisted(() => ({
  getTournament: vi.fn(),
  listRanks: vi.fn(),
  getMatch: vi.fn(),
  getMatchHandicaps: vi.fn(),
}));

// 盤口是 features/betting 自己測的東西;這裡只驗它被掛在對峙構圖之後。
vi.mock('../betting', () => ({
  MarketBoard: ({ matchPublicId }: { matchPublicId: string }) => (
    <div data-testid="market-board">{matchPublicId}</div>
  ),
}));

vi.mock('../../lib/api/activity', () => ({
  activityApi: {
    tournament: {
      getTournament: api.getTournament,
      listRanks: api.listRanks,
      getMatch: api.getMatch,
    },
    handicap: { getMatchHandicaps: api.getMatchHandicaps },
  },
}));

// 用 create() 而不是物件字面值:protobuf-es 的訊息帶 $typeName,
// 手捏一個「看起來像」的物件會在型別上失敗,而硬轉型只是把失敗延到執行期。
const TOURNAMENT = create(TournamentSchema, {
  slug: 's',
  name: '百業試鋒 2026 春季賽',
  phase: TournamentPhase.IN_PROGRESS,
  bpPerRankGap: 8n,
  bestOf: 3,
});

const RANKS = [
  create(RankInfoSchema, { rank: Rank.KAISHAN, name: '開山' }),
  create(RankInfoSchema, { rank: Rank.DUANSHUI, name: '斷水' }),
  create(RankInfoSchema, { rank: Rank.FEIHUA, name: '飛花' }),
  create(RankInfoSchema, { rank: Rank.WUWO, name: '無我' }),
];

const P1 = create(PlayerSchema, {
  publicId: 'p1',
  displayName: '李璃',
  rank: Rank.FEIHUA,
  seedNo: 1,
});
const P2 = create(PlayerSchema, {
  publicId: 'p2',
  displayName: '無名',
  rank: Rank.KAISHAN,
  seedNo: 4,
});

const T0 = new Date('2026-09-13T12:00:00Z').getTime();

function matchResponse(overrides: MessageInitShape<typeof MatchSchema> = {}) {
  return {
    match: create(MatchSchema, {
      publicId: 'm',
      round: 2,
      slot: 0,
      p1PlayerPublicId: 'p1',
      p2PlayerPublicId: 'p2',
      status: MatchStatus.READY,
      handicapOpen: true,
      ...overrides,
    }),
    p1: P1,
    p2: P2,
    handicapBudget: 16n,
    handicapHolderPublicId: 'p2',
  };
}

const UNLOCKED = {
  handicaps: create(MatchHandicapsSchema, {
    matchPublicId: 'm',
    status: MatchStatus.READY,
    selections: [],
    constrainedPlayerPublicId: 'p1',
  }),
};

const LOCKED = {
  handicaps: create(MatchHandicapsSchema, {
    matchPublicId: 'm',
    status: MatchStatus.LOCKED,
    budget: { matchPublicId: 'm', playerPublicId: 'p2', budget: 16n, spent: 14n, remaining: 2n },
    lockedAt: timestampFromMs(T0 - 600_000),
    constrainedPlayerPublicId: 'p1',
    selections: [
      {
        publicId: 's1',
        itemName: '隨機武學',
        category: HandicapCategory.WEAPON,
        cost: 8n,
        drawResult: '太極劍',
      },
      {
        publicId: 's2',
        itemName: '雙方使用 46 級武庫',
        category: HandicapCategory.RULE,
        cost: 6n,
        targetNote: '限一階',
        appliesToBoth: true,
      },
    ],
  }),
};

/** 讓輪詢的第一次讀取落地。假時鐘下不能用 findBy(它等的 setTimeout 也是假的)。 */
async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10);
  });
}

describe('MatchPage', () => {
  beforeEach(() => {
    Object.values(api).forEach((m) => {
      m.mockReset();
    });
    api.getTournament.mockResolvedValue({ tournament: TOURNAMENT });
    api.listRanks.mockResolvedValue({ ranks: RANKS, bpPerRankGap: 8n });
    api.getMatchHandicaps.mockResolvedValue(UNLOCKED);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('進行中的回合每秒跳一次,秒數從 started_at 算', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    api.getMatch.mockResolvedValue(
      matchResponse({
        status: MatchStatus.LIVE,
        startedAt: timestampFromMs(T0 - 300_000),
        rounds: [
          {
            roundNo: 1,
            startedAt: timestampFromMs(T0 - 300_000),
            finishedAt: timestampFromMs(T0 - 170_000),
            winnerPlayerPublicId: 'p1',
          },
          { roundNo: 2, startedAt: timestampFromMs(T0 - 65_000) },
        ],
        p1RoundWins: 1,
      }),
    );
    render(<MatchPage slug="s" matchId="m" />);
    await settle();

    expect(screen.getByRole('status')).toHaveTextContent('比賽中,第 2 回合。');
    expect(screen.getByText('02:10')).toBeInTheDocument();
    expect(screen.getByText('01:05')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('01:06')).toBeInTheDocument();
  });

  it('封盤前公示是空的,只說誰在選;封盤後才列出內容', async () => {
    api.getMatch.mockResolvedValue(matchResponse());
    const { unmount } = render(<MatchPage slug="s" matchId="m" />);
    expect(await screen.findByText(/封盤前只有本人看得到/)).toBeInTheDocument();
    expect(screen.queryByText('隨機武學')).not.toBeInTheDocument();
    expect(screen.getByText('讓武 16 BP')).toBeInTheDocument();
    unmount();

    api.getMatchHandicaps.mockResolvedValue(LOCKED);
    api.getMatch.mockResolvedValue(matchResponse({ status: MatchStatus.LOCKED }));
    render(<MatchPage slug="s" matchId="m" />);
    expect(await screen.findByText('隨機武學')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '武器限制' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '規則限制' })).toBeInTheDocument();
    expect(screen.getByText('太極劍')).toBeInTheDocument();
    expect(screen.getByText('系統抽選')).toBeInTheDocument();
    expect(screen.getByText('雙方適用')).toBeInTheDocument();
    expect(screen.getByText('限一階')).toBeInTheDocument();
    expect(screen.getByText('8 BP')).toBeInTheDocument();
    expect(screen.getByText(/共 14 BP/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('讓武已封盤,等開打。');
  });

  // 回合表頭與頁尾的路換成共用元件之後仍然要在:表頭是 section 的名字來源,
  // 頁尾兩條是鍵盤走得到的連結。
  it('回合的表頭仍是 h2,頁尾兩條路聚焦得到', async () => {
    api.getMatch.mockResolvedValue(matchResponse());
    render(<MatchPage slug="s" matchId="m" />);
    const head = await screen.findByRole('heading', { level: 2, name: '回合' });
    expect(head).toHaveAttribute('id', 'rounds');
    expect(document.querySelector('section[aria-labelledby="rounds"]')).not.toBeNull();

    const nav = screen.getByRole('navigation', { name: '相關頁面' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/t/s/bracket', '/t/s/rules']);
    links.forEach((a) => {
      a.focus();
      expect(a).toHaveFocus();
    });
  });

  it('不戰而勝說清楚,而且勝者標出來', async () => {
    api.getMatch.mockResolvedValue(
      matchResponse({
        status: MatchStatus.DONE,
        resultKind: MatchResultKind.WALKOVER,
        winnerPlayerPublicId: 'p1',
      }),
    );
    render(<MatchPage slug="s" matchId="m" />);
    expect(await screen.findByRole('status')).toHaveTextContent('李璃 不戰而勝。');
    expect(screen.getByText('這一場沒有打過任何回合。')).toBeInTheDocument();
  });

  it('同段對決沒有讓武,也沒有公示', async () => {
    api.getMatch.mockResolvedValue({
      ...matchResponse(),
      handicapBudget: 0n,
      handicapHolderPublicId: '',
    });
    render(<MatchPage slug="s" matchId="m" />);
    expect(await screen.findByText('同段對決,本場無讓武。')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '讓武公示' })).not.toBeInTheDocument();
  });

  it('有直播連結才出現,進行中才強調', async () => {
    api.getMatch.mockResolvedValue(
      matchResponse({ status: MatchStatus.LIVE, streamUrl: 'https://example.test/live' }),
    );
    render(<MatchPage slug="s" matchId="m" />);
    expect(await screen.findByRole('link', { name: /看直播/ })).toHaveAttribute(
      'href',
      'https://example.test/live',
    );
  });

  it('沒有無障礙違規', async () => {
    api.getMatchHandicaps.mockResolvedValue(LOCKED);
    api.getMatch.mockResolvedValue(
      matchResponse({
        status: MatchStatus.LIVE,
        streamUrl: 'https://example.test/live',
        rounds: [{ roundNo: 1, startedAt: timestampFromMs(T0) }],
      }),
    );
    const { container } = render(<MatchPage slug="s" matchId="m" />);
    await screen.findByText('隨機武學');
    await expectNoAxeViolations(container);
  });
});
