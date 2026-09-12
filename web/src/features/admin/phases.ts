import { TournamentPhase } from '../../lib/api/gen/hestia/activity/v1/common_pb';

/**
 * 賽事階段的顯示名稱與順序。
 *
 * 放在 web 這一側:packages/ui 不知道賽事規則(SKILL.md 的元件邊界),
 * 而階段名稱是產品詞彙,不是 tournaments.config 裡逐屆可調的措辭 ——
 * 段位名稱是後者,所以那個要跟伺服器要(見 ListRanks 的 proto 註解)。
 *
 * 順序就是 proto 的 enum 順序。單向前進,能不能走由伺服器驗證;
 * 這裡只負責畫出來。
 */
export interface PhaseMeta {
  key: string;
  label: string;
  phase: TournamentPhase;
  hint?: string;
}

export const PHASES: PhaseMeta[] = [
  { key: 'signup', label: '報名', phase: TournamentPhase.SIGNUP },
  { key: 'signup_closed', label: '報名截止', phase: TournamentPhase.SIGNUP_CLOSED },
  { key: 'ranking', label: '評段', phase: TournamentPhase.RANKING },
  {
    key: 'ranked',
    label: '段位公布',
    phase: TournamentPhase.RANKED,
    hint: '刻意排在抽籤之前,讓選手有異議可提',
  },
  { key: 'drawing', label: '抽籤', phase: TournamentPhase.DRAWING },
  { key: 'in_progress', label: '比賽中', phase: TournamentPhase.IN_PROGRESS },
  { key: 'finished', label: '結束', phase: TournamentPhase.FINISHED },
];

export function phaseKey(phase: TournamentPhase): string {
  return PHASES.find((p) => p.phase === phase)?.key ?? '';
}

export function phaseLabel(phase: TournamentPhase): string {
  return PHASES.find((p) => p.phase === phase)?.label ?? '未知階段';
}

/** 下一個階段;已經是最後一個就回 undefined。 */
export function nextPhase(phase: TournamentPhase): PhaseMeta | undefined {
  const i = PHASES.findIndex((p) => p.phase === phase);
  return i < 0 ? undefined : PHASES[i + 1];
}
