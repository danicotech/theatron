import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { PlayerLogin } from '../signup/PlayerLogin';
import { MemberRegistration } from '../signup/MemberRegistration';
import { MemberAccess } from './MemberAccess';
import { DiscordAccess } from './DiscordAccess';

const api = vi.hoisted(() => ({
  loginMember: vi.fn(),
  registerMember: vi.fn(),
  getMember: vi.fn(),
  login: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
}));
vi.mock('../../lib/api/client', () => ({ platformApi: { auth: api } }));
vi.mock('../../lib/api/activity', () => ({ activityApi: { signup: { login: api.login } } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: api.replace, push: api.push }) }));
const next = '/t/spring/enroll';
beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
});

it.each([false, true])(
  'password login returns directly to enrollment, admin=%s',
  async (canManage) => {
    api.loginMember.mockResolvedValue({ member: { canManage } });
    render(<PlayerLogin slug="spring" next={next} />);
    await userEvent.type(screen.getByLabelText('帳號'), 'flow_test');
    await userEvent.type(screen.getByLabelText('密碼'), 'Flow-test-2026');
    await userEvent.click(screen.getByRole('button', { name: '登入' }));
    await waitFor(() => expect(api.replace).toHaveBeenCalledExactlyOnceWith(next));
    expect(api.push).not.toHaveBeenCalled();
    expect(api.getMember).not.toHaveBeenCalled();
    expect(api.login).not.toHaveBeenCalled();
  },
);

it('registration automatically returns to enrollment without a second login or member page', async () => {
  api.registerMember.mockResolvedValue({ member: { publicId: 'new' } });
  render(<MemberRegistration slug="spring" next={next} />);
  await userEvent.type(screen.getByLabelText('Email'), 'flow@example.com');
  await userEvent.type(screen.getByLabelText('帳號'), 'flow_test');
  await userEvent.type(screen.getByLabelText('密碼'), 'Flow-test-2026');
  await userEvent.click(screen.getByRole('button', { name: '註冊並登入' }));
  await waitFor(() => expect(api.replace).toHaveBeenCalledExactlyOnceWith(next));
  expect(api.loginMember).not.toHaveBeenCalled();
  expect(api.push).not.toHaveBeenCalled();
});

it.each(['login', 'signup'] as const)(
  '%s keeps the enrollment target for both tabs and Discord',
  (mode) => {
    render(
      <MemberAccess slug="spring" mode={mode} next={next}>
        <DiscordAccess next={next} />
      </MemberAccess>,
    );
    for (const [name, path] of [
      ['登入', 'login'],
      ['註冊', 'signup'],
    ] as const) {
      expect(screen.getByRole('link', { name })).toHaveAttribute(
        'href',
        `/t/spring/${path}?next=${encodeURIComponent(next)}`,
      );
    }
    const href = screen.getByRole('link', { name: 'Discord 快速註冊／登入' }).getAttribute('href')!;
    expect(new URL(href, 'https://arena.test').searchParams.get('redirect')).toBe(next);
  },
);

it('failed authentication stays on the form instead of redirecting', async () => {
  api.loginMember.mockRejectedValue(new Error('登入失敗'));
  render(<PlayerLogin slug="spring" next={next} />);
  await userEvent.type(screen.getByLabelText('帳號'), 'flow_test');
  await userEvent.type(screen.getByLabelText('密碼'), 'Wrong-password');
  await userEvent.click(screen.getByRole('button', { name: '登入' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(api.replace).not.toHaveBeenCalled();
});
