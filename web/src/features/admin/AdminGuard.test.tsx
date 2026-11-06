import { render, screen } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import { Code, ConnectError } from '@connectrpc/connect';
import { AdminGuard } from './AdminGuard';
const getMember = vi.hoisted(() => vi.fn());
vi.mock('../../lib/api/client', () => ({ platformApi: { auth: { getMember } } }));
vi.mock('next/navigation', () => ({ usePathname: () => '/judge/spring' }));
it('blocks ordinary members before exposing administrative controls', async () => {
  getMember.mockResolvedValue({ member: { canManage: false } });
  render(
    <AdminGuard>
      <button>結束賽局</button>
    </AdminGuard>,
  );
  expect(await screen.findByText('此帳號沒有管理權限')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '結束賽局' })).not.toBeInTheDocument();
});
it('returns anonymous administrators to the requested event after Discord login', async () => {
  getMember.mockRejectedValue(new ConnectError('sign in', Code.Unauthenticated));
  render(
    <AdminGuard>
      <button>結束賽局</button>
    </AdminGuard>,
  );
  expect(await screen.findByRole('link', { name: 'Discord 快速註冊／登入' })).toHaveAttribute(
    'href',
    '/api/auth/discord/start?redirect=%2Fjudge%2Fspring',
  );
});
it('reveals controls only after the server confirms permission', async () => {
  getMember.mockResolvedValue({ member: { canManage: true } });
  render(
    <AdminGuard>
      <button>結束賽局</button>
    </AdminGuard>,
  );
  expect(await screen.findByRole('button', { name: '結束賽局' })).toBeInTheDocument();
});
