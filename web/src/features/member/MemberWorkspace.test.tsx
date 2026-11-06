import { render, screen } from '@testing-library/react';
import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, expect, it, vi } from 'vitest';
import { MemberWorkspace } from './MemberWorkspace';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
const api = vi.hoisted(() => ({ getMember: vi.fn(), login: vi.fn() }));
vi.mock('../../lib/api/client', () => ({ platformApi: { auth: { getMember: api.getMember } } }));
vi.mock('../../lib/api/activity', () => ({ activityApi: { signup: { login: api.login } } }));
vi.mock('../signup/MyPlayer', () => ({ MyPlayer: () => <p>已保存的報名資料</p> }));
vi.mock('../signup/PlayerLogin', () => ({ PlayerLogin: () => <p>密碼登入</p> }));
beforeEach(() => vi.clearAllMocks());
it('keeps the member session when switching sidebar views', async () => {
  api.getMember.mockResolvedValue({ member: { displayName: '會員' } });
  api.login.mockRejectedValue(new ConnectError('not enrolled', Code.NotFound));
  const { rerender } = render(<MemberWorkspace slug="spring" view="overview" />);
  await screen.findByText('會員');
  rerender(<MemberWorkspace slug="spring" view="registration" />);
  rerender(<MemberWorkspace slug="spring" view="character" />);
  expect(screen.queryByText('正在確認會員資料…')).not.toBeInTheDocument();
  expect(api.getMember).toHaveBeenCalledTimes(1);
  expect(api.login).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('link', { name: '編輯個人武庫 ↗' })).toHaveAttribute(
    'href',
    '/loadout?t=spring&returnTo=member',
  );
  for (const name of ['流派', '武器', '裝備', '武學', '心法', '奇術']) {
    expect(screen.getByRole('heading', { name })).toBeInTheDocument();
  }
  expect(screen.getByText('尚未配對')).toBeInTheDocument();
});
it('restores an enrolled OAuth member without asking for another login', async () => {
  api.getMember.mockResolvedValue({ member: { displayName: '會員' } });
  api.login.mockResolvedValue({});
  render(<MemberWorkspace slug="spring" view="overview" />);
  expect(await screen.findByText('已保存的報名資料')).toBeInTheDocument();
  expect(api.login).toHaveBeenCalledWith({ tournamentSlug: 'spring' });
});
it('shows a simple account overview and retains administrator navigation in the sidebar', async () => {
  api.getMember.mockResolvedValue({ member: { displayName: '管理員', canManage: true } });
  api.login.mockRejectedValue(new ConnectError('not enrolled', Code.NotFound));
  render(<MemberWorkspace slug="spring" view="overview" />);
  expect(await screen.findByRole('img', { name: '管理員的頭像' })).toBeInTheDocument();
  expect(screen.getByText('尚未報名')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '前往報名' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '觀局雅集' })).toHaveAttribute(
    'href',
    '/t/spring/me?view=bets',
  );
  expect(screen.getByRole('link', { name: '管理賽事' })).toHaveAttribute('href', '/judge');
  expect(screen.queryByText('密碼登入')).not.toBeInTheDocument();
});
