import type { Metadata } from 'next';

import { BetSlip, MyBets } from '../../../../features/betting';

import styles from '../page.module.css';

export const metadata: Metadata = { title: '我的注單 · 百業試鋒' };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className={`${styles.page} ${styles.withDock}`}>
      <MyBets slug={slug} />
      <BetSlip slug={slug} />
    </main>
  );
}
