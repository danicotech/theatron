import type { BracketMatchView, BracketRoundView, BracketSeat } from '@theatron/ui';

import type {
  BracketRound,
  Match,
  Player,
  RankInfo,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';
import {
  MatchKind,
  MatchResultKind,
  MatchStatus,
  Rank,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';

/**
 * 把伺服器的對戰表轉成 BracketTree 要的呈現資料。
 *
 * BracketTree 刻意不知道賽事規則(packages/ui 的邊界),所以「誰贏了」「哪一場在打」
 * 「季軍戰放哪」都在這裡算好。這是唯一一份轉換 —— 觀眾的對戰表與裁判的場次列表
 * 都用它,兩邊才不會對同一場算出不同的狀態。
 */

/** 段位總共四階;刻度要畫幾格由這裡定,不從 enum 的最大值推(UNSPECIFIED 是 0)。 */
export const RANK_TOTAL = 4;

export function rankLevel(r: Rank): number {
  switch (r) {
    case Rank.KAISHAN:
      return 1;
    case Rank.DUANSHUI:
      return 2;
    case Rank.FEIHUA:
      return 3;
    case Rank.WUWO:
      return 4;
    default:
      return 0;
  }
}

export function rankName(ranks: RankInfo[], r: Rank): string {
  return ranks.find((x) => x.rank === r)?.name ?? '';
}

export interface BracketViewOptions {
  /** 段位名稱來自伺服器(逐屆可調措辭);不給就不畫段位刻度。 */
  ranks?: RankInfo[] | undefined;
  /** 每一場要連到哪;不給就不可點。 */
  hrefFor?: ((m: Match) => string | undefined) | undefined;
  /** 幾局幾勝。> 1 才顯示比分;1 = 單場定勝負,比分沒有意義。 */
  bestOf?: number | undefined;
}

export function toBracketRounds(
  rounds: BracketRound[],
  players: Player[],
  opts: BracketViewOptions = {},
): BracketRoundView[] {
  const byId = new Map(players.map((p) => [p.publicId, p]));
  return rounds.map((r) => ({
    round: r.round,
    label: r.label,
    // 季軍戰與決賽同輪(slot 1),排在決賽後面;晉級樹上的場次依 slot 排。
    matches: [...r.matches]
      .sort((a, b) => kindOrder(a) - kindOrder(b) || a.slot - b.slot)
      .map((m) => toBracketMatch(m, byId, opts)),
  }));
}

function kindOrder(m: Match): number {
  return m.kind === MatchKind.THIRD_PLACE ? 1 : 0;
}

export function toBracketMatch(
  m: Match,
  byId: Map<string, Player>,
  opts: BracketViewOptions = {},
): BracketMatchView {
  const decided = m.status === MatchStatus.DONE && m.winnerPlayerPublicId !== '';
  const showScore = (opts.bestOf ?? 1) > 1 && m.rounds.length > 0;
  return {
    id: m.publicId,
    state: matchState(m),
    kind: m.kind === MatchKind.THIRD_PLACE ? 'third_place' : 'bracket',
    top: toSeat(m.p1PlayerPublicId, m, byId, opts.ranks),
    bottom: toSeat(m.p2PlayerPublicId, m, byId, opts.ranks),
    // 分出勝負的那一場點亮連接線:亮的就是晉級路徑。不戰而勝也算 —— 他確實晉級了。
    onWinnerPath: decided && m.kind !== MatchKind.THIRD_PLACE,
    score: showScore ? { top: m.p1RoundWins, bottom: m.p2RoundWins } : undefined,
    liveRound: m.status === MatchStatus.LIVE ? currentRoundNo(m) : undefined,
    href: opts.hrefFor?.(m),
  };
}

function toSeat(
  publicId: string,
  m: Match,
  byId: Map<string, Player>,
  ranks: RankInfo[] | undefined,
): BracketSeat | undefined {
  if (publicId === '') return undefined;
  const p = byId.get(publicId);
  const seat: BracketSeat = {
    name: p?.displayName ?? publicId,
    won: m.status === MatchStatus.DONE && m.winnerPlayerPublicId === publicId,
  };
  if (p !== undefined && ranks !== undefined && p.rank !== Rank.UNSPECIFIED) {
    seat.rank = { level: rankLevel(p.rank), total: RANK_TOTAL, name: rankName(ranks, p.rank) };
  }
  // 對手不戰而勝:輸的那一方標「棄賽」的語意由狀態文字表達,這裡只標晉級。
  if (m.resultKind === MatchResultKind.WALKOVER && seat.won === true) {
    seat.bye = true;
  }
  return seat;
}

export function matchState(m: Match): BracketMatchView['state'] {
  switch (m.status) {
    case MatchStatus.DONE:
      return 'done';
    case MatchStatus.LIVE:
      return 'live';
    default:
      return 'upcoming';
  }
}

/** 進行中的回合編號:最後一筆沒 finished_at 的回合;都結束了就是下一回合。 */
export function currentRoundNo(m: Match): number {
  const open = m.rounds.find((r) => r.finishedAt === undefined);
  if (open !== undefined) return open.roundNo;
  return m.rounds.length + 1;
}

/**
 * 手機分輪檢視預設落在「有事情正在發生的那一輪」:
 * 有場次在打 → 那一輪;否則第一個還有場次沒打完的輪;都打完了 → 最後一輪。
 */
export function activeRound(rounds: BracketRound[]): number | undefined {
  const live = rounds.find((r) => r.matches.some((m) => m.status === MatchStatus.LIVE));
  if (live !== undefined) return live.round;
  const pending = rounds.find((r) => r.matches.some((m) => m.status !== MatchStatus.DONE));
  if (pending !== undefined) return pending.round;
  return rounds[rounds.length - 1]?.round;
}

/** 幾局幾勝要贏幾回合。best_of 由伺服器給,前端不寫死 3。 */
export function winsNeeded(bestOf: number): number {
  return Math.floor(Math.max(bestOf, 1) / 2) + 1;
}
