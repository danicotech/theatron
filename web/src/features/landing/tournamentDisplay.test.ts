import { create } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';
import {
  MatchKind,
  MatchResultKind,
  MatchStatus,
  Rank,
  RankInfoSchema,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { GetBracketResponseSchema } from '../../lib/api/gen/hestia/activity/v1/tournament_pb';
import { tournamentDisplay } from './tournamentDisplay';

const bracket = () =>
  create(GetBracketResponseSchema, {
    bracketPublished: true,
    players: [
      {
        publicId: 'p1',
        displayName: '李璃',
        rank: Rank.FEIHUA,
        seedNo: 2,
        gameId: 'private-game',
        userPublicId: 'account-1',
      },
      { publicId: 'p2', displayName: '無名', rank: Rank.KAISHAN, seedNo: 3 },
      { publicId: 'p3', displayName: '未評者', rank: Rank.UNSPECIFIED },
    ],
    rounds: [
      {
        round: 2,
        label: '本屆決賽輪',
        matches: [
          {
            publicId: 'third',
            round: 2,
            slot: 1,
            kind: MatchKind.THIRD_PLACE,
            status: MatchStatus.READY,
            p1PlayerPublicId: 'p2',
          },
          {
            publicId: 'final',
            round: 2,
            slot: 0,
            kind: MatchKind.BRACKET,
            status: MatchStatus.LIVE,
            p1PlayerPublicId: 'p1',
            p2PlayerPublicId: 'p3',
            p1RoundWins: 2,
            p2RoundWins: 1,
          },
        ],
      },
    ],
  });

describe('首頁公開賽程投影', () => {
  it('未設定、載入中和失敗沒有虛構選手或場次', () => {
    for (const view of [
      tournamentDisplay(''),
      tournamentDisplay('event'),
      tournamentDisplay('event', 'error'),
    ]) {
      expect(view.players).toEqual([]);
      expect(view.rounds).toEqual([]);
      expect(view.published).toBe(false);
      expect(view.bestOf).toBe(0);
    }
    expect(tournamentDisplay('').kind).toBe('unconfigured');
    expect(tournamentDisplay('event', 'error').kind).toBe('error');
  });

  it('尚未公布時不透露回應中的草稿選手或配對', () => {
    const response = bracket();
    response.bracketPublished = false;
    expect(tournamentDisplay('event', { bracket: response, ranks: [], bestOf: 5 })).toMatchObject({
      kind: 'ready',
      published: false,
      players: [],
      rounds: [],
      bestOf: 5,
    });
  });

  it('只傳必要公開欄位，段位優先用伺服器措辭，沒有配裝或身份欄位', () => {
    const view = tournamentDisplay('event', {
      bracket: bracket(),
      ranks: [create(RankInfoSchema, { rank: Rank.FEIHUA, name: '本屆飛花' })],
      bestOf: 5,
    });
    expect(view.players).toEqual([
      { id: 'p1', name: '李璃', rank: 3, rankName: '本屆飛花', seed: 2 },
      { id: 'p2', name: '無名', rank: 1, rankName: '開山', seed: 3 },
      { id: 'p3', name: '未評者', rank: 0, rankName: '', seed: 0 },
    ]);
    expect(JSON.stringify(view)).not.toMatch(/private-game|account-1|loadout|artsNote/);
  });

  it('保留正式輪名、籤位、局數、即時比分並分開季軍戰；不猜晉級路徑', () => {
    const view = tournamentDisplay('event', { bracket: bracket(), ranks: [], bestOf: 5 });
    expect(view.bestOf).toBe(5);
    expect(view.rounds[0]?.label).toBe('本屆決賽輪');
    expect(view.rounds[0]?.matches).toEqual([
      {
        id: 'final',
        round: 2,
        slot: 0,
        p1: 'p1',
        p2: 'p3',
        winner: '',
        status: 'live',
        bye: false,
        kind: 'bracket',
        s1: 2,
        s2: 1,
      },
      {
        id: 'third',
        round: 2,
        slot: 1,
        p1: 'p2',
        p2: '',
        winner: '',
        status: 'upcoming',
        bye: false,
        kind: 'third',
        s1: 0,
        s2: 0,
      },
    ]);
    expect(view.rounds[0]?.matches[0]).not.toHaveProperty('nextMatchId');
  });

  it('只有正式不戰而勝才標輪空，未決空席不視為勝利', () => {
    const response = bracket();
    const final = response.rounds[0]!.matches[1]!;
    final.status = MatchStatus.DONE;
    final.resultKind = MatchResultKind.WALKOVER;
    final.winnerPlayerPublicId = 'p1';
    const view = tournamentDisplay('event', { bracket: response, ranks: [], bestOf: 3 });
    expect(view.rounds[0]?.matches[0]).toMatchObject({ status: 'done', bye: true, winner: 'p1' });
    expect(view.rounds[0]?.matches[1]?.bye).toBe(false);
  });
});
