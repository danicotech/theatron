import { TournamentHome } from '../../../features/tournament/TournamentHome';

import styles from './page.module.css';

export default async function TournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className={styles.page}>
      <TournamentHome slug={slug} />
    </main>
  );
}
