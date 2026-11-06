import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './MemberAccess.module.css';
import scroll from './MemberScroll.module.css';
import { MemberSeal } from './MemberSeal';

export function MemberAccess({
  slug,
  mode,
  children,
  next = '',
}: {
  slug: string;
  mode: 'login' | 'signup';
  children: ReactNode;
  next?: string;
}) {
  const query = next ? `?next=${encodeURIComponent(next)}` : '';
  const base = `/t/${encodeURIComponent(slug)}`;
  return (
    <main id="main" className={styles.page} data-member-access={mode}>
      <section
        className={styles.paper}
        data-paper-window="plaque"
        aria-labelledby="member-access-title"
      >
        <header className={`${styles.header} ${scroll.title}`}>
          <div className={scroll.inscription}>
            <h1 id="member-access-title">{mode === 'login' ? '登入' : '註冊'}</h1>
            <MemberSeal />
          </div>
        </header>
        <div className={styles.body}>
          <nav aria-label="登入與註冊" className={styles.tabs}>
            <Link
              href={`${base}/login${query}`}
              aria-current={mode === 'login' ? 'page' : undefined}
            >
              登入
            </Link>
            <Link
              href={`${base}/signup${query}`}
              aria-current={mode === 'signup' ? 'page' : undefined}
            >
              註冊
            </Link>
          </nav>
          <div className={styles.content}>{children}</div>
        </div>
      </section>
    </main>
  );
}

export function MemberStatus({ children }: { children: ReactNode }) {
  return (
    <main id="main" className={styles.page} data-member-access="status">
      <div className={styles.status} data-paper-window="plaque">
        {children}
      </div>
    </main>
  );
}
