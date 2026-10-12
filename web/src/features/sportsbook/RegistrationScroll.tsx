'use client';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import styles from './RegistrationScroll.module.css';

/** Shared paper form surface. Keep children mounted to preserve unfinished enrollment. */
export function RegistrationScroll({
  expanded,
  children,
}: {
  expanded: boolean;
  children: ReactNode;
}) {
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!expanded) return;
    document.getElementById('register-title')?.focus({ preventScroll: true });
    const reader = root.current?.closest<HTMLElement>('.chapter-sticky');
    if (reader && !document.body.classList.contains('reading')) reader.scrollTop = 0;
    else root.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
  }, [expanded]);
  return (
    <section
      ref={root}
      hidden={!expanded}
      className={styles.panel}
      aria-label="報名參賽"
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className={styles.content}>{children}</div>
    </section>
  );
}
