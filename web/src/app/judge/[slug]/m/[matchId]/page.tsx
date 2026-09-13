import type { Metadata } from 'next';

import { MatchConsole } from '../../../../../features/admin/MatchConsole';

import styles from '../../../page.module.css';

export const metadata: Metadata = {
  title: '裁判台 · 場次',
};

export default async function JudgeMatchPage({
  params,
}: {
  params: Promise<{ slug: string; matchId: string }>;
}) {
  const { slug, matchId } = await params;
  return (
    <main className={styles.page}>
      <MatchConsole slug={slug} matchId={matchId} />
    </main>
  );
}
