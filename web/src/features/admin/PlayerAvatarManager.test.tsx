import { create } from '@bufbuild/protobuf';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PlayerSchema } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { PlayerAvatarManager } from './PlayerAvatarManager';
const api = vi.hoisted(() => ({
  listUnranked: vi.fn(),
  setPlayerAvatar: vi.fn(),
  reconnect: vi.fn(),
}));
vi.mock('../../lib/api/activity', () => ({ activityApi: { judge: api } }));
vi.mock('../realtime/useTournamentRealtime', () => ({
  useTournamentRealtime: () => ({ revision: 1 }),
}));
vi.mock('../realtime/tournamentRealtime', () => ({
  tournamentRealtime: () => ({ reconnect: api.reconnect }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  api.listUnranked.mockResolvedValue({
    players: [
      {
        player: create(PlayerSchema, { publicId: 'p1', displayName: '測試選手', gameId: 'game-1' }),
      },
    ],
  });
  api.setPlayerAvatar.mockResolvedValue({});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('shows a neutral placeholder and never uploads merely from choosing a file', async () => {
  const bitmap = { width: 512, height: 256, close: vi.fn() };
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  const blob = new Blob(['jpeg'], { type: 'image/jpeg' });
  Object.defineProperty(blob, 'arrayBuffer', {
    value: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(blob));
  URL.createObjectURL = vi.fn().mockReturnValue('blob:preview');
  URL.revokeObjectURL = vi.fn();
  render(<PlayerAvatarManager slug="test" />);
  expect(await screen.findByText('未提供')).toBeInTheDocument();
  await userEvent.upload(
    screen.getByLabelText('選擇測試選手的遊戲頭像'),
    new File(['original'], 'avatar.png', { type: 'image/png' }),
  );
  expect(await screen.findByText(/預覽：/)).toBeInTheDocument();
  expect(api.setPlayerAvatar).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: '儲存頭像' }));
  await waitFor(() =>
    expect(api.setPlayerAvatar).toHaveBeenCalledWith({
      playerPublicId: 'p1',
      image: new Uint8Array([1, 2, 3]),
    }),
  );
  expect(await screen.findByRole('status')).toHaveTextContent('已儲存頭像');
  expect(api.reconnect).toHaveBeenCalled();
  expect(bitmap.close).toHaveBeenCalled();
});
it('preserves the avatar and reports failed removals', async () => {
  api.listUnranked.mockResolvedValue({
    players: [
      {
        player: create(PlayerSchema, {
          publicId: 'p1',
          displayName: '測試選手',
          gameAvatarUrl: '/api/activity/avatars/p1/' + 'a'.repeat(64),
        }),
      },
    ],
  });
  api.setPlayerAvatar.mockRejectedValue(new Error('儲存失敗'));
  render(<PlayerAvatarManager slug="test" />);
  await userEvent.click(await screen.findByRole('button', { name: '移除頭像' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('儲存失敗');
  expect(api.reconnect).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '移除頭像' })).toBeEnabled();
});
