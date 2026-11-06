import { expectNoAxeViolations } from '@theatron/ui/testing';
import { render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const nav = vi.hoisted(() => ({ pathname: '/t/s/me' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));
afterEach(() => vi.unstubAllEnvs());
async function load(slug: string) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_TOURNAMENT_SLUG', slug);
  return (await import('./SiteNav')).SiteNav;
}
it('功能頁導覽回到原論劍主站與七章，而非另一套活動頁', async () => {
  const SiteNav = await load('s');
  render(<SiteNav />);
  const bar = screen.getByRole('navigation', { name: '全站導覽' });
  const expected: [string, string][] = [
    ['夜鴉閣', '/home'],
    ['宗旨', '/#prologue'],
    ['規則說明', '/#rules'],
    ['讓武', '/#invitation'],
    ['報名', '/#register'],
    ['比武', '/#duel'],
    ['賽程', '/#schedule'],
    ['獎賞', '/#rewards'],
  ];
  for (const [label, url] of expected)
    expect(within(bar).getByRole('link', { name: label })).toHaveAttribute('href', url);
  expect(within(bar).getByRole('link', { name: '會員專區' })).toHaveAttribute('href', '/t/s/me');
  expect(screen.queryByRole('link', { name: '裁判台' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '返回賽事' })).not.toBeInTheDocument();
});
it('沒有活動代號仍可瀏覽原站七章，不輸出無效會員入口', async () => {
  const SiteNav = await load('');
  render(<SiteNav />);
  expect(screen.getAllByRole('link')).toHaveLength(8);
  expect(screen.queryByRole('link', { name: '會員專區' })).not.toBeInTheDocument();
});
it('只有會員頁標示目前會員入口', async () => {
  const SiteNav = await load('s');
  nav.pathname = '/t/s/me';
  const { rerender } = render(<SiteNav />);
  expect(screen.getByRole('link', { name: '會員專區' })).toHaveAttribute('aria-current', 'page');
  nav.pathname = '/t/s/login';
  rerender(<SiteNav />);
  expect(screen.getByRole('link', { name: '會員專區' })).not.toHaveAttribute('aria-current');
});
it('導覽具有無障礙名稱及原生連結', async () => {
  const SiteNav = await load('s');
  const { container } = render(<SiteNav />);
  await expectNoAxeViolations(container);
});
