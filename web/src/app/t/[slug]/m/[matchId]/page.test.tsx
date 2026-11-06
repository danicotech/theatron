import { expect, it, vi } from 'vitest';
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(url);
  }),
);
vi.mock('next/navigation', () => ({ redirect }));
import Page from './page';
it('old match links return to the selected match inside the arena', async () => {
  await expect(
    Page({
      params: Promise.resolve({ slug: 's', matchId: 'm/1' }),
      searchParams: Promise.resolve({ player: 'p/2' }),
    }),
  ).rejects.toThrow('/?match=m%2F1&panel=markets&player=p%2F2#duel');
});
