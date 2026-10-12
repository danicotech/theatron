import type { BpCommand, BpSelection } from './bp';
/** Local simulation models, never backend RPC contracts. */
import type { Ceremony, ManagerCommand } from './managerEngine';
export type Member = {
  anonymous?: boolean;
  id: string;
  login: string;
  name: string;
  salt: string;
  hash: string;
  discord: string;
  balance: string;
};
export type Character = { style: string; weapon: string; equipment: string; arts: string };
export type EnrollmentProfile = {
  server: string;
  discord: string;
  selfRank: string;
  experience: string;
  availability: string;
  notes: string;
};
export type Enrollment = {
  profile?: EnrollmentProfile;
  updatedAt?: number;
  userId: string;
  playerId: string;
  gameId: string;
  name: string;
  character: Character;
  rulesAccepted: boolean;
  status: 'draft' | 'confirmed';
};
export type Player = { id: string; name: string; character?: Character };
export type Registration = {
  capacity: number;
  open: boolean;
  published: boolean;
  entries: Enrollment[];
};
export type Bout = { winner: string; seconds: number };
export type Match = {
  id: string;
  round: number;
  slot: number;
  kind: 'bracket' | 'third';
  p1: string;
  p2: string;
  bye: boolean;
  status: 'upcoming' | 'live' | 'done';
  winner: string;
  s1: number;
  s2: number;
  draft: Bout[];
};
export type Tournament = {
  disabledMarketKinds?: Kind[];
  ceremony?: Ceremony;
  bpRanks?: Record<string, number>;
  bpSelections?: BpSelection[];
  registration?: Registration;
  id: string;
  name: string;
  players: Player[];
  matches: Match[];
  links: Record<string, string>;
  started: boolean;
};
export type Kind = 'winner' | 'round' | 'score' | 'duration' | 'total' | 'place';
export type Market = {
  pausedByAdmin?: boolean;
  minLegs?: number;
  id: string;
  eventId: string;
  matchId: string;
  title: string;
  kind: Kind;
  round: number;
  place: number;
  line: number;
  mode: 'popular' | 'fixed';
  status: 'open' | 'closed' | 'settled' | 'void';
  result: string;
  reason: string;
  options: { id: string; label: string; fixed: string; baseline: number }[];
  votes: Record<string, string>;
};
export type Leg = { marketId: string; outcome: string; odds: string; label: string };
export type Bet = {
  rules?: 'tw-v1';
  unitStake?: string;
  combinations?: Leg[][];
  sizes?: number[];
  id: string;
  userId: string;
  eventId: string;
  stake: string;
  legs: Leg[];
  payout: string;
  status: 'open' | 'won' | 'lost' | 'void' | 'partial';
  created: number;
};
export type Entry = {
  id: string;
  userId: string;
  amount: string;
  balance: string;
  label: string;
  ref: string;
  created: number;
};
export type Prize = {
  id: string;
  name: string;
  description: string;
  price: string;
  stock: number;
  active: boolean;
};
export type Redemption = {
  id: string;
  userId: string;
  prizeId: string;
  name: string;
  price: string;
  status: 'pending' | 'approved' | 'delivered' | 'cancelled';
  created: number;
};
export type State = {
  version: 1;
  revision: number;
  members: Member[];
  events: Tournament[];
  markets: Market[];
  bets: Bet[];
  entries: Entry[];
  prizes: Prize[];
  redemptions: Redemption[];
  operations: Record<string, { signature: string; result: string }>;
};
export type Snapshot = {
  players: Player[];
  rounds: {
    round: number;
    matches: { id: string; slot: number; p1: string; p2: string; bye?: boolean; kind?: string }[];
  }[];
};
export type Command =
  | ManagerCommand
  | BpCommand
  | { type: 'guest' }
  | { type: 'activity-create'; name: string; capacity: number }
  | { type: 'registration-open' }
  | { type: 'activity-update'; eventId: string; name: string; capacity: number; open: boolean }
  | {
      type: 'enroll';
      profile?: EnrollmentProfile;
      eventId: string;
      userId: string;
      gameId: string;
      name: string;
      character: Character;
      rulesAccepted: boolean;
      complete: boolean;
    }
  | { type: 'publish-roster'; eventId: string; playerIds: string[] }
  | { type: 'fixed-event'; eventId: string }
  | {
      type: 'ticket';
      independent?: boolean;
      userId: string;
      eventId: string;
      unitStake: string;
      legs: Leg[];
      sizes: number[];
      oddsPolicy: 'strict' | 'higher';
    }
  | { type: 'register'; member: Member }
  | { type: 'bind'; userId: string; discord: string }
  | { type: 'create'; name: string; snapshot: Snapshot }
  | { type: 'link'; eventId: string; userId: string; playerId: string }
  | { type: 'vote'; userId: string; marketId: string; outcome: string }
  | {
      type: 'configure';
      minLegs?: number;
      marketId: string;
      mode: Market['mode'];
      line: number;
      options: { id: string; fixed: string; baseline: number }[];
    }
  | { type: 'bet'; userId: string; eventId: string; stake: string; legs: Leg[] }
  | { type: 'start'; eventId: string; matchId: string }
  | { type: 'draft'; eventId: string; matchId: string; bouts: Bout[] }
  | { type: 'settle'; eventId: string; matchId: string; revision: number }
  | { type: 'void'; marketId: string; reason: string }
  | { type: 'prize'; prize: Prize }
  | { type: 'redeem'; userId: string; prizeId: string; price: string }
  | { type: 'redemption'; id: string; status: Redemption['status']; actor: string };
