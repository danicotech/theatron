import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MartialSelect } from './MartialSelect';
afterEach(() => vi.unstubAllGlobals());
it('keeps saved martial selected when its temporary option is replaced by loaded catalog', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ martials: [{ name: '無名劍法' }, { name: '斬雪刀法' }] }),
    }),
  );
  render(<MartialSelect defaultValue="無名劍法" />);
  expect(screen.getByRole('combobox', { name: '常用武學' })).toHaveValue('無名劍法');
  await screen.findByRole('option', { name: '斬雪刀法' });
  expect(screen.getByRole('combobox', { name: '常用武學' })).toHaveValue('無名劍法');
});
