import {
  MatchKind,
  MatchResultKind,
  MatchStatus,
  Rank,
  type RankInfo,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';
import type { GetBracketResponse } from '../../lib/api/gen/hestia/activity/v1/tournament_pb';

/** The lab receives public presentation data, never registration or betting credentials. */
export interface TournamentPlayerDisplay {
  id: string;
  name: string;
  gameAvatarUrl?: string;
  rank: number;
  rankName: string;
  seed: number;
  character?: {
    style: string;
    weapon: string;
    equipment: string;
    arts: string;
    snapshotJson: string;
  };
}

export interface TournamentMatchDisplay {
  id: string;
  round: number;
  slot: number;
  p1: string;
  p2: string;
  winner: string;
  status: 'upcoming' | 'live' | 'done';
  bye: boolean;
  kind: 'bracket' | 'third';
  s1: number;
  s2: number;
}

export interface TournamentDisplay {
  kind: 'unconfigured' | 'loading' | 'error' | 'ready';
  slug: string;
  players: TournamentPlayerDisplay[];
  rounds: { round: number; label: string; matches: TournamentMatchDisplay[] }[];
  published: boolean;
  /** Zero means the activity request has not supplied the format yet. */
  bestOf: number;
}

interface TournamentSource {
  bracket: GetBracketResponse;
  ranks: RankInfo[];
  bestOf: number;
}

const rankNames: Record<number, string> = {
  [Rank.KAISHAN]: '開山',
  [Rank.DUANSHUI]: '斷水',
  [Rank.FEIHUA]: '飛花',
  [Rank.WUWO]: '無我',
};

export function tournamentDisplay(
  slug: string,
  source: 'loading' | 'error' | TournamentSource = 'loading',
): TournamentDisplay {
  const empty = { slug, players: [], rounds: [], published: false, bestOf: 0 };
  if (!slug) return { ...empty, kind: 'unconfigured' };
  if (source === 'loading' || source === 'error') return { ...empty, kind: source };
  const { bracket, ranks, bestOf } = source;
  const base: TournamentDisplay = { ...empty, kind: 'ready', bestOf };
  // Publication is a server decision. Never expose a draft returned before publication.
  if (!bracket.bracketPublished) return base;
  return {
    ...base,
    published: true,
    players: bracket.players.map((player) => {
      const rank = Object.hasOwn(rankNames, player.rank) ? player.rank : 0;
      return {
        id: player.publicId,
        name: player.displayName,
        ...(player.gameAvatarUrl ? { gameAvatarUrl: player.gameAvatarUrl } : {}),
        rank,
        rankName: rank ? ranks.find((r) => r.rank === rank)?.name || rankNames[rank]! : '',
        seed: player.seedNo,
        ...(player.character
          ? {
              character: {
                style: player.character.style,
                weapon: player.character.weapon,
                equipment: player.character.equipment,
                arts: player.character.arts,
                snapshotJson: player.character.snapshotJson,
              },
            }
          : {}),
      };
    }),
    rounds: bracket.rounds.map((round) => ({
      round: round.round,
      label: round.label,
      matches: [...round.matches]
        .sort((a, b) => a.slot - b.slot)
        .map((match) => ({
          id: match.publicId,
          round: match.round,
          slot: match.slot,
          p1: match.p1PlayerPublicId,
          p2: match.p2PlayerPublicId,
          winner: match.winnerPlayerPublicId,
          status:
            match.status === MatchStatus.DONE
              ? 'done'
              : match.status === MatchStatus.LIVE
                ? 'live'
                : 'upcoming',
          // An empty opponent is usually an undecided seat, not proof of a bye.
          bye: match.status === MatchStatus.DONE && match.resultKind === MatchResultKind.WALKOVER,
          kind: match.kind === MatchKind.THIRD_PLACE ? 'third' : 'bracket',
          s1: match.p1RoundWins,
          s2: match.p2RoundWins,
        })),
    })),
  };
}
