import type { Metadata } from 'next';

import { BracketPage } from '../../../../features/bracket/BracketPage';

import styles from '../page.module.css';

export const metadata: Metadata = { title: '對戰表 · 百業試鋒' };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main id="main" className={styles.page}>
      <BracketPage slug={slug} />
    </main>
  );
}
