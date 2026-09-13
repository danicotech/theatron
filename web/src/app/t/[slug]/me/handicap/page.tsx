import type { Metadata } from 'next';

import { HandicapShop } from '../../../../../features/handicap/HandicapShop';

import styles from '../../page.module.css';

export const metadata: Metadata = { title: '本場讓武 · 百業試鋒' };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main id="main" className={styles.page}>
      <HandicapShop slug={slug} />
    </main>
  );
}
