import type { Metadata } from 'next';

import { MyPlayer } from '../../../../features/signup/MyPlayer';

import styles from '../page.module.css';

export const metadata: Metadata = { title: '我的報名 · 百業試鋒' };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main id="main" className={styles.page}>
      <MyPlayer slug={slug} />
    </main>
  );
}
