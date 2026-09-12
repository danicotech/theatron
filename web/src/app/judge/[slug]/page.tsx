import type { Metadata } from 'next';

import { JudgeConsole } from '../../../features/admin/JudgeConsole';

import styles from '../page.module.css';

export const metadata: Metadata = {
  title: '裁判台',
};

export default async function JudgeTournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <main className={styles.page}>
      <JudgeConsole slug={slug} />
    </main>
  );
}
