'use client';

import Link from 'next/link';
import { HelpTip } from '../chrome/HelpTip';
import { MemberLogout } from './MemberLogout';
import { useId, useState, type ReactNode } from 'react';
import styles from './MemberShell.module.css';

export type MemberView = 'overview' | 'registration' | 'character' | 'bets';
export const memberViews: Record<MemberView, string> = {
  overview: '個人總覽',
  registration: '我的報名',
  character: '報名武庫',
  bets: '觀局雅集',
};

export function MemberShell({
  slug,
  view,
  children,
  tournamentName,
  onLogout,
  canManage = false,
}: {
  slug: string;
  view: MemberView;
  children: ReactNode;
  tournamentName?: string;
  onLogout?: () => void;
  canManage?: boolean | undefined;
}) {
  const [open, setOpen] = useState(false);
  const navId = useId();
  const base = `/t/${encodeURIComponent(slug)}`;
  const current = memberViews[view];
  return (
    <main id="main" className={styles.page} data-member-workspace>
      <div className={styles.paper} data-paper-window="plaque">
        <header className={styles.header}>
          <div>
            <h1>會員專區</h1>
            {tournamentName ? <p className={styles.event}>{tournamentName}</p> : null}
          </div>
          <MemberLogout slug={slug} onLogout={onLogout} />
        </header>
        <div className={styles.workspace}>
          <aside className={styles.sidebar} aria-label="會員選單">
            <p className={styles.label}>個人資料</p>
            <button
              type="button"
              className={styles.toggle}
              aria-expanded={open}
              aria-controls={navId}
              onClick={() => setOpen(!open)}
            >
              切換頁面 · {current}
              <span aria-hidden="true">{open ? '−' : '＋'}</span>
            </button>
            <nav id={navId} className={styles.menu} data-open={open} aria-label="個人資訊切換">
              {(Object.entries(memberViews) as [MemberView, string][]).map(([key, label]) => (
                <Link
                  key={key}
                  href={`${base}/me?view=${key}`}
                  aria-current={view === key ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  {label}
                </Link>
              ))}
              <div className={styles.related}>
                <Link href="/tools">江湖雅戲</Link>
                {canManage ? <Link href="/judge">管理賽事</Link> : null}
                <Link href="/#rules">規則與讓武說明</Link>
                <Link href="/#schedule">賽程</Link>
              </div>
            </nav>
          </aside>
          <section className={styles.content} aria-label={current} key={view}>
            <h2 className={styles.sectionTitle}>
              {current}
              {view === 'bets' ? (
                <HelpTip
                  label="觀局雅集"
                  text="在比武的觀局雅集選場下注。已成立的注單會同步顯示於此。"
                />
              ) : null}
            </h2>
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
