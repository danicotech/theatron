import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { Code, ConnectError } from '@connectrpc/connect';
import { SignupPage } from './SignupPage';
const api = vi.hoisted(() => ({ member: vi.fn(), login: vi.fn() }));
vi.mock('../../lib/api/client', () => ({ platformApi: { auth: { getMember: api.member } } }));
vi.mock('../../lib/api/activity', () => ({ activityApi: { signup: { login: api.login } } }));
vi.mock('../realtime/useTournamentRealtime', () => ({
  useTournamentRealtime: () => ({ status: 'ready', tournament: { phase: 1, rulesVersion: 'v1' } }),
}));
vi.mock('./SignupForm', () => ({ SignupForm: () => <p>武庫報名表</p> }));
beforeEach(() => {
  api.member.mockReset();
  api.login.mockReset();
});
it('anonymous visitors see registration and login before any enrollment form', async () => {
  api.member.mockRejectedValue(new ConnectError('login required', Code.Unauthenticated));
  render(<SignupPage slug="test" />);
  expect(await screen.findByRole('heading', { name: '先登入，再報名' })).toBeInTheDocument();
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(screen.getByRole('link', { name: '使用帳號註冊／登入' })).toHaveAttribute(
    'href',
    '/t/test/login?next=%2Ft%2Ftest%2Fenroll',
  );
  expect(screen.queryByText('武庫報名表')).not.toBeInTheDocument();
  expect(api.login).not.toHaveBeenCalled();
});
it('existing enrollment directs the authenticated member to saved data', async () => {
  api.member.mockResolvedValue({
    member: { publicId: 'member', displayName: '選手', discordUsername: 'raven' },
  });
  api.login.mockResolvedValue({});
  render(<SignupPage slug="test" />);
  expect(await screen.findByRole('link', { name: '查看我的報名' })).toHaveAttribute(
    'href',
    '/t/test/me?view=registration',
  );
  expect(screen.queryByText('武庫報名表')).not.toBeInTheDocument();
});
