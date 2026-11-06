import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import catalog from '../../../public/loadout/data/catalog.json';
import { PersonalArmory } from './PersonalArmory';
import { SelectedLoadout } from '../signup/SelectedLoadout';
import { MatchStatus } from '../../lib/api/gen/hestia/activity/v1/common_pb';
const api = vi.hoisted(() => ({ push: vi.fn(), getMatchHandicaps: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: api.push }) }));
vi.mock('../../lib/api/activity', () => ({
  activityApi: { handicap: { getMatchHandicaps: api.getMatchHandicaps } },
}));
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  history.replaceState(null, '', '/');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(catalog) }),
  );
});
afterEach(() => vi.unstubAllGlobals());
function savedRole() {
  localStorage.setItem(
    'lunjian.loadout.v3',
    JSON.stringify({
      v: 3,
      roles: [{ id: 1, name: '雙武器方案', data: { build: catalog.builds[0]!.key } }],
    }),
  );
  history.replaceState(null, '', '/?loadoutRole=1');
}
it('shows an empty wireframe without invented BP and offers the armory entry', () => {
  render(<PersonalArmory slug="s" memberId="m" />);
  for (const name of ['武學', '心法', '奇術']) {
    expect(screen.getByRole('heading', { name })).toBeInTheDocument();
  }
  expect(screen.getByText('主武器')).toBeInTheDocument();
  expect(screen.getByText('副武器')).toBeInTheDocument();
  expect(screen.getByText('尚未配對')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '編輯個人武庫 ↗' })).toHaveAttribute(
    'href',
    '/loadout?t=s&returnTo=member',
  );
  expect(api.getMatchHandicaps).not.toHaveBeenCalled();
});
it('returns a configured member to enrollment with the chosen loadout', async () => {
  savedRole();
  render(<PersonalArmory slug="s" memberId="m" />);
  await userEvent.click(await screen.findByRole('button', { name: '使用此武庫報名' }));
  expect(api.push).toHaveBeenCalledWith('/t/s/enroll?loadoutRole=1');
});
it('keeps an unsuccessful save pending and displays the failure', async () => {
  savedRole();
  const save = vi.fn().mockRejectedValue(new Error('比賽已開始'));
  render(<SelectedLoadout compact slug="s" memberId="m" onConfirm={save} />);
  await userEvent.click(await screen.findByRole('button', { name: '使用此武庫，確認' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('比賽已開始');
  expect(screen.queryByText('參賽配置已確認更新')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '使用此武庫，確認' })).toBeEnabled();
});
it('keeps personal editing accessible while a competition snapshot is locked', async () => {
  savedRole();
  render(<SelectedLoadout compact locked slug="s" memberId="m" />);
  await screen.findByText('本屆參賽配置已鎖定');
  expect(screen.queryByRole('combobox', { name: '武庫方案' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '編輯個人武庫 ↗' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '使用此武庫，確認' })).not.toBeInTheDocument();
});
it('shows only the current player budget, never an opponent budget', async () => {
  api.getMatchHandicaps.mockResolvedValue({
    handicaps: {
      status: MatchStatus.READY,
      constrainedPlayerPublicId: 'other',
      budget: { playerPublicId: 'me', remaining: 12n },
    },
  });
  const { rerender } = render(
    <PersonalArmory slug="s" memberId="m" playerId="me" matchId="match1" />,
  );
  await screen.findByText('12');
  api.getMatchHandicaps.mockResolvedValue({
    handicaps: {
      status: MatchStatus.READY,
      constrainedPlayerPublicId: 'me',
      budget: { playerPublicId: 'other', remaining: 24n },
    },
  });
  rerender(<PersonalArmory slug="s" memberId="m" playerId="me" matchId="match1" revision={1} />);
  await waitFor(() => expect(screen.getByText('受讓武方')).toBeInTheDocument());
  expect(screen.queryByText('24')).not.toBeInTheDocument();
});
