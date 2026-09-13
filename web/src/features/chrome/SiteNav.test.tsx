import { expectNoAxeViolations } from '@theatron/ui/testing';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ pathname: '/t/s' }));

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
}));

// 連結在模組載入時就由環境變數算好(那是部署設定,不是狀態),
// 所以要先設環境再載入模組;每個測試各自載一次,才能測「沒設定」的情況。
async function loadNav(slug: string) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_TOURNAMENT_SLUG', slug);
  const mod = await import('./SiteNav');
  return mod.SiteNav;
}

function setScrollY(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true });
}

describe('SiteNav', () => {
  beforeEach(() => {
    nav.pathname = '/t/s';
    setScrollY(0);
    // 捲動處理用 rAF 節流;測試裡直接跑,不等下一格。
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    document.body.style.overflow = '';
  });

  it('連結由賽事代號組出來', async () => {
    const SiteNav = await loadNav('s');
    render(<SiteNav />);
    const bar = screen.getByRole('navigation', { name: '全站導覽' });
    expect(within(bar).getByRole('link', { name: '賽事' })).toHaveAttribute('href', '/t/s');
    expect(within(bar).getByRole('link', { name: '對戰表' })).toHaveAttribute(
      'href',
      '/t/s/bracket',
    );
    expect(within(bar).getByRole('link', { name: '規則' })).toHaveAttribute('href', '/t/s/rules');
    expect(within(bar).getByRole('link', { name: '注單' })).toHaveAttribute('href', '/t/s/bets');
    expect(within(bar).getByRole('link', { name: '裁判台' })).toHaveAttribute('href', '/judge/s');
  });

  // 給一個會 404 的連結比不給更糟。
  it('沒有賽事代號就只剩字標', async () => {
    const SiteNav = await loadNav('');
    render(<SiteNav />);
    expect(screen.getByRole('link', { name: /劍塚/ })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('link', { name: '對戰表' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('現在這一頁帶 aria-current;賽事首頁是其他頁的前綴,不能誤判', async () => {
    nav.pathname = '/t/s/bracket';
    const SiteNav = await loadNav('s');
    render(<SiteNav />);
    const bar = screen.getByRole('navigation', { name: '全站導覽' });
    expect(within(bar).getByRole('link', { name: '對戰表' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(bar).getByRole('link', { name: '賽事' })).not.toHaveAttribute('aria-current');
  });

  it('場次頁算在對戰表底下,裁判場次頁算在裁判台底下', async () => {
    nav.pathname = '/judge/s/m/abc';
    const SiteNav = await loadNav('s');
    render(<SiteNav />);
    const bar = screen.getByRole('navigation', { name: '全站導覽' });
    expect(within(bar).getByRole('link', { name: '裁判台' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('漢堡開關選單:aria-expanded、Escape 關閉、焦點回到漢堡、捲動鎖住', async () => {
    const user = userEvent.setup();
    const SiteNav = await loadNav('s');
    render(<SiteNav />);
    const burger = screen.getByRole('button', { name: '開啟選單' });
    expect(burger).toHaveAttribute('aria-expanded', 'false');
    const sheetId = burger.getAttribute('aria-controls');
    expect(sheetId).not.toBeNull();

    await user.click(burger);
    expect(burger).toHaveAttribute('aria-expanded', 'true');
    expect(document.body.style.overflow).toBe('hidden');
    const sheet = document.getElementById(sheetId!)!;
    expect(sheet).toHaveAttribute('aria-hidden', 'false');
    // 焦點進到選單裡的第一個連結。
    expect(document.activeElement).toBe(within(sheet).getAllByRole('link')[0]);

    await user.keyboard('{Escape}');
    expect(burger).toHaveAttribute('aria-expanded', 'false');
    expect(sheet).toHaveAttribute('aria-hidden', 'true');
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(burger);
  });

  it('捲過 24px 才鋪霧面底;往下捲讓路、往上捲回來', async () => {
    const SiteNav = await loadNav('s');
    const { container } = render(<SiteNav />);
    const bar = container.querySelector('header')!;
    expect(bar.className).not.toContain('stuck');

    act(() => {
      setScrollY(100);
      window.dispatchEvent(new Event('scroll'));
    });
    await waitFor(() => {
      expect(bar.className).toContain('stuck');
    });
    expect(bar.className).toContain('hide');

    act(() => {
      setScrollY(60);
      window.dispatchEvent(new Event('scroll'));
    });
    await waitFor(() => {
      expect(bar.className).not.toContain('hide');
    });
    expect(bar.className).toContain('stuck');

    act(() => {
      setScrollY(0);
      window.dispatchEvent(new Event('scroll'));
    });
    await waitFor(() => {
      expect(bar.className).not.toContain('stuck');
    });
  });

  it('沒有無障礙違規', async () => {
    const SiteNav = await loadNav('s');
    const { container } = render(<SiteNav />);
    await expectNoAxeViolations(container);
  });
});
