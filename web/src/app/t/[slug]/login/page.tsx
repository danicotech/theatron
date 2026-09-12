import type { Metadata } from 'next';

import { PlayerLogin } from '../../../../features/signup/PlayerLogin';

import styles from '../page.module.css';

export const metadata: Metadata = { title: '進站 · 百業試鋒' };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className={styles.page}>
      <h1 className={styles.pageTitle}>進站</h1>
      <PlayerLogin slug={slug} />
    </main>
  );
}
