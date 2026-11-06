import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { ToolRoomResponseSchema, ToolPhase } from '../../lib/api/gen/hestia/activity/v1/tools_pb';
import { ToolsRoom } from './ToolsRoom';

const api = vi.hoisted(() => ({
  getMember: vi.fn(),
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
  watchRoom: vi.fn(),
}));
vi.mock('../../lib/api/client', () => ({
  platformTransport: {},
  platformApi: { auth: { getMember: api.getMember } },
}));
vi.mock('@connectrpc/connect', async (load) => ({
  ...(await load<typeof import('@connectrpc/connect')>()),
  createClient: () => api,
}));
const snapshot = create(ToolRoomResponseSchema, {
  mePublicId: 'host',
  room: {
    publicId: 'room-one',
    inviteCode: 'MDC62WF4XX',
    ownerPublicId: 'host',
    revision: 1n,
    phase: ToolPhase.LOBBY,
    participants: [{ publicId: 'host', name: '房主', active: true }],
  },
});
beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  api.getMember.mockResolvedValue({});
  api.createRoom.mockResolvedValue(snapshot);
  api.joinRoom.mockResolvedValue(snapshot);
  api.watchRoom.mockImplementation(async function* (
    _request: unknown,
    { signal }: { signal: AbortSignal },
  ) {
    yield snapshot;
    await new Promise<void>((resolve) =>
      signal.addEventListener('abort', () => resolve(), { once: true }),
    );
  });
});
it('explains missing name and focuses it instead of silently disabling join', async () => {
  const user = userEvent.setup();
  render(<ToolsRoom initialCode="MDC62WF4XX" />);
  await user.click(screen.getByRole('button', { name: '加入房間' }));
  expect(screen.getByRole('alert')).toHaveTextContent('請先填寫你的稱呼');
  expect(screen.getByLabelText('你的稱呼（必填）')).toHaveFocus();
  expect(api.joinRoom).not.toHaveBeenCalled();
});
it('prefills the member name and joins with a normalized code', async () => {
  api.getMember.mockResolvedValue({ member: { displayName: '另一位會員' } });
  const user = userEvent.setup();
  render(<ToolsRoom />);
  await waitFor(() => expect(screen.getByLabelText('你的稱呼（必填）')).toHaveValue('另一位會員'));
  await user.type(screen.getByLabelText('邀請碼'), ' mdc62wf4xx ');
  await user.click(screen.getByRole('button', { name: '加入房間' }));
  expect(api.joinRoom).toHaveBeenCalledWith({ inviteCode: 'MDC62WF4XX', name: '另一位會員' });
  expect(await screen.findByText('已同步')).toBeInTheDocument();
});
it('reports an invalid invitation code before calling the server', async () => {
  const user = userEvent.setup();
  render(<ToolsRoom />);
  await user.type(screen.getByLabelText('你的稱呼（必填）'), '訪客');
  await user.type(screen.getByLabelText('邀請碼'), '123');
  await user.click(screen.getByRole('button', { name: '加入房間' }));
  expect(screen.getByRole('alert')).toHaveTextContent('10 碼');
  expect(screen.getByLabelText('邀請碼')).toHaveFocus();
  expect(api.joinRoom).not.toHaveBeenCalled();
});
it('provides separate repeatable copy link and copy code actions', async () => {
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  render(<ToolsRoom initialRoom="room-one" />);
  await user.click(await screen.findByRole('button', { name: '複製連結' }));
  expect(write).toHaveBeenLastCalledWith(`${location.origin}/tools?code=MDC62WF4XX`);
  expect(screen.getByText('連結已複製')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '複製代碼' }));
  expect(write).toHaveBeenLastCalledWith('MDC62WF4XX');
  expect(screen.getByText('代碼已複製')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '複製連結' })).toBeEnabled();
});
it('returns to join form for an expired room identity instead of retrying forever', async () => {
  api.watchRoom.mockImplementation(async function* () {
    await Promise.reject(new ConnectError('expired', Code.Unauthenticated));
    yield snapshot;
  });
  render(<ToolsRoom initialRoom="room-one" initialCode="MDC62WF4XX" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('房間身分已失效');
  expect(screen.getByRole('button', { name: '加入房間' })).toBeEnabled();
  expect(api.watchRoom).toHaveBeenCalledTimes(1);
});
