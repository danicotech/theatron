import { Code, ConnectError } from '@connectrpc/connect';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { TournamentPhase } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { MyPlayer } from '../signup/MyPlayer';
import { MemberAccess } from './MemberAccess';

const api = vi.hoisted(() => ({
  loginMember: vi.fn(),
  getMember: vi.fn(),
  getMyPlayer: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  listRanks: vi.fn(),
}));
vi.mock('../../lib/api/activity', () => ({
  activityApi: { signup: api, tournament: { listRanks: api.listRanks } },
}));
vi.mock('../../lib/api/client', () => ({
  platformApi: { auth: { loginMember: api.loginMember, getMember: api.getMember } },
}));
vi.mock('../../lib/api/memberSession', () => ({ memberLogout: api.logout }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../realtime/useTournamentRealtime', () => ({
  useTournamentRealtime: () => ({ status: 'ready', revision: 0, ranks: [] }),
}));
const player = {
  player: { gameId: 'abc', displayName: '測試會員', seedNo: 0 },
  tournament: { slug: 's', phase: TournamentPhase.SIGNUP },
};
beforeEach(() => {
  vi.resetAllMocks();
  api.listRanks.mockResolvedValue({ ranks: [] });
  api.login.mockResolvedValue({});
  api.loginMember.mockResolvedValue({});
  api.getMember.mockResolvedValue({ member: { canManage: false } });
  api.logout.mockResolvedValue({});
});

it('pending identity never shows the member workspace', () => {
  api.getMyPlayer.mockReturnValue(new Promise(() => {}));
  render(<MyPlayer slug="s" view="overview" />);
  expect(screen.getByRole('status')).toHaveTextContent('正在確認登入狀態');
  expect(screen.queryByRole('navigation', { name: '個人資訊切換' })).not.toBeInTheDocument();
});
it('anonymous identity sees login and registration; success and logout swap the whole workspace', async () => {
  api.getMyPlayer
    .mockRejectedValueOnce(new ConnectError('未登入', Code.Unauthenticated))
    .mockResolvedValue(player);
  render(<MyPlayer slug="s" view="overview" />);
  await screen.findByRole('heading', { name: '登入' });
  expect(screen.queryByRole('navigation', { name: '個人資訊切換' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '註冊' })).toHaveAttribute('href', '/t/s/signup');
  await userEvent.type(screen.getByLabelText('帳號'), 'abc');
  await userEvent.type(screen.getByLabelText('密碼'), 'test-password');
  await userEvent.click(screen.getByRole('button', { name: '登入' }));
  expect(await screen.findByRole('navigation', { name: '個人資訊切換' })).toBeInTheDocument();
  expect(api.login).toHaveBeenCalledWith({ tournamentSlug: 's' });
  await userEvent.click(screen.getByRole('button', { name: '登出' }));
  expect(await screen.findByRole('heading', { name: '登入' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: '個人資訊切換' })).not.toBeInTheDocument();
});
it('a session for another tournament does not expose the workspace', async () => {
  api.getMyPlayer.mockResolvedValue({ ...player, tournament: { slug: 'other' } });
  render(<MyPlayer slug="s" view="character" />);
  expect(await screen.findByRole('heading', { name: '登入' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: '個人資訊切換' })).not.toBeInTheDocument();
});
it('failed login remains on the login screen with an error', async () => {
  api.getMyPlayer.mockRejectedValue(new ConnectError('未登入', Code.Unauthenticated));
  api.loginMember.mockRejectedValue(new ConnectError('帳號或密碼錯誤', Code.Unauthenticated));
  render(<MyPlayer slug="s" view="registration" />);
  await userEvent.type(await screen.findByLabelText('帳號'), 'missing');
  await userEvent.type(screen.getByLabelText('密碼'), 'test-password');
  await userEvent.click(screen.getByRole('button', { name: '登入' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('帳號或密碼錯誤');
  expect(screen.queryByRole('navigation', { name: '個人資訊切換' })).not.toBeInTheDocument();
});
it('registration is separate from the member sidebar', () => {
  render(
    <MemberAccess slug="s" mode="signup">
      <p>報名表</p>
    </MemberAccess>,
  );
  expect(screen.getByRole('heading', { name: '註冊' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '登入' })).toHaveAttribute('href', '/t/s/login');
  expect(screen.queryByRole('navigation', { name: '個人資訊切換' })).not.toBeInTheDocument();
});
