import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduleAdminBridge } from './ScheduleAdminBridge';

const api = vi.hoisted(() => ({ getMember: vi.fn() }));
vi.mock('../../lib/api/client', () => ({ platformApi: { auth: { getMember: api.getMember } } }));
vi.mock('next/dynamic', () => ({
  default: () =>
    function Editor() {
      return <div>管理內容</div>;
    },
}));

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_TOURNAMENT_SLUG', 'isolated-test');
  window.history.replaceState({}, '', '/');
  document.body.innerHTML =
    '<div id="bracket-panel"><div data-schedule-mode></div><div id="schedule-editor" data-schedule-editor hidden></div><div id="bracket-host">公開賽程</div></div>';
  api.getMember.mockReset().mockResolvedValue({ member: { canManage: true } });
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  document.body.innerHTML = '';
});

describe('schedule management access', () => {
  it('switches in place and retains the public bracket', async () => {
    const user = userEvent.setup();
    render(<ScheduleAdminBridge />);
    const edit = await screen.findByRole('button', { name: '編輯賽程' });
    expect(screen.queryByText('管理內容')).not.toBeInTheDocument();
    await user.click(edit);
    expect(screen.getByText('管理內容')).toBeVisible();
    expect(document.getElementById('bracket-panel')).toHaveAttribute('data-schedule-editing');
    expect(document.getElementById('bracket-host')).toHaveTextContent('公開賽程');
    expect(window.location.pathname).toBe('/');
    await user.click(screen.getByRole('button', { name: '檢視賽程' }));
    expect(screen.queryByText('管理內容')).not.toBeInTheDocument();
    expect(document.getElementById('bracket-panel')).not.toHaveAttribute('data-schedule-editing');
  });

  it.each([false, undefined])('does not expose editing to non-managers (%s)', async (canManage) => {
    api.getMember.mockResolvedValue({ member: { canManage } });
    render(<ScheduleAdminBridge />);
    await act(async () => {});
    expect(screen.queryByRole('button', { name: '編輯賽程' })).not.toBeInTheDocument();
  });

  it('closes management after a revoked or failed permission check', async () => {
    const user = userEvent.setup();
    render(<ScheduleAdminBridge />);
    await user.click(await screen.findByRole('button', { name: '編輯賽程' }));
    api.getMember.mockRejectedValue(new Error('expired'));
    await act(async () => {
      await Promise.resolve(window.dispatchEvent(new Event('focus')));
    });
    await waitFor(() => expect(screen.queryByText('管理內容')).not.toBeInTheDocument());
    expect(document.getElementById('bracket-panel')).not.toHaveAttribute('data-schedule-editing');
  });

  it('never mounts formal controls in preview mode', async () => {
    window.history.replaceState({}, '', '/?preview=1');
    render(<ScheduleAdminBridge />);
    await act(async () => {});
    expect(api.getMember).not.toHaveBeenCalled();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
