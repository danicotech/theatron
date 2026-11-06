'use client';
import Link from 'next/link';
import { BrandIdentity } from './BrandMark';
import { usePathname } from 'next/navigation';

const slug = (process.env.NEXT_PUBLIC_TOURNAMENT_SLUG ?? '').trim();
const chapters = [
  ['prologue', '宗旨'],
  ['rules', '規則說明'],
  ['invitation', '讓武'],
  ['register', '報名'],
  ['duel', '比武'],
  ['schedule', '賽程'],
  ['rewards', '獎賞'],
] as const;

function NavArrow() {
  return (
    <svg
      className="lj-nav__arrow"
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
    >
      <path
        d="M4 12 12 4M4 4h8v8"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Painted timber frame and lantern: in the server markup so the bar is dressed on first paint. */
function NavFrame({ lit = false }: { lit?: boolean }) {
  return (
    <span
      className={lit ? 'battle-nav-frame battle-nav-frame--lit' : 'battle-nav-frame'}
      aria-hidden="true"
    >
      <i />
      <i />
      <i />
    </span>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const chapterLinks = chapters.map(([id, label]) => (
    <Link key={id} href={`/#${id}`}>
      {label}
      <NavArrow />
    </Link>
  ));
  return (
    <header data-site-nav>
      <nav className="lj-nav__inner" aria-label="全站導覽">
        <NavFrame />
        <NavFrame lit />
        <Link href="/home" className="lj-nav__brand" aria-label="夜鴉閣" data-type-display>
          <BrandIdentity />
          <span className="battle-nav-raven" aria-hidden="true" />
        </Link>
        <div className="lj-nav__chapters">{chapterLinks}</div>
        <div className="lj-nav__actions">
          {slug ? (
            <Link
              className="lj-nav__member"
              href={`/t/${encodeURIComponent(slug)}/me`}
              aria-current={pathname.includes('/me') ? 'page' : undefined}
            >
              會員專區
            </Link>
          ) : null}
          <button
            type="button"
            className="lj-nav__toggle"
            data-nav-toggle
            aria-label="開啟導覽選單"
            aria-controls="site-navigation-drawer"
            aria-expanded="false"
          >
            <span />
            <span />
          </button>
        </div>
      </nav>
      <dialog
        id="site-navigation-drawer"
        className="lj-nav__drawer"
        data-nav-drawer
        aria-label="導覽選單"
      >
        <div className="lj-nav__drawer-head">
          <Link href="/home" aria-label="夜鴉閣" className="lj-nav__brand" data-type-display>
            <BrandIdentity />
          </Link>
          <button type="button" className="lj-nav__close" data-nav-close aria-label="關閉導覽選單">
            <span />
            <span />
          </button>
        </div>
        <nav className="lj-nav__drawer-links" aria-label="章節導覽">
          {chapterLinks}
        </nav>
        <div className="lj-nav__drawer-foot">
          {slug ? (
            <Link className="lj-nav__member" href={`/t/${encodeURIComponent(slug)}/me`}>
              會員專區
              <NavArrow />
            </Link>
          ) : null}
          <div className="lj-nav__utilities">
            <Link href="/tools">小工具</Link>
            <Link href="/loadout">備戰方案</Link>
            <a href="/?view=reading">靜態閱讀</a>
          </div>
        </div>
      </dialog>
    </header>
  );
}
