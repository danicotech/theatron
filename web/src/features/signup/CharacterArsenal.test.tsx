import { create } from '@bufbuild/protobuf';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@theatron/ui/testing';
import catalog from '../../../public/loadout/data/catalog.json';
import { CharacterConfigSchema } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { CharacterArsenal } from './CharacterArsenal';
afterEach(() => vi.unstubAllGlobals());
it('keeps legacy configuration intact and allows catalog multi-selection without editing other fields', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(catalog) }),
  );
  const { container } = render(
    <form>
      <CharacterArsenal
        defaults={create(CharacterConfigSchema, {
          style: '舊流派',
          weapon: '劍',
          equipment: '既有裝備與數值',
          arts: '已保存的完整武學筆記',
        })}
      />
    </form>,
  );
  const values = () => new FormData(container.querySelector('form')!);
  expect(values().get('characterArts')).toBe('已保存的完整武學筆記');
  expect(container.querySelector('textarea')).toBeNull();
  const trigger = screen.getByRole('button', { name: '從武庫選擇武器' });
  await userEvent.click(trigger);
  await userEvent.click(await screen.findByRole('button', { name: '槍' }));
  expect(values().get('characterWeapon')).toBe('劍、槍');
  await userEvent.click(screen.getByRole('button', { name: '劍' }));
  expect(values().get('characterWeapon')).toBe('槍');
  expect(values().get('characterEquipment')).toBe('既有裝備與數值');
  await userEvent.keyboard('{Escape}');
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole('region', { name: '武器武庫' })).not.toBeInTheDocument();
});
it('supports retry, category selection and clearing while preserving data during loading failure', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ ok: false })
    .mockResolvedValue({ ok: true, json: () => Promise.resolve(catalog) });
  vi.stubGlobal('fetch', fetcher);
  const { container } = render(
    <form>
      <CharacterArsenal />
    </form>,
  );
  await userEvent.click(screen.getByRole('button', { name: '從武庫選擇武學' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('武庫暫時無法讀取');
  await userEvent.click(screen.getByRole('button', { name: '重新讀取' }));
  await userEvent.click(await screen.findByRole('button', { name: '十方破陣' }));
  await userEvent.click(screen.getByRole('button', { name: '心法' }));
  await userEvent.click(screen.getByRole('button', { name: catalog.minds[0]!.name }));
  expect(new FormData(container.querySelector('form')!).get('characterArts')).toBe(
    '十方破陣、' + catalog.minds[0]!.name,
  );
  await userEvent.click(screen.getByRole('button', { name: '清除武學' }));
  expect(new FormData(container.querySelector('form')!).get('characterArts')).toBe('');
  await expectNoAxeViolations(container);
});

it('shows the catalog weapon pair and applies both on style selection without clearing equipment or arts', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(catalog) }),
  );
  const { container } = render(
    <form>
      <CharacterArsenal
        defaults={create(CharacterConfigSchema, { equipment: '既有裝備', arts: '既有心法' })}
      />
    </form>,
  );
  await userEvent.click(screen.getByRole('button', { name: '從武庫選擇流派' }));
  const style = await screen.findByRole('button', { name: '裂石鈞' });
  expect(style).toHaveAccessibleDescription('陌刀・橫刀');
  expect(screen.getByRole('button', { name: '破竹樽' })).toBeDisabled();
  await userEvent.click(style);
  let form = new FormData(container.querySelector('form')!);
  expect(form.get('characterWeapon')).toBe('陌刀、橫刀');
  await userEvent.click(screen.getByRole('button', { name: '牽絲玉' }));
  form = new FormData(container.querySelector('form')!);
  expect(form.get('characterWeapon')).toBe('傘、扇');
  expect(form.get('characterEquipment')).toBe('既有裝備');
  expect(form.get('characterArts')).toBe('既有心法');
});
