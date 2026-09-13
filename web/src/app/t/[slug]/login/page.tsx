import { ChapterHead } from '@theatron/ui';
import type { Metadata } from 'next';

import { PlayerLogin } from '../../../../features/signup/PlayerLogin';

import styles from '../page.module.css';

export const metadata: Metadata = { title: '進站 · 百業試鋒' };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main id="main" className={`${styles.page} ${styles.stack}`}>
      {/* 進站不在導覽的序列裡,印記用「門」而不是編號。 */}
      <ChapterHead number="門" eyebrow="百業試鋒 · 進站" title="進站" />
      <PlayerLogin slug={slug} />
    </main>
  );
}
