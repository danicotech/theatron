import { describe, expect, it } from 'vitest';
import { TournamentPhase } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { activityDisplay } from './activityDisplay';

describe('首頁活動展示狀態', () => {
  it('未設定、載入中與失敗都不宣稱開放報名', () => {
    for (const view of [
      activityDisplay(''),
      activityDisplay('test'),
      activityDisplay('test', 'error'),
    ]) {
      expect(view.href).toBe('#rules');
      expect(view.status).not.toContain('開放');
    }
    expect(activityDisplay('test', 'error').kind).toBe('error');
  });
  it.each([
    [TournamentPhase.SIGNUP, '報名參賽', '/signup'],
    [TournamentPhase.SIGNUP_CLOSED, '查看賽事資訊', ''],
    [TournamentPhase.RANKING, '查看賽事資訊', ''],
    [TournamentPhase.RANKED, '查看賽事資訊', ''],
    [TournamentPhase.DRAWING, '查看對戰表', '/bracket'],
    [TournamentPhase.IN_PROGRESS, '查看對戰表', '/bracket'],
    [TournamentPhase.FINISHED, '查看對戰表', '/bracket'],
  ] as const)('階段 %s 的文案和目的地一致', (phase, label, suffix) => {
    expect(activityDisplay('test-event', phase)).toMatchObject({
      label,
      href: `/t/test-event${suffix}`,
      kind: 'ready',
    });
  });
});
