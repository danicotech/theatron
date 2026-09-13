import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { expectNoAxeViolations } from '@theatron/ui/testing';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BpBudgetSchema,
  HandicapCategory,
  HandicapItemSchema,
  HandicapSelectionSchema,
  MatchHandicapsSchema,
  MatchStatus,
  PlayerStatus,
  TournamentPhase,
  ViolationRuling,
  ViolationSchema,
  type HandicapSelection,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';

import { HandicapShop } from './HandicapShop';

const api = vi.hoisted(() => ({
  getMyPlayer: vi.fn(),
  listItems: vi.fn(),
  getMyBudget: vi.fn(),
  getMatchHandicaps: vi.fn(),
  select: vi.fn(),
  voidSelection: vi.fn(),
  listMyViolations: vi.fn(),
}));

vi.mock('../../lib/api/activity', () => ({
  activityApi: {
    signup: { getMyPlayer: api.getMyPlayer },
    handicap: {
      listItems: api.listItems,
      getMyBudget: api.getMyBudget,
      getMatchHandicaps: api.getMatchHandicaps,
      select: api.select,
      voidSelection: api.voidSelection,
      listMyViolations: api.listMyViolations,
    },
  },
}));

// 用 create() 而不是物件字面值:protobuf-es 的訊息帶 $typeName,
// 手捏一個「看起來像」的物件會在型別上失敗,而硬轉型只是把失敗延到執行期。
const ITEMS = [
  create(HandicapItemSchema, {
    publicId: 'i-art',
    category: HandicapCategory.WEAPON,
    name: '指定對手武學',
    description: '由你指定對手本場使用的武學。',
    cost: 20n,
    requiresTargetNote: true,
    sortOrder: 10,
    key: 'weapon.designated_art',
  }),
  create(HandicapItemSchema, {
    publicId: 'i-46',
    category: HandicapCategory.WEAPON,
    name: '雙方使用 46 級武庫武學裝備',
    cost: 5n,
    appliesToBoth: true,
    sortOrder: 40,
    key: 'weapon.armory_46',
  }),
  create(HandicapItemSchema, {
    publicId: 'i-remap',
    category: HandicapCategory.SKILL,
    name: '指定並更改技能位子',
    cost: 5n,
    repeatable: true,
    requiresTargetNote: true,
    sortOrder: 60,
    key: 'skill.remap',
  }),
  create(HandicapItemSchema, {
    publicId: 'i-90',
    category: HandicapCategory.VICTORY,
    name: '撐過 90 秒即獲勝',
    cost: 24n,
    seconds: 90n,
    sortOrder: 10,
    key: 'victory.survive_90s',
  }),
  create(HandicapItemSchema, {
    publicId: 'i-timeout',
    category: HandicapCategory.VICTORY,
    name: '時間結束即勝利',
    cost: 10n,
    sortOrder: 40,
    key: 'victory.timeout_win',
  }),
];

const ME = 'p-me';
const OPP = 'p-opp';

function myPlayer(over: { round?: number; slot?: number; handicapOpen?: boolean } = {}) {
  return {
    player: {
      publicId: ME,
      displayName: '李璃',
      gameId: 'liLi',
      rank: 1,
      status: PlayerStatus.ACTIVE,
      seedNo: 3,
    },
    tournament: {
      slug: 's',
      name: '百業試鋒 2026',
      phase: TournamentPhase.IN_PROGRESS,
      bpPerRankGap: 8n,
    },
    currentMatch: {
      publicId: 'm1',
      round: over.round ?? 2,
      slot: over.slot ?? 0,
      p1PlayerPublicId: ME,
      p2PlayerPublicId: OPP,
      status: MatchStatus.READY,
      handicapOpen: over.handicapOpen ?? true,
      rounds: [],
    },
  };
}

function budget(spent: bigint, total = 24n) {
  return create(BpBudgetSchema, {
    matchPublicId: 'm1',
    playerPublicId: ME,
    budget: total,
    spent,
    remaining: total - spent,
  });
}

function selection(
  id: string,
  item: (typeof ITEMS)[number],
  over: Partial<Pick<HandicapSelection, 'targetNote' | 'drawResult'>> = {},
): HandicapSelection {
  return create(HandicapSelectionSchema, {
    publicId: id,
    itemPublicId: item.publicId,
    itemName: item.name,
    category: item.category,
    cost: item.cost,
    itemKey: item.key,
    appliesToBoth: item.appliesToBoth,
    ...over,
  });
}

/** 我持有 BP、對手受限的一場。 */
function holderState(
  selections: HandicapSelection[],
  opts: { locked?: boolean; editable?: boolean; lockedReason?: string } = {},
) {
  const spent = selections.reduce((sum, s) => sum + s.cost, 0n);
  const b = budget(spent);
  const locked = opts.locked ?? false;
  api.getMatchHandicaps.mockResolvedValue({
    handicaps: create(MatchHandicapsSchema, {
      matchPublicId: 'm1',
      status: locked ? MatchStatus.LOCKED : MatchStatus.READY,
      budget: b,
      selections,
      constrainedPlayerPublicId: OPP,
      lockedAt: locked ? timestampFromDate(new Date('2026-09-13T12:34:00Z')) : undefined,
    }),
  });
  api.getMyBudget.mockResolvedValue({
    budget: b,
    selections,
    editable: opts.editable ?? !locked,
    lockedReason: opts.lockedReason ?? (locked ? '已封盤' : ''),
  });
}

describe('HandicapShop', () => {
  beforeEach(() => {
    Object.values(api).forEach((m) => {
      m.mockReset();
    });
    api.getMyPlayer.mockResolvedValue(myPlayer());
    api.listItems.mockResolvedValue({ items: ITEMS });
    api.select.mockResolvedValue({});
    api.voidSelection.mockResolvedValue({});
    api.listMyViolations.mockResolvedValue({ violations: [] });
  });

  it('沒進站時給進站的路,不給商店', async () => {
    api.getMyPlayer.mockRejectedValue(new ConnectError('未認證', Code.Unauthenticated));
    render(<HandicapShop slug="s" />);
    expect(await screen.findByRole('link', { name: '用遊戲ID 進站' })).toHaveAttribute(
      'href',
      '/t/s/login',
    );
    expect(screen.queryByRole('button', { name: '買下' })).not.toBeInTheDocument();
  });

  it('還沒排到場次就說清楚,不顯示空商店', async () => {
    const res = myPlayer();
    api.getMyPlayer.mockResolvedValue({ ...res, currentMatch: undefined });
    render(<HandicapShop slug="s" />);
    expect(await screen.findByText(/還沒有排定的場次/)).toBeInTheDocument();
    expect(api.getMatchHandicaps).not.toHaveBeenCalled();
  });

  // 被讓的一方沒有東西可以買;封盤前連對手買了什麼都看不到。
  it('我是被讓的一方時沒有商店,封盤前只說封盤後公開', async () => {
    api.getMatchHandicaps.mockResolvedValue({
      handicaps: create(MatchHandicapsSchema, {
        matchPublicId: 'm1',
        status: MatchStatus.READY,
        budget: create(BpBudgetSchema, { budget: 16n, spent: 0n, remaining: 16n }),
        selections: [],
        constrainedPlayerPublicId: ME,
      }),
    });
    render(<HandicapShop slug="s" />);
    expect(await screen.findByText(/本場你是被讓的一方/)).toBeInTheDocument();
    expect(screen.getByText(/對手手上有 16 BP/)).toBeInTheDocument();
    expect(screen.getByText(/封盤後才公開/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '買下' })).not.toBeInTheDocument();
    expect(api.getMyBudget).not.toHaveBeenCalled();
  });

  it('封盤後被讓的一方看得到對手的讓武單', async () => {
    api.getMatchHandicaps.mockResolvedValue({
      handicaps: create(MatchHandicapsSchema, {
        matchPublicId: 'm1',
        status: MatchStatus.LOCKED,
        budget: create(BpBudgetSchema, { budget: 16n, spent: 5n, remaining: 11n }),
        selections: [selection('s1', ITEMS[1]!)],
        constrainedPlayerPublicId: ME,
        lockedAt: timestampFromDate(new Date()),
      }),
    });
    render(<HandicapShop slug="s" />);
    expect(await screen.findByText('雙方使用 46 級武庫武學裝備')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '退掉' })).not.toBeInTheDocument();
  });

  it('餘額計顯示預算、已用、剩餘,而且說沒花完會作廢', async () => {
    holderState([selection('s1', ITEMS[4]!)]); // 花了 10,剩 14
    render(<HandicapShop slug="s" />);
    const meter = await screen.findByRole('region', { name: 'BP 餘額計' });
    expect(within(meter).getByLabelText('剩餘 14BP')).toBeInTheDocument();
    expect(within(meter).getByText('24')).toBeInTheDocument();
    expect(within(meter).getByText('10')).toBeInTheDocument();
    expect(within(meter).getByText(/差 3 段 × 8 BP/)).toBeInTheDocument();
    expect(within(meter).getByText(/賽後作廢/)).toBeInTheDocument();
  });

  it('BP 不夠的項目按鈕停用並說原因,買得起的照常', async () => {
    holderState([selection('s1', ITEMS[0]!, { targetNote: '太玄經' })]); // 花了 20,剩 4
    render(<HandicapShop slug="s" />);
    const row90 = (await screen.findByText('撐過 90 秒即獲勝')).closest('li')!;
    expect(within(row90).getByRole('button', { name: '買下' })).toBeDisabled();
    expect(within(row90).getByText('BP 不夠')).toBeInTheDocument();
    // 同一個名字也出現在讓武單上,所以要限定在項目列表裡找。
    const catalogue = screen.getByRole('region', { name: '讓武項目' });
    const rowArt = within(catalogue).getByText('指定對手武學').closest('li')!;
    expect(within(rowArt).getByLabelText('已買 1 次')).toHaveTextContent('×1');
  });

  it('需要指定內容的項目,沒填不能買;填了才送出並帶上內容', async () => {
    holderState([]);
    render(<HandicapShop slug="s" />);
    const row = (await screen.findByText('指定對手武學')).closest('li')!;
    const buy = within(row).getByRole('button', { name: '買下' });
    expect(buy).toBeDisabled();

    await userEvent.type(within(row).getByLabelText('指定內容(必填)'), '太玄經');
    expect(buy).toBeEnabled();
    await userEvent.click(buy);
    expect(api.select).toHaveBeenCalledWith({
      matchPublicId: 'm1',
      itemPublicId: 'i-art',
      targetNote: '太玄經',
    });
  });

  // 系統不擋互斥:提醒歸提醒,買還是能買。
  it('選了第二項勝利條件會提醒,但不擋購買', async () => {
    holderState([selection('s1', ITEMS[3]!), selection('s2', ITEMS[4]!)], {
      editable: true,
    });
    // 24 + 10 = 34 > 24,預算給大一點才驗得到「還能買」。
    api.getMatchHandicaps.mockResolvedValue({
      handicaps: create(MatchHandicapsSchema, {
        matchPublicId: 'm1',
        status: MatchStatus.READY,
        budget: budget(34n, 48n),
        selections: [selection('s1', ITEMS[3]!), selection('s2', ITEMS[4]!)],
        constrainedPlayerPublicId: OPP,
      }),
    });
    render(<HandicapShop slug="s" />);
    expect(await screen.findByRole('status')).toHaveTextContent(/同時生效可能互相矛盾/);

    const row46 = screen.getByText('雙方使用 46 級武庫武學裝備').closest('li')!;
    const buy = within(row46).getByRole('button', { name: '買下' });
    expect(buy).toBeEnabled();
    await userEvent.click(buy);
    expect(api.select).toHaveBeenCalledWith({
      matchPublicId: 'm1',
      itemPublicId: 'i-46',
      targetNote: '',
    });
  });

  it('還沒開盤時整條橫幅說明,按鈕停用', async () => {
    holderState([], { editable: false, lockedReason: '裁判還沒開盤,等公告。' });
    render(<HandicapShop slug="s" />);
    expect(await screen.findByText('裁判還沒開盤,等公告。')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: '買下' });
    buttons.forEach((b) => {
      expect(b).toBeDisabled();
    });
  });

  it('封盤後沒有買與退的按鈕,並顯示系統抽選結果', async () => {
    holderState(
      [
        selection('s1', ITEMS[3]!),
        selection('s2', ITEMS[0]!, { targetNote: '太玄經', drawResult: '' }),
        selection('s3', ITEMS[1]!, { drawResult: '太白劍法' }),
      ],
      { locked: true },
    );
    render(<HandicapShop slug="s" />);
    expect(await screen.findByText(/已封盤/)).toBeInTheDocument();
    expect(screen.getByText('系統抽選:太白劍法')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '買下' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '退掉' })).not.toBeInTheDocument();
    expect(screen.getByText('雙方適用')).toBeInTheDocument();
  });

  it('同一項買兩次合併成 ×2,退掉一次退最近那一筆', async () => {
    holderState([
      selection('s1', ITEMS[2]!, { targetNote: '武學技到 Q' }),
      selection('s2', ITEMS[2]!, { targetNote: '武學技到 Q' }),
    ]);
    render(<HandicapShop slug="s" />);
    const ticket = await screen.findByRole('region', { name: /讓武單 · 第 2 輪第 1 場/ });
    expect(within(ticket).getByLabelText('2 張')).toHaveTextContent('×2');
    await userEvent.click(within(ticket).getByRole('button', { name: '退掉' }));
    expect(api.voidSelection).toHaveBeenCalledWith({ selectionPublicId: 's2' });
    expect(api.getMatchHandicaps.mock.calls.length).toBeGreaterThan(1);
  });

  it('買失敗時把伺服器的理由放在按鈕旁邊', async () => {
    holderState([]);
    api.select.mockRejectedValue(new ConnectError('BP 不足', Code.FailedPrecondition));
    render(<HandicapShop slug="s" />);
    const row = (await screen.findByText('時間結束即勝利')).closest('li')!;
    await userEvent.click(within(row).getByRole('button', { name: '買下' }));
    expect(await within(row).findByRole('alert')).toHaveTextContent('BP 不足');
  });

  // 沒有違規是常態:不畫「沒有違規」的卡,連標題都不出現。
  it('沒有違規紀錄時什麼都不畫', async () => {
    holderState([]);
    render(<HandicapShop slug="s" />);
    await screen.findByRole('region', { name: 'BP 餘額計' });
    expect(screen.queryByRole('heading', { name: '我的違規紀錄' })).not.toBeInTheDocument();
    expect(api.listMyViolations).toHaveBeenCalledWith({ matchPublicId: 'm1' });
  });

  it('有違規紀錄時逐筆列出回合、項目、判決與備註', async () => {
    holderState([]);
    api.listMyViolations.mockResolvedValue({
      violations: [
        create(ViolationSchema, {
          publicId: 'v1',
          roundNo: 0,
          itemName: '雙方使用 46 級武庫武學裝備',
          ruling: ViolationRuling.WARNING,
          note: '設定確認時發現沒改到,改完再開。',
          createdAt: timestampFromDate(new Date('2026-09-13T12:34:00Z')),
        }),
        create(ViolationSchema, {
          publicId: 'v2',
          roundNo: 2,
          ruling: ViolationRuling.ROUND_LOSS,
          note: '場中切換武器。',
        }),
      ],
    });
    render(<HandicapShop slug="s" />);
    const section = (await screen.findByRole('heading', { name: '我的違規紀錄' })).closest(
      'section',
    )!;
    const rows = within(section).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('開賽前');
    expect(rows[0]).toHaveTextContent('雙方使用 46 級武庫武學裝備');
    expect(rows[0]).toHaveTextContent('警告');
    expect(rows[0]).toHaveTextContent('設定確認時發現沒改到');
    expect(rows[1]).toHaveTextContent('第 2 回合');
    expect(rows[1]).toHaveTextContent('判該回合落敗');
    expect(within(section).getByText(/以裁判填的回合勝者為準/)).toBeInTheDocument();
  });

  it('沒有無障礙違規', async () => {
    holderState([selection('s1', ITEMS[3]!), selection('s2', ITEMS[4]!)]);
    const { container } = render(<HandicapShop slug="s" />);
    await screen.findByRole('region', { name: 'BP 餘額計' });
    await expectNoAxeViolations(container);
  });

  it('封盤畫面也沒有無障礙違規', async () => {
    holderState([selection('s1', ITEMS[1]!, { drawResult: '太白劍法' })], { locked: true });
    const { container } = render(<HandicapShop slug="s" />);
    await screen.findByText(/已封盤/);
    await expectNoAxeViolations(container);
  });
});
