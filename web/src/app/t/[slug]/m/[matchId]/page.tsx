import type { Metadata } from 'next';

import { BetSlip } from '../../../../../features/betting';
import { MatchPage } from '../../../../../features/bracket/MatchPage';

import styles from '../../page.module.css';

export const metadata: Metadata = { title: '對戰 · 百業試鋒' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; matchId: string }>;
  searchParams: Promise<{ player?: string | string[] }>;
}) {
  const [{ slug, matchId }, query] = await Promise.all([params, searchParams]);
  const selectedPlayerId = typeof query.player === 'string' ? query.player : '';
  return (
    <main id="main" className={`${styles.page} ${styles.withDock}`}>
      <MatchPage slug={slug} matchId={matchId} selectedPlayerId={selectedPlayerId} />
      <BetSlip slug={slug} />
    </main>
  );
}
