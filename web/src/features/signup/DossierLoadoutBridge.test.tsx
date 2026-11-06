import { readFileSync } from 'node:fs';
import { act, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DossierLoadoutBridge, dossierPreview, type DossierProfile } from './DossierLoadoutBridge';
import { loadoutPreview } from './loadoutPreviewModel';
import { serializeLoadoutSnapshot } from './loadoutSnapshot';

it('renders the confirmed database snapshot without catalog, demo or local-storage substitution', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const storage = vi.spyOn(Storage.prototype, 'getItem');
  const preview = loadoutPreview(
    {},
    { style: '資料庫參賽流派', weapon: '主 確認時武器', equipment: '', arts: '奇術 神龍吐火' },
  );
  const view = render(<DossierLoadoutBridge />);
  act(() => {
    document.dispatchEvent(
      new CustomEvent('lunjian:dossier-loadout', {
        cancelable: true,
        detail: {
          host,
          character: {
            style: '舊摘要',
            weapon: '',
            equipment: '',
            arts: '',
            snapshotJson: serializeLoadoutSnapshot(preview),
          },
        },
      }),
    );
  });
  expect(screen.getByText('資料庫參賽流派')).toBeInTheDocument();
  expect(screen.getByText('確認時武器')).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
  expect(storage).not.toHaveBeenCalled();
  view.unmount();
  host.remove();
  storage.mockRestore();
  vi.unstubAllGlobals();
});

it('preserves every published demo stat and splits weapons from equipment', () => {
  const data = JSON.parse(readFileSync('web/public/lunjian/dossier-demo.json', 'utf8')) as {
    profiles: DossierProfile[];
  };
  for (const profile of data.profiles) {
    const preview = dossierPreview(profile);
    const gear = [...preview.weapon, ...preview.equipment];
    const source = profile.sections.find((s) => s.kind === 'equipment')!.items;
    expect(preview.weapon).toHaveLength(2);
    expect(preview.equipment).toHaveLength(6);
    expect(
      gear.map((item) =>
        [...item.gear!.base, ...item.gear!.affixes].map((row) => [row.name, row.value]),
      ),
    ).toEqual(source.map((item) => item.stats));
    expect(preview.martials).toHaveLength(2);
    expect(preview.minds).toHaveLength(4);
    expect(preview.arts).toHaveLength(4);
  }
});
it('uses public character data only and ignores an obsolete response after closing', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  let resolve!: (value: Response) => void;
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    ),
  );
  const storage = vi.spyOn(Storage.prototype, 'getItem');
  const view = render(<DossierLoadoutBridge />);
  const event = new CustomEvent('lunjian:dossier-loadout', {
    cancelable: true,
    detail: { host, character: { style: '裂石鈞', weapon: '', equipment: '', arts: '' } },
  });
  act(() => {
    document.dispatchEvent(event);
  });
  expect(event.defaultPrevented).toBe(true);
  expect(screen.getByRole('status')).toHaveTextContent('正在讀取配置');
  act(() => {
    document.dispatchEvent(new Event('lunjian:dossier-close'));
  });
  await act(async () => {
    resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    await Promise.resolve();
  });
  await waitFor(() => expect(host).toBeEmptyDOMElement());
  expect(storage).not.toHaveBeenCalled();
  view.unmount();
  host.remove();
  storage.mockRestore();
  vi.unstubAllGlobals();
});
