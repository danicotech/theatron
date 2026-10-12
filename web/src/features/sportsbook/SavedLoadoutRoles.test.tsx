import { readFileSync } from 'node:fs';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SavedLoadoutRoles } from './SavedLoadoutRoles';
import { loadoutStorageKey } from './registrationRolesRuntime.js';
const catalog = JSON.parse(readFileSync('web/public/loadout/data/catalog.json', 'utf8')) as {
  builds: { key: string }[];
};
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    loadoutStorageKey('e', 'u'),
    JSON.stringify({
      v: 3,
      roles: [{ id: 1, name: '雪客', data: { v: 3, build: catalog.builds[0]!.key } }],
    }),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(catalog) }),
  );
});
afterEach(() => vi.unstubAllGlobals());
it('回程只套用同一活動會員指定的角色，不提交報名；回程參數只使用一次', async () => {
  history.replaceState(null, '', '/?sportsEvent=e&artsUser=u&loadoutRole=1#register');
  const onApply = vi.fn();
  render(<SavedLoadoutRoles eventId="e" userId="u" onApply={onApply} onEdit={vi.fn()} />);
  await waitFor(() => expect(onApply).toHaveBeenCalledOnce());
  expect(onApply.mock.calls[0]![0]).toMatchObject({ name: '雪客', character: { equipment: '無' } });
  expect(location.search).toBe('?sportsEvent=e');
  fireEvent(window, new Event('storage'));
  await screen.findByRole('button', { name: /雪客.*套用角色/ });
  expect(onApply).toHaveBeenCalledOnce();
});
it('其他會員的回程不自動套用，但本人可主動選擇自己的角色', async () => {
  history.replaceState(null, '', '/?sportsEvent=e&artsUser=other&loadoutRole=1#register');
  const onApply = vi.fn();
  render(<SavedLoadoutRoles eventId="e" userId="u" onApply={onApply} onEdit={vi.fn()} />);
  const role = await screen.findByRole('button', { name: /雪客.*套用角色/ });
  expect(onApply).not.toHaveBeenCalled();
  fireEvent.click(role);
  expect(onApply).toHaveBeenCalledOnce();
});
it('未完成角色直接前往編輯，不套入空白欄位', async () => {
  history.replaceState(null, '', '/');
  localStorage.setItem(
    loadoutStorageKey('e', 'u'),
    JSON.stringify({ v: 3, roles: [{ id: 2, name: '待備戰', data: { v: 3 } }] }),
  );
  const onApply = vi.fn(),
    onEdit = vi.fn();
  render(<SavedLoadoutRoles eventId="e" userId="u" onApply={onApply} onEdit={onEdit} />);
  fireEvent.click(await screen.findByRole('button', { name: /待備戰/ }));
  expect(onApply).not.toHaveBeenCalled();
  expect(onEdit).toHaveBeenCalledOnce();
});
