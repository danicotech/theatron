import type { Metadata } from 'next';

import { RulesPage } from '../../../../features/tournament/RulesPage';

import styles from '../page.module.css';

export const metadata: Metadata = { title: '規則與讓武項目 · 百業試鋒' };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className={styles.page}>
      <RulesPage slug={slug} />
    </main>
  );
}
