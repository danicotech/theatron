import type { Metadata } from 'next';

import { SignupPage } from '../../../../features/signup/SignupPage';

import styles from '../page.module.css';

export const metadata: Metadata = { title: '報名參賽 · 百業試鋒' };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className={styles.page}>
      <SignupPage slug={slug} />
    </main>
  );
}
