import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { MemberWorkspace } from './MemberWorkspace';
import { Code, ConnectError } from '@connectrpc/connect';

const api = vi.hoisted(() => ({ getMember: vi.fn(), login: vi.fn(), logout: vi.fn() }));
vi.mock('../../lib/api/client', () => ({ platformApi: { auth: { getMember: api.getMember } } }));
vi.mock('../../lib/api/activity', () => ({ activityApi: { signup: { login: api.login } } }));
vi.mock('../../lib/api/memberSession', () => ({ memberLogout: api.logout }));
vi.mock('../signup/PlayerLogin', () => ({ PlayerLogin: () => <p>密碼登入</p> }));
vi.mock('./PersonalArmory', () => ({ PersonalArmory: () => <p>私人武庫</p> }));
beforeEach(() => {
  vi.resetAllMocks();
  api.getMember.mockResolvedValue({ member: { displayName: '未報名會員', canManage: true } });
  api.login.mockRejectedValue(new ConnectError('not enrolled', Code.NotFound));
});
it.each(['overview', 'registration', 'character'] as const)(
  'logs out from %s and removes member content',
  async (view) => {
    api.logout.mockResolvedValue(undefined);
    render(<MemberWorkspace slug="spring" view={view} />);
    await userEvent.click(await screen.findByRole('button', { name: '登出' }));
    expect(await screen.findByText('密碼登入')).toBeInTheDocument();
    expect(screen.queryByText('私人武庫')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '管理賽事' })).not.toBeInTheDocument();
    expect(api.logout).toHaveBeenCalledTimes(1);
  },
);
it('keeps the workspace and allows retry after a failed logout', async () => {
  api.logout.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  render(<MemberWorkspace slug="spring" view="overview" />);
  await userEvent.click(await screen.findByRole('button', { name: '登出' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('登出失敗');
  expect(screen.getByRole('link', { name: '管理賽事' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '登出' }));
  await waitFor(() => expect(screen.getByText('密碼登入')).toBeInTheDocument());
});
