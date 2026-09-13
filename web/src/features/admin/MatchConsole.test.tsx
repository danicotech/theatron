import { create, type MessageInitShape } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { expectNoAxeViolations } from '@theatron/ui/testing';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Match } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import {
  MatchKind,
  MatchRoundSchema,
  MatchSchema,
  MatchStatus,
  Rank,
  RankInfoSchema,
  ViolationRuling,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';
import {
  HandicapSelectionSchema,
  MatchHandicapsSchema,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';
import {
  ReviewHandicapResponseSchema,
  ReviewSetupResponseSchema,
  SetupChecklistEntrySchema,
} from '../../lib/api/gen/hestia/activity/v1/judge_pb';
import { GetMatchResponseSchema } from '../../lib/api/gen/hestia/activity/v1/tournament_pb';

import { MatchConsole } from './MatchConsole';

const api = vi.hoisted(() => ({
  getMatch: vi.fn(),
  getTournament: vi.fn(),
  listRanks: vi.fn(),
  reviewHandicap: vi.fn(),
  reviewSetup: vi.fn(),
  listViolations: vi.fn(),
  confirmSetup: vi.fn(),
  startRound: vi.fn(),
  finishRound: vi.fn(),
  recordViolation: vi.fn(),
  openHandicap: vi.fn(),
  lockHandicap: vi.fn(),
  refundSelection: vi.fn(),
  setStreamUrl: vi.fn(),
  withdrawPlayer: vi.fn(),
  getProfile: vi.fn(),
}));

vi.mock('../../lib/api/activity', () => ({
  activityApi: {
    tournament: {
      getMatch: api.getMatch,
      getTournament: api.getTournament,
      listRanks: api.listRanks,
    },
    judge: {
      reviewHandicap: api.reviewHandicap,
      reviewSetup: api.reviewSetup,
      listViolations: api.listViolations,
      confirmSetup: api.confirmSetup,
      startRound: api.startRound,
      finishRound: api.finishRound,
      recordViolation: api.recordViolation,
      openHandicap: api.openHandicap,
      lockHandicap: api.lockHandicap,
      refundSelection: api.refundSelection,
      setStreamUrl: api.setStreamUrl,
      withdrawPlayer: api.withdrawPlayer,
    },
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

const P1 = { publicId: 'p1', displayName: '李璃', gameId: 'a', rank: Rank.FEIHUA, seedNo: 1 };
const P2 = { publicId: 'p2', displayName: 'A冷', gameId: 'b', rank: Rank.WUWO, seedNo: 2 };

// MessageInit 是「完整訊息 | 初始化物件」的聯集;這裡只要後者,展開時才不會把 $typeName 帶進來。
type MatchInit = Exclude<MessageInitShape<typeof MatchSchema>, Match>;

function match(init: MatchInit = {}): Match {
  return create(MatchSchema, {
    publicId: 'm1',
    round: 2,
    slot: 0,
    p1PlayerPublicId: 'p1',
    p2PlayerPublicId: 'p2',
    kind: MatchKind.BRACKET,
    ...init,
  });
}

function matchResponse(m: Match) {
  return create(GetMatchResponseSchema, {
    match: m,
    p1: P1,
    p2: P2,
    handicapBudget: 8n,
    handicapHolderPublicId: 'p1',
  });
}

const CHECKLIST = [
  create(SetupChecklistEntrySchema, {
    selectionPublicId: 's1',
    itemKey: 'skill.ban_qishu',
    itemName: '禁用奇術',
    refereeNote: '開賽前確認對手已卸下所有奇術。',
  }),
  create(SetupChecklistEntrySchema, {
    selectionPublicId: 's2',
    itemKey: 'weapon.random',
    itemName: '隨機武學',
    drawResult: '流雲劍',
    refereeNote: '確認對手裝備的是抽到的那一套。',
    appliesToBoth: false,
  }),
];

const LOCKED = match({ status: MatchStatus.LOCKED });
const CONFIRMED = match({
  status: MatchStatus.LOCKED,
  setupConfirmedAt: timestampFromMs(1_700_000_000_000),
});

function live(startedMs: number): Match {
  return match({
    status: MatchStatus.LIVE,
    startedAt: timestampFromMs(startedMs),
    rounds: [create(MatchRoundSchema, { roundNo: 1, startedAt: timestampFromMs(startedMs) })],
  });
}

describe('MatchConsole', () => {
  beforeEach(() => {
    Object.values(api).forEach((m) => {
      m.mockReset();
    });
    api.getProfile.mockResolvedValue({});
    api.getTournament.mockResolvedValue({
      tournament: { slug: 's', name: '百業試鋒', bestOf: 3, bpPerRankGap: 8n },
    });
    api.listRanks.mockResolvedValue({ ranks: RANKS, bpPerRankGap: 8n });
    api.reviewHandicap.mockResolvedValue(create(ReviewHandicapResponseSchema, {}));
    api.reviewSetup.mockResolvedValue(
      create(ReviewSetupResponseSchema, { match: LOCKED, checklist: CHECKLIST }),
    );
    api.listViolations.mockResolvedValue({ violations: [] });
    api.confirmSetup.mockResolvedValue({});
    api.startRound.mockResolvedValue({});
    api.finishRound.mockResolvedValue({ matchDecided: false, advancedMatches: [] });
    api.recordViolation.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('封盤後顯示設定確認清單,整張一次確認', async () => {
    api.getMatch.mockResolvedValue(matchResponse(LOCKED));
    render(<MatchConsole slug="s" matchId="m1" />);

    expect(await screen.findByText('開賽前確認對手已卸下所有奇術。')).toBeInTheDocument();
    expect(screen.getByText('流雲劍')).toBeInTheDocument();
    // 還沒確認就不能開打:那顆按鈕根本不出現,而不是灰掉讓人以為壞了。
    expect(screen.queryByRole('button', { name: /正式決鬥開始/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '確認開賽前設定' }));
    await waitFor(() => {
      expect(api.confirmSetup).toHaveBeenCalledTimes(1);
    });
    expect(api.confirmSetup).toHaveBeenCalledWith({ matchPublicId: 'm1' });
  });

  it('設定確認後才給「第 1 回合正式決鬥開始」', async () => {
    api.getMatch.mockResolvedValue(matchResponse(CONFIRMED));
    render(<MatchConsole slug="s" matchId="m1" />);

    await userEvent.click(await screen.findByRole('button', { name: '第 1 回合正式決鬥開始' }));
    await waitFor(() => {
      expect(api.startRound).toHaveBeenCalledWith({ matchPublicId: 'm1' });
    });
    expect(screen.queryByRole('button', { name: '確認開賽前設定' })).not.toBeInTheDocument();
  });

  // 計時器是 now() − started_at,每秒重算;假時鐘往前撥一秒,畫面就要多一秒。
  it('開打中的回合計時每秒跳動', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-09-13T10:00:00Z'));
    api.getMatch.mockResolvedValue(matchResponse(live(Date.now() - 65_400)));
    render(<MatchConsole slug="s" matchId="m1" />);

    expect(await screen.findByRole('timer')).toHaveTextContent('01:05');
    // 非同步版:同步的 advanceTimersByTime 在 React 還沒掛上 effect 的那一瞬間撥,會撥了個空。
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByRole('timer')).toHaveTextContent('01:06');
  });

  // 判定回合勝者不可逆:先點人,再按一顆寫著名字的按鈕。沒點人就沒有那顆按鈕。
  it('判定回合勝者要先點人再確定,送出 confirm 與 round_no', async () => {
    api.getMatch.mockResolvedValue(matchResponse(live(Date.now() - 10_000)));
    render(<MatchConsole slug="s" matchId="m1" />);

    await screen.findByRole('timer');
    expect(screen.queryByRole('button', { name: /確定判/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^李璃.*勝$/ }));
    expect(api.finishRound).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(/備註/), '對手中途斷線');
    await userEvent.click(screen.getByRole('button', { name: '確定判 李璃 贏第 1 回合' }));
    await waitFor(() => {
      expect(api.finishRound).toHaveBeenCalledWith({
        matchPublicId: 'm1',
        roundNo: 1,
        winnerPlayerPublicId: 'p1',
        confirm: true,
        note: '對手中途斷線',
      });
    });
  });

  it('記違規要選人、選判決、寫備註', async () => {
    api.getMatch.mockResolvedValue(matchResponse(live(Date.now() - 10_000)));
    render(<MatchConsole slug="s" matchId="m1" />);
    await screen.findByRole('timer');

    const submit = screen.getByRole('button', { name: '記一筆違規' });
    expect(submit).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: '李璃' }));
    await userEvent.selectOptions(
      screen.getByLabelText('判決'),
      String(ViolationRuling.ROUND_LOSS),
    );
    await userEvent.type(screen.getByLabelText(/發生了什麼/), '使用了被禁的奇術');
    await userEvent.click(submit);

    await waitFor(() => {
      expect(api.recordViolation).toHaveBeenCalledWith({
        matchPublicId: 'm1',
        roundNo: 1,
        playerPublicId: 'p1',
        itemPublicId: '',
        ruling: ViolationRuling.ROUND_LOSS,
        note: '使用了被禁的奇術',
      });
    });
  });

  it('整場定案後列出因此成形的場次,含季軍戰', async () => {
    const m = live(Date.now() - 10_000);
    m.p1RoundWins = 1;
    api.getMatch.mockResolvedValue(matchResponse(m));
    api.finishRound.mockImplementation(() => {
      api.getMatch.mockResolvedValue(
        matchResponse(
          match({ status: MatchStatus.DONE, winnerPlayerPublicId: 'p1', p1RoundWins: 2 }),
        ),
      );
      return Promise.resolve({
        matchDecided: true,
        advancedMatches: [
          match({ publicId: 'm9', round: 3, slot: 0 }),
          match({ publicId: 'm3', round: 3, slot: 1, kind: MatchKind.THIRD_PLACE }),
        ],
      });
    });
    render(<MatchConsole slug="s" matchId="m1" />);

    await screen.findByRole('timer');
    await userEvent.click(screen.getByRole('button', { name: /^李璃.*勝$/ }));
    expect(screen.getByText(/整場定案,觸發晉級與派彩/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '確定判 李璃 贏第 1 回合' }));

    expect(await screen.findByRole('link', { name: /季軍戰/ })).toHaveAttribute(
      'href',
      '/judge/s/m/m3',
    );
    expect(screen.getByRole('link', { name: /第 3 輪/ })).toHaveAttribute('href', '/judge/s/m/m9');
    expect(screen.getByText(/李璃 勝/)).toBeInTheDocument();
  });

  // 封盤前裁判要看的是執行說明:代退與否的依據寫在那裡(如兩項禁奇術重疊要退後者)。
  it('封盤前的讓武檢視每一項都帶執行說明', async () => {
    api.getMatch.mockResolvedValue(matchResponse(match({ status: MatchStatus.READY })));
    api.reviewHandicap.mockResolvedValue(
      create(ReviewHandicapResponseSchema, {
        handicaps: create(MatchHandicapsSchema, {
          budget: { budget: 8n, spent: 6n, remaining: 2n },
          selections: [
            create(HandicapSelectionSchema, {
              publicId: 'sel1',
              itemPublicId: 'i1',
              itemName: '禁用任意奇術',
              cost: 6n,
              refereeNote: '若同時買了禁用奇術,經裁判確認後返還此項 BP。',
            }),
          ],
        }),
      }),
    );
    render(<MatchConsole slug="s" matchId="m1" />);

    expect(await screen.findByText('禁用任意奇術')).toBeInTheDocument();
    expect(screen.getByText('若同時買了禁用奇術,經裁判確認後返還此項 BP。')).toBeInTheDocument();
    expect(screen.queryByText(/封盤後的設定確認清單/)).not.toBeInTheDocument();
  });

  // 封盤不可逆:第一下只是問,第二下才送 confirm。
  it('封盤要按兩次,送出 confirm', async () => {
    api.getMatch.mockResolvedValue(matchResponse(match({ status: MatchStatus.READY })));
    api.lockHandicap.mockResolvedValue({});
    render(<MatchConsole slug="s" matchId="m1" />);

    await userEvent.click(await screen.findByRole('button', { name: '封盤' }));
    expect(api.lockHandicap).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '確定封盤' }));
    await waitFor(() => {
      expect(api.lockHandicap).toHaveBeenCalledWith({ matchPublicId: 'm1', confirm: true });
    });
  });

  it('棄賽要選人、寫理由、再確定一次', async () => {
    api.getMatch.mockResolvedValue(matchResponse(LOCKED));
    api.withdrawPlayer.mockResolvedValue({ walkoverMatches: [], voidedBetCount: 0 });
    render(<MatchConsole slug="s" matchId="m1" />);

    await screen.findByText('開賽前確認對手已卸下所有奇術。');
    await userEvent.click(screen.getByRole('button', { name: 'A冷P2' }));
    const go = screen.getByRole('button', { name: '讓 A冷 棄賽' });
    expect(go).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/為什麼棄賽/), '臨時有事');
    await userEvent.click(go);
    expect(api.withdrawPlayer).not.toHaveBeenCalled();
    expect(screen.getByText(/李璃不戰而勝/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '確定讓 A冷 棄賽' }));
    await waitFor(() => {
      expect(api.withdrawPlayer).toHaveBeenCalledWith({
        playerPublicId: 'p2',
        note: '臨時有事',
        confirm: true,
      });
    });
  });

  it('沒登入時給登入入口,回程帶回這一場', async () => {
    api.getProfile.mockRejectedValue(new ConnectError('未認證', Code.Unauthenticated));
    api.getMatch.mockResolvedValue(matchResponse(LOCKED));
    render(<MatchConsole slug="s" matchId="m1" />);

    expect(await screen.findByRole('link', { name: '登入' })).toHaveAttribute(
      'href',
      '/judge/login?next=/judge/s/m/m1',
    );
    expect(api.reviewSetup).not.toHaveBeenCalled();
  });

  it('沒有無障礙違規', async () => {
    api.getMatch.mockResolvedValue(matchResponse(LOCKED));
    const { container } = render(<MatchConsole slug="s" matchId="m1" />);
    await screen.findByText('開賽前確認對手已卸下所有奇術。');
    await expectNoAxeViolations(container);
  });
});
