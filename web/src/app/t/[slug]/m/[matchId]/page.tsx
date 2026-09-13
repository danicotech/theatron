import type { Metadata } from 'next';

import { BetSlip } from '../../../../../features/betting';
import { MatchPage } from '../../../../../features/bracket/MatchPage';

import styles from '../../page.module.css';

export const metadata: Metadata = { title: '對戰 · 百業試鋒' };

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; matchId: string }>;
}) {
  const { slug, matchId } = await params;
  return (
    <main id="main" className={`${styles.page} ${styles.withDock}`}>
      <MatchPage slug={slug} matchId={matchId} />
      <BetSlip slug={slug} />
    </main>
  );
}
