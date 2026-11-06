import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import catalog from '../../../public/loadout/data/catalog.json';
import { SelectedLoadout } from './SelectedLoadout';
afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});
it('keeps a confirmed return saved through phase refresh and removes the consumed handoff', async () => {
  window.history.replaceState(null, '', '/t/s/me?view=character&loadoutRole=1');
  localStorage.setItem(
    'lunjian.loadout.v3',
    JSON.stringify({
      v: 3,
      roles: [{ id: 1, name: '新方案', data: { build: catalog.builds[0]!.key } }],
    }),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(catalog) }),
  );
  const onConfirm = vi.fn().mockResolvedValue(undefined);
  const props = {
    compact: true,
    slug: 's',
    memberId: 'm',
    defaults: { style: '原流派', weapon: '原武器', equipment: '', arts: '' },
    onConfirm,
  };
  const { rerender } = render(<SelectedLoadout {...props} />);
  await screen.findByRole('heading', { name: '待確認配置' });
  await userEvent.click(screen.getByRole('button', { name: '使用此武庫，確認' }));
  await screen.findByText('參賽配置已確認更新');
  expect(location.search).not.toContain('loadoutRole');
  rerender(<SelectedLoadout {...props} locked />);
  await screen.findByText('本屆參賽配置已鎖定');
  rerender(<SelectedLoadout {...props} locked={false} />);
  await waitFor(() => expect(screen.queryByText('讀取武庫中…')).not.toBeInTheDocument());
  expect(screen.getByRole('heading', { name: '目前參賽配置' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '使用此武庫，確認' })).not.toBeInTheDocument();
  expect(onConfirm).toHaveBeenCalledTimes(1);
});
