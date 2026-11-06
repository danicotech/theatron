import catalog from '../../../public/loadout/data/catalog.json';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { MemberProfileSchema } from '../../lib/api/gen/hestia/platform/v1/auth_pb';
import { SignupForm } from './SignupForm';
import { MemberRegistration } from './MemberRegistration';
import { PlayerLogin } from './PlayerLogin';
import { SelectedLoadout } from './SelectedLoadout';
const api = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  listRanks: vi.fn(),
  registerMember: vi.fn(),
  loginMember: vi.fn(),
  getMember: vi.fn(),
  push: vi.fn(),
}));
vi.mock('../../lib/api/activity', () => ({
  activityApi: {
    signup: { register: api.register, login: api.login },
    tournament: { listRanks: api.listRanks },
  },
}));
vi.mock('../../lib/api/client', () => ({
  platformApi: {
    auth: {
      registerMember: api.registerMember,
      loginMember: api.loginMember,
      getMember: api.getMember,
    },
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: api.push, replace: api.push }) }));
const member = create(MemberProfileSchema, {
  publicId: 'member-1',
  displayName: '夜鴉',
  discordUsername: 'raven',
});
beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  localStorage.clear();
  sessionStorage.clear();
  history.replaceState(null, '', '/');
  localStorage.setItem(
    'lunjian.loadout.v3',
    JSON.stringify({
      v: 3,
      roles: [
        { id: 1, name: '雙武器方案', data: { build: catalog.builds[0]!.key } },
        { id: 2, name: '備用方案', data: { build: catalog.builds[1]!.key } },
      ],
    }),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(catalog) }),
  );
  api.listRanks.mockResolvedValue({ ranks: [] });
  api.register.mockResolvedValue({ player: { displayName: '夜鴉' } });
  api.registerMember.mockResolvedValue({ member });
  api.loginMember.mockResolvedValue({ member });
  api.getMember.mockResolvedValue({ member });
  api.login.mockResolvedValue({});
});
afterEach(() => vi.unstubAllGlobals());
async function confirmRole() {
  await userEvent.click(await screen.findByRole('button', { name: /雙武器方案/ }));
  await userEvent.click(screen.getByRole('button', { name: '使用此武庫，確認' }));
}
it('registration sends email, account and raw password then returns to enrollment', async () => {
  render(<MemberRegistration slug="s" />);
  expect(screen.getByLabelText('密碼')).toHaveAttribute('minlength', '8');
  expect(screen.getByLabelText('密碼')).toHaveAccessibleDescription('至少 8 個字元。');
  expect(screen.queryByLabelText('遊戲 ID')).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Email'), 'raven@example.com');
  await userEvent.type(screen.getByLabelText('帳號'), 'raven');
  await userEvent.type(screen.getByLabelText('密碼'), '  CaseSensitive-2026  ');
  await userEvent.click(screen.getByRole('button', { name: '註冊並登入' }));
  expect(api.registerMember).toHaveBeenCalledWith({
    displayName: 'raven',
    discordUsername: 'raven',
    email: 'raven@example.com',
    password: '  CaseSensitive-2026  ',
  });
  expect(api.register).not.toHaveBeenCalled();
  expect(api.push).toHaveBeenCalledWith('/t/s/enroll');
});
it('new member login continues to enrollment when no registration exists', async () => {
  api.login.mockRejectedValue(new ConnectError('not enrolled', Code.NotFound));
  render(<PlayerLogin slug="s" />);
  await userEvent.type(screen.getByLabelText('帳號'), '@raven');
  await userEvent.type(screen.getByLabelText('密碼'), 'CaseSensitive-2026');
  await userEvent.click(screen.getByRole('button', { name: '登入' }));
  expect(api.login).toHaveBeenCalledWith({ tournamentSlug: 's' });
  expect(api.push).toHaveBeenCalledWith('/t/s/enroll');
});
it('requires explicit loadout confirmation before personal enrollment', async () => {
  render(<SignupForm slug="s" member={member} onDone={vi.fn()} />);
  expect(screen.queryByLabelText('遊戲 ID')).not.toBeInTheDocument();
  await userEvent.click(await screen.findByRole('button', { name: /雙武器方案/ }));
  expect(screen.queryByLabelText('遊戲 ID')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '使用此武庫，確認' }));
  expect(screen.getByLabelText('遊戲 ID')).toBeInTheDocument();
  expect(screen.queryByLabelText('論劍積分')).not.toBeInTheDocument();
  expect(screen.getByLabelText('常用武學').tagName).toBe('SELECT');
});
it('returning from the weapon library requires confirmation even with an existing enrollment', async () => {
  history.replaceState(null, '', '/?loadoutRole=2');
  const onConfirm = vi.fn();
  const { container } = render(
    <SelectedLoadout
      slug="s"
      memberId="member-1"
      defaults={{ style: '原流派', weapon: '原武器', equipment: '', arts: '' }}
      onConfirm={onConfirm}
      returnTarget="member"
    />,
  );
  const confirm = await screen.findByRole('button', { name: '使用此武庫，確認' });
  expect(container.querySelector('input[name="loadoutPending"]')).toHaveValue('true');
  expect(container.querySelector('input[name="characterStyle"]')).toHaveValue('原流派');
  expect(onConfirm).not.toHaveBeenCalled();
  await userEvent.click(confirm);
  expect(container.querySelector('input[name="loadoutPending"]')).toHaveValue('false');
  expect(container.querySelector('input[name="characterStyle"]')).toHaveValue(
    catalog.builds[1]!.name,
  );
  expect(onConfirm).toHaveBeenCalledOnce();
});
it('submits chosen loadout, martial and multiple calendar ranges together', async () => {
  const onDone = vi.fn();
  render(<SignupForm slug="s" member={member} onDone={onDone} rulesVersion="v1" />);
  await confirmRole();
  await userEvent.type(screen.getByLabelText('遊戲 ID'), 'game-raven');
  await screen.findByRole('option', { name: catalog.martials[0]!.name });
  await userEvent.selectOptions(screen.getByLabelText('常用武學'), catalog.martials[0]!.name);
  await userEvent.selectOptions(screen.getByLabelText('論劍段位'), '飛花');
  await userEvent.click(screen.getByRole('button', { name: '＋ 新增時段' }));
  fireEvent.change(screen.getByLabelText('日期 1'), { target: { value: '2026-11-01' } });
  fireEvent.change(screen.getByLabelText('開始時間 1'), { target: { value: '18:00' } });
  fireEvent.change(screen.getByLabelText('結束時間 1'), { target: { value: '20:00' } });
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: '確認報名' }));
  expect(api.register).toHaveBeenCalledWith(
    expect.objectContaining({
      displayName: '夜鴉',
      discordName: 'raven',
      ladderRank: '飛花',
      ladderScore: 0,
      artsNote: catalog.martials[0]!.name,
      availabilityNote: '2026-11-01 18:00–20:00',
    }),
  );
  const sent = api.register.mock.lastCall?.[0] as {
    character: { style: string; weapon: string; snapshotJson: string };
  };
  expect(sent.character.style).toBe(catalog.builds[0]!.name);
  expect(sent.character.weapon).toContain('主');
  expect(JSON.parse(sent.character.snapshotJson)).toMatchObject({
    version: 1,
    preview: { style: [{ name: catalog.builds[0]!.name }] },
  });
  expect(onDone).toHaveBeenCalledWith('夜鴉', 'game-raven');
});
it('changing the loadout requires confirmation again before submission', async () => {
  render(<SignupForm slug="s" member={member} onDone={vi.fn()} />);
  await confirmRole();
  await userEvent.type(screen.getByLabelText('遊戲 ID'), 'raven');
  await userEvent.click(screen.getByRole('button', { name: /備用方案/ }));
  await userEvent.click(screen.getByRole('button', { name: '確認報名' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('請先確認');
  expect(api.register).not.toHaveBeenCalled();
});
it('rejects partially entered time ranges without submitting', async () => {
  render(<SignupForm slug="s" member={member} onDone={vi.fn()} />);
  await confirmRole();
  await userEvent.type(screen.getByLabelText('遊戲 ID'), 'raven');
  await userEvent.click(screen.getByRole('button', { name: '＋ 新增時段' }));
  fireEvent.change(screen.getByLabelText('日期 1'), { target: { value: '2026-11-01' } });
  await userEvent.click(screen.getByRole('button', { name: '確認報名' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('請完整選擇');
  expect(api.register).not.toHaveBeenCalled();
});
