import { create } from '@bufbuild/protobuf';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TournamentPhase, TournamentSchema } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { ScheduleManagement } from './ScheduleManagement';

const state = vi.hoisted(() => ({ snapshot: {}, advancePhase: vi.fn(), reconnect: vi.fn() }));
vi.mock('../realtime/useTournamentRealtime', () => ({
  useTournamentRealtime: () => state.snapshot,
}));
vi.mock('../realtime/tournamentRealtime', () => ({
  tournamentRealtime: () => ({ reconnect: state.reconnect }),
}));
vi.mock('../realtime/ConnectionStatus', () => ({ ConnectionStatus: () => null }));
vi.mock('../../lib/api/activity', () => ({
  activityApi: { judge: { advancePhase: state.advancePhase } },
}));
vi.mock('./PlayerAvatarManager', () => ({ PlayerAvatarManager: () => <p>遊戲頭像管理</p> }));
vi.mock('./RegistrationRoster', () => ({ RegistrationRoster: () => <p>報名名單</p> }));
vi.mock('./RankingPanel', () => ({ RankingPanel: () => <p>評段操作</p> }));
vi.mock('./DrawPanel', () => ({ DrawPanel: () => <p>抽籤操作</p> }));
vi.mock('./MatchList', () => ({
  MatchList: ({ onSelectMatch }: { onSelectMatch: (id: string) => void }) => (
    <button onClick={() => onSelectMatch('match-1')}>選擇第一場</button>
  ),
}));
vi.mock('./MatchConsole', () => ({
  MatchConsole: ({
    matchId,
    onBack,
    onChanged,
  }: {
    matchId: string;
    onBack: () => void;
    onChanged: () => void;
  }) => (
    <div>
      單場 {matchId}
      <button onClick={onBack}>返回全部場次</button>
      <button onClick={onChanged}>完成單場操作</button>
    </div>
  ),
}));

function snapshot(phase: TournamentPhase, status = 'ready') {
  state.snapshot = {
    status,
    ranks: [],
    tournament: create(TournamentSchema, {
      slug: 'test',
      name: '測試賽事',
      phase,
      bestOf: 3,
      bpPerRankGap: 8n,
    }),
    revision: 1,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  snapshot(TournamentPhase.SIGNUP);
  state.advancePhase.mockResolvedValue({});
});
afterEach(cleanup);

describe('schedule management workflow', () => {
  it('requires a visible confirmation before advancing the event', async () => {
    const user = userEvent.setup();
    render(<ScheduleManagement slug="test" />);
    await user.click(screen.getByRole('button', { name: '進入報名截止' }));
    expect(state.advancePhase).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '確認報名截止' }));
    await waitFor(() =>
      expect(state.advancePhase).toHaveBeenCalledWith(
        expect.objectContaining({ tournamentSlug: 'test', toPhase: TournamentPhase.SIGNUP_CLOSED }),
      ),
    );
    expect(state.reconnect).toHaveBeenCalled();
  });

  it('does not bypass draw confirmation with generic phase advancement', () => {
    snapshot(TournamentPhase.DRAWING);
    render(<ScheduleManagement slug="test" />);
    expect(screen.getByText('抽籤操作')).toBeInTheDocument();
    expect(screen.queryByText('進入比賽中')).not.toBeInTheDocument();
  });

  it('blocks advancing when disconnected', () => {
    snapshot(TournamentPhase.SIGNUP, 'reconnecting');
    render(<ScheduleManagement slug="test" />);
    expect(screen.getByRole('button', { name: '進入報名截止' })).toBeDisabled();
  });

  it('opens matches in the schedule and refreshes shared data after changes', async () => {
    snapshot(TournamentPhase.IN_PROGRESS);
    const user = userEvent.setup();
    render(<ScheduleManagement slug="test" />);
    await user.click(screen.getByRole('button', { name: '選擇第一場' }));
    expect(screen.getByText('單場 match-1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '完成單場操作' }));
    expect(state.reconnect).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '返回全部場次' }));
    expect(screen.getByRole('button', { name: '選擇第一場' })).toBeInTheDocument();
  });
});
