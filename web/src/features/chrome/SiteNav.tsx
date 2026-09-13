'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import styles from './SiteNav.module.css';

/**
 * 全站固定導覽列。
 *
 * 借的是 kage 的規矩:透明地浮在頁首,捲過 24px 才出現一層霧面底,往下捲就
 * 讓路、往上捲才回來。理由不是好看 —— 對戰表與商店是長頁,一條永遠佔著
 * 72px 的橫條在手機上是拿走六分之一的螢幕;讓路之後想回去只要往上捲一下。
 *
 * 連結由 NEXT_PUBLIC_TOURNAMENT_SLUG 決定:theatron 是逐活動的前端,「現在是
 * 哪一屆」是部署設定。沒設定就只剩字標,不給會 404 的連結。
 *
 * 這個元件也會出現在首頁上,所以它不能假設頁面有任何東西 —— 自己量、自己收。
 */

const slug = process.env.NEXT_PUBLIC_TOURNAMENT_SLUG ?? '';

interface NavLink {
  href: string;
  label: string;
  /** 只有完全相同的路徑才算在這一頁(賽事首頁是其他頁的前綴,不能用前綴比)。 */
  exact?: boolean;
}

const LINKS: NavLink[] =
  slug === ''
    ? []
    : [
        { href: `/t/${slug}`, label: '賽事', exact: true },
        { href: `/t/${slug}/bracket`, label: '對戰表' },
        { href: `/t/${slug}/rules`, label: '規則' },
        { href: `/t/${slug}/bets`, label: '注單' },
        { href: `/judge/${slug}`, label: '裁判台' },
      ];

/** 捲過這個距離才鋪霧面底:頁首本來就設計成透明,一動就變色會閃。 */
const STUCK_AFTER = 24;

function isActive(link: NavLink, pathname: string): boolean {
  if (link.exact === true) return pathname === link.href;
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

export function SiteNav() {
  const pathname = usePathname();
  const [stuck, setStuck] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetId = useId();

  // 捲動方向。不用 state 存上一次的 scrollY:每次捲動都 setState 會讓整個
  // 導覽列在捲動時不停重繪,而它只在跨過門檻、換方向的那一刻需要重繪。
  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        setStuck(y > STUCK_AFTER);
        // 頂部附近永遠露出來;往下捲超過一條導覽列的高度才讓路。
        setHidden(y > last && y > STUCK_AFTER * 3);
        last = y;
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // 換頁就收起選單;不然點了連結,頁換了、選單還蓋在上面。
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const close = useCallback(() => {
    setOpen(false);
    burgerRef.current?.focus();
  }, []);

  // 選單開著:鎖住底下的捲動、Escape 關閉、焦點進到第一個連結。
  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    sheetRef.current?.querySelector('a')?.focus();
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const classes = [styles.bar];
  if (stuck) classes.push(styles.stuck);
  // 選單開著時導覽列不能讓路 —— 關閉鈕在上面。
  if (hidden && !open) classes.push(styles.hide);

  return (
    <header className={classes.join(' ')}>
      <nav className={styles.nav} aria-label="全站導覽">
        <Link className={styles.brand} href="/">
          <b className={styles.wordmark}>百業試鋒</b>
          <i className={styles.sub}>BAIYE SHIFENG · 讓武 BP</i>
        </Link>

        {LINKS.length === 0 ? null : (
          <>
            <ul className={styles.links}>
              {LINKS.map((l) => {
                const on = isActive(l, pathname);
                return (
                  <li key={l.href}>
                    <Link
                      className={[styles.link, on ? styles.on : ''].join(' ')}
                      href={l.href}
                      aria-current={on ? 'page' : undefined}
                    >
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <button
              ref={burgerRef}
              type="button"
              className={styles.burger}
              aria-label={open ? '關閉選單' : '開啟選單'}
              aria-expanded={open}
              aria-controls={sheetId}
              onClick={() => {
                if (open) close();
                else setOpen(true);
              }}
            >
              <i aria-hidden="true" />
              <i aria-hidden="true" />
            </button>
          </>
        )}
      </nav>

      {LINKS.length === 0 ? null : (
        <div
          ref={sheetRef}
          id={sheetId}
          className={[styles.sheet, open ? styles.sheetOpen : ''].join(' ')}
          aria-hidden={!open}
          inert={!open}
        >
          {/* 點空白處也能關:手機上拇指離關閉鈕很遠。 */}
          <button
            type="button"
            className={styles.scrim}
            aria-label="關閉選單"
            tabIndex={-1}
            onClick={close}
          />
          <nav className={styles.panel} aria-label="全站導覽(選單)">
            <ul className={styles.sheetLinks}>
              {LINKS.map((l) => {
                const on = isActive(l, pathname);
                return (
                  <li key={l.href}>
                    <Link
                      className={[styles.sheetLink, on ? styles.on : ''].join(' ')}
                      href={l.href}
                      aria-current={on ? 'page' : undefined}
                    >
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
}
