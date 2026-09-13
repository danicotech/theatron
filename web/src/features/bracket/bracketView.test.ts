import { create } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';

import {
  BracketRoundSchema,
  MatchKind,
  MatchResultKind,
  MatchSchema,
  MatchStatus,
  PlayerSchema,
  Rank,
  RankInfoSchema,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';

import { activeRound, currentRoundNo, toBracketRounds, winsNeeded } from './bracketView';

// 用 create() 而不是物件字面值:protobuf-es 的訊息帶 $typeName,
// 手捏一個「看起來像」的物件會在型別上失敗,而硬轉型只是把失敗延到執行期。
const PLAYERS = [
  create(PlayerSchema, { publicId: 'p1', displayName: '李璃', rank: Rank.FEIHUA, seedNo: 1 }),
  create(PlayerSchema, { publicId: 'p2', displayName: 'A冷', rank: Rank.WUWO, seedNo: 2 }),
  create(PlayerSchema, { publicId: 'p3', displayName: '無名', rank: Rank.KAISHAN, seedNo: 3 }),
  create(PlayerSchema, { publicId: 'p4', displayName: '阿夜', rank: Rank.DUANSHUI, seedNo: 4 }),
];

const RANKS = [
  create(RankInfoSchema, { rank: Rank.KAISHAN, name: '開山' }),
  create(RankInfoSchema, { rank: Rank.DUANSHUI, name: '斷水' }),
  create(RankInfoSchema, { rank: Rank.FEIHUA, name: '飛花' }),
  create(RankInfoSchema, { rank: Rank.WUWO, name: '無我' }),
];

const TS = { seconds: 1_800_000_000n };

describe('toBracketRounds', () => {
  // 季軍戰與決賽同一輪,伺服器給的順序不保證;晉級樹的終點必須先於加打的那一場。
  it('季軍戰排在決賽後面,而且標成 third_place', () => {
    const final = create(BracketRoundSchema, {
      round: 2,
      label: '決賽',
      matches: [
        create(MatchSchema, { publicId: 'third', slot: 1, kind: MatchKind.THIRD_PLACE }),
        create(MatchSchema, { publicId: 'final', slot: 0, kind: MatchKind.BRACKET }),
      ],
    });
    const [view] = toBracketRounds([final], PLAYERS);
    expect(view?.matches.map((m) => m.id)).toEqual(['final', 'third']);
    expect(view?.matches[1]?.kind).toBe('third_place');
    expect(view?.matches[0]?.kind).toBe('bracket');
  });

  it('單場定勝負沒有比分;多回合制才有', () => {
    const m = create(MatchSchema, {
      publicId: 'm',
      p1PlayerPublicId: 'p1',
      p2PlayerPublicId: 'p2',
      status: MatchStatus.LIVE,
      rounds: [{ roundNo: 1, startedAt: TS, finishedAt: TS, winnerPlayerPublicId: 'p1' }],
      p1RoundWins: 1,
      p2RoundWins: 0,
    });
    const round = create(BracketRoundSchema, { round: 1, label: '首輪', matches: [m] });

    expect(toBracketRounds([round], PLAYERS, { bestOf: 1 })[0]?.matches[0]?.score).toBeUndefined();
    expect(toBracketRounds([round], PLAYERS, { bestOf: 3 })[0]?.matches[0]?.score).toEqual({
      top: 1,
      bottom: 0,
    });
  });

  // 回合列在開打時才建;還沒開打的三局兩勝場次也不該顯示 0 : 0。
  it('還沒開打的場次即使是多回合制也沒有比分', () => {
    const m = create(MatchSchema, { publicId: 'm', p1PlayerPublicId: 'p1' });
    const round = create(BracketRoundSchema, { round: 1, label: '首輪', matches: [m] });
    expect(toBracketRounds([round], PLAYERS, { bestOf: 3 })[0]?.matches[0]?.score).toBeUndefined();
  });

  it('不戰而勝的那一方標成輪空,輸的那一方不標', () => {
    const m = create(MatchSchema, {
      publicId: 'm',
      p1PlayerPublicId: 'p1',
      p2PlayerPublicId: 'p2',
      status: MatchStatus.DONE,
      resultKind: MatchResultKind.WALKOVER,
      winnerPlayerPublicId: 'p1',
    });
    const round = create(BracketRoundSchema, { round: 1, label: '首輪', matches: [m] });
    const view = toBracketRounds([round], PLAYERS)[0]?.matches[0];
    expect(view?.top?.bye).toBe(true);
    expect(view?.top?.won).toBe(true);
    expect(view?.bottom?.bye).toBeUndefined();
    expect(view?.onWinnerPath).toBe(true);
  });

  it('給了段位表才畫段位刻度,而且名稱來自伺服器', () => {
    const m = create(MatchSchema, { publicId: 'm', p1PlayerPublicId: 'p1' });
    const round = create(BracketRoundSchema, { round: 1, label: '首輪', matches: [m] });
    expect(toBracketRounds([round], PLAYERS)[0]?.matches[0]?.top?.rank).toBeUndefined();
    expect(toBracketRounds([round], PLAYERS, { ranks: RANKS })[0]?.matches[0]?.top?.rank).toEqual({
      level: 3,
      total: 4,
      name: '飛花',
    });
  });

  it('待定的位置是 undefined,不是空字串的選手', () => {
    const m = create(MatchSchema, { publicId: 'm', p1PlayerPublicId: 'p1' });
    const round = create(BracketRoundSchema, { round: 1, label: '首輪', matches: [m] });
    expect(toBracketRounds([round], PLAYERS)[0]?.matches[0]?.bottom).toBeUndefined();
  });
});

describe('activeRound', () => {
  function rounds(statuses: MatchStatus[][]) {
    return statuses.map((s, i) =>
      create(BracketRoundSchema, {
        round: i + 1,
        matches: s.map((status, j) => create(MatchSchema, { publicId: `${i}-${j}`, status })),
      }),
    );
  }

  it('有場次在打就是那一輪,即使前面還有沒打完的', () => {
    const r = rounds([
      [MatchStatus.DONE, MatchStatus.READY],
      [MatchStatus.LIVE, MatchStatus.PENDING],
      [MatchStatus.PENDING],
    ]);
    expect(activeRound(r)).toBe(2);
  });

  it('沒有場次在打就是第一個還沒打完的輪', () => {
    const r = rounds([
      [MatchStatus.DONE, MatchStatus.DONE],
      [MatchStatus.READY],
      [MatchStatus.PENDING],
    ]);
    expect(activeRound(r)).toBe(2);
  });

  it('全部打完就落在最後一輪', () => {
    const r = rounds([[MatchStatus.DONE, MatchStatus.DONE], [MatchStatus.DONE]]);
    expect(activeRound(r)).toBe(2);
  });

  it('沒有輪次就是 undefined', () => {
    expect(activeRound([])).toBeUndefined();
  });
});

describe('回合計算', () => {
  it('幾局幾勝要贏幾回合', () => {
    expect(winsNeeded(1)).toBe(1);
    expect(winsNeeded(3)).toBe(2);
    expect(winsNeeded(5)).toBe(3);
    // 伺服器沒給(0)當單場定勝負,不會算出 1 局 1 勝以外的東西。
    expect(winsNeeded(0)).toBe(1);
  });

  it('進行中的回合是最後一筆沒結束的;都結束了就是下一回合', () => {
    const live = create(MatchSchema, {
      rounds: [
        { roundNo: 1, startedAt: TS, finishedAt: TS, winnerPlayerPublicId: 'p1' },
        { roundNo: 2, startedAt: TS },
      ],
    });
    expect(currentRoundNo(live)).toBe(2);
    const between = create(MatchSchema, {
      rounds: [{ roundNo: 1, startedAt: TS, finishedAt: TS, winnerPlayerPublicId: 'p1' }],
    });
    expect(currentRoundNo(between)).toBe(2);
    expect(currentRoundNo(create(MatchSchema, {}))).toBe(1);
  });
});
