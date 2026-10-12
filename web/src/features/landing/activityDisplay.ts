import { TournamentPhase } from '../../lib/api/gen/hestia/activity/v1/common_pb';

/** Presentation state only; the API contract remains generated. */
export interface ActivityDisplay {
  kind: 'unconfigured' | 'loading' | 'error' | 'ready';
  slug: string;
  status: string;
  label: string;
  href: string;
  phase: number;
}

export function activityDisplay(
  slug: string,
  state: 'loading' | 'error' | TournamentPhase = 'loading',
): ActivityDisplay {
  const base = { slug, href: '#rules', label: '查看賽制', phase: -1 };
  if (!slug) return { ...base, kind: 'unconfigured', status: '報名資訊尚未公布' };
  if (state === 'loading') return { ...base, kind: 'loading', status: '正在讀取活動資訊' };
  if (state === 'error') return { ...base, kind: 'error', status: '活動資訊讀取失敗，請重試' };
  const root = `/t/${encodeURIComponent(slug)}`;
  const statuses = [
    '活動階段尚未公布',
    '報名開放中',
    '報名已截止',
    '評段中',
    '段位已公布',
    '抽籤中',
    '比賽中',
    '本屆已結束',
  ];
  const bracket = [
    TournamentPhase.DRAWING,
    TournamentPhase.IN_PROGRESS,
    TournamentPhase.FINISHED,
  ].includes(state);
  return {
    ...base,
    kind: 'ready',
    phase: state - 1,
    status: statuses[state] ?? '活動階段尚未公布',
    label: state === TournamentPhase.SIGNUP ? '報名參賽' : bracket ? '查看對戰表' : '查看賽事資訊',
    href: root + (state === TournamentPhase.SIGNUP ? '/signup' : bracket ? '/bracket' : ''),
  };
}
