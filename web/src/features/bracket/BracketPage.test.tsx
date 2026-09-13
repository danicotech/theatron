import { create } from '@bufbuild/protobuf';
import { expectNoAxeViolations } from '@theatron/ui/testing';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BracketRoundSchema,
  MatchKind,
  MatchSchema,
  MatchStatus,
  PlayerSchema,
  Rank,
  RankInfoSchema,
  TournamentPhase,
  TournamentSchema,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';

import { BracketPage } from './BracketPage';

const api = vi.hoisted(() => ({
  getTournament: vi.fn(),
  listRanks: vi.fn(),
  getBracket: vi.fn(),
}));

vi.mock('../../lib/api/activity', () => ({
  activityApi: {
    tournament: {
      getTournament: api.getTournament,
      listRanks: api.listRanks,
      getBracket: api.getBracket,
    },
  },
}));

// 用 create() 而不是物件字面值:protobuf-es 的訊息帶 $typeName,
// 手捏一個「看起來像」的物件會在型別上失敗,而硬轉型只是把失敗延到執行期。
const TOURNAMENT = create(TournamentSchema, {
  slug: 's',
  name: '百業試鋒 2026 春季賽',
  phase: TournamentPhase.IN_PROGRESS,
  bpPerRankGap: 8n,
  playerCount: 4,
  bestOf: 3,
  thirdPlaceMatch: true,
});

const RANKS = [
  create(RankInfoSchema, { rank: Rank.KAISHAN, name: '開山' }),
  create(RankInfoSchema, { rank: Rank.DUANSHUI, name: '斷水' }),
  create(RankInfoSchema, { rank: Rank.FEIHUA, name: '飛花' }),
  create(RankInfoSchema, { rank: Rank.WUWO, name: '無我' }),
];

const PLAYERS = [
  create(PlayerSchema, { publicId: 'p1', displayName: '李璃', rank: Rank.FEIHUA, seedNo: 1 }),
  create(PlayerSchema, { publicId: 'p2', displayName: 'A冷', rank: Rank.WUWO, seedNo: 2 }),
  create(PlayerSchema, { publicId: 'p3', displayName: '無名', rank: Rank.KAISHAN, seedNo: 3 }),
  create(PlayerSchema, { publicId: 'p4', displayName: '阿夜', rank: Rank.DUANSHUI, seedNo: 4 }),
];

const TS = { seconds: 1_800_000_000n };

const PUBLISHED = {
  bracketPublished: true,
  players: PLAYERS,
  rounds: [
    create(BracketRoundSchema, {
      round: 1,
      label: '準決賽',
      matches: [
        create(MatchSchema, {
          publicId: 'sf-1',
          round: 1,
          slot: 0,
          kind: MatchKind.BRACKET,
          p1PlayerPublicId: 'p1',
          p2PlayerPublicId: 'p4',
          status: MatchStatus.DONE,
          winnerPlayerPublicId: 'p1',
          rounds: [
            { roundNo: 1, startedAt: TS, finishedAt: TS, winnerPlayerPublicId: 'p1' },
            { roundNo: 2, startedAt: TS, finishedAt: TS, winnerPlayerPublicId: 'p1' },
          ],
          p1RoundWins: 2,
        }),
        create(MatchSchema, {
          publicId: 'sf-2',
          round: 1,
          slot: 1,
          kind: MatchKind.BRACKET,
          p1PlayerPublicId: 'p2',
          p2PlayerPublicId: 'p3',
          status: MatchStatus.LIVE,
          rounds: [{ roundNo: 1, startedAt: TS }],
        }),
      ],
    }),
    create(BracketRoundSchema, {
      round: 2,
      label: '決賽',
      matches: [
        // 伺服器給的順序刻意把季軍戰放前面,頁面要自己排對。
        create(MatchSchema, {
          publicId: 'third',
          round: 2,
          slot: 1,
          kind: MatchKind.THIRD_PLACE,
          p2PlayerPublicId: 'p4',
          status: MatchStatus.PENDING,
        }),
        create(MatchSchema, {
          publicId: 'final',
          round: 2,
          slot: 0,
          kind: MatchKind.BRACKET,
          p1PlayerPublicId: 'p1',
          status: MatchStatus.PENDING,
        }),
      ],
    }),
  ],
};

describe('BracketPage', () => {
  beforeEach(() => {
    Object.values(api).forEach((m) => {
      m.mockReset();
    });
    api.getTournament.mockResolvedValue({ tournament: TOURNAMENT });
    api.listRanks.mockResolvedValue({ ranks: RANKS, bpPerRankGap: 8n });
  });

  it('還沒公布時是邀請,不是錯誤', async () => {
    api.getBracket.mockResolvedValue({ bracketPublished: false, players: [], rounds: [] });
    render(<BracketPage slug="s" />);
    expect(await screen.findByText('對戰表還沒公布。')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '規則與讓武項目' })).toHaveAttribute(
      'href',
      '/t/s/rules',
    );
  });

  it('賽制從 best_of 算,不寫死', async () => {
    api.getBracket.mockResolvedValue(PUBLISHED);
    render(<BracketPage slug="s" />);
    expect(await screen.findByText('3 局 2 勝')).toBeInTheDocument();
  });

  it('季軍戰畫在決賽那一欄,排在決賽後面,而且標出來', async () => {
    api.getBracket.mockResolvedValue(PUBLISHED);
    render(<BracketPage slug="s" />);
    const finalColumn = await screen.findByRole('region', { name: '決賽' });
    expect(within(finalColumn).getByText('季軍戰')).toBeInTheDocument();
    const links = within(finalColumn).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/t/s/m/final', '/t/s/m/third']);
  });

  it('每一場都連到自己的場次頁', async () => {
    api.getBracket.mockResolvedValue(PUBLISHED);
    render(<BracketPage slug="s" />);
    const semis = await screen.findByRole('region', { name: '準決賽' });
    expect(within(semis).getByRole('link', { name: '第 1 場' })).toHaveAttribute(
      'href',
      '/t/s/m/sf-1',
    );
  });

  it('沒有無障礙違規', async () => {
    api.getBracket.mockResolvedValue(PUBLISHED);
    const { container } = render(<BracketPage slug="s" />);
    await screen.findByRole('region', { name: '決賽' });
    await expectNoAxeViolations(container);
  });
});
