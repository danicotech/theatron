import { TournamentHome } from '../../../features/tournament/TournamentHome';

import styles from './page.module.css';

// 賽事首頁是告示牆:左邊正文、右邊那張戰帖。兩欄的構圖要比讀字欄寬,所以吃 .wide。
export default async function TournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main id="main" className={`${styles.page} ${styles.wide}`}>
      <TournamentHome slug={slug} />
    </main>
  );
}
