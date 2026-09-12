import type { Metadata } from 'next';

import { JudgeEntry } from '../../features/admin/JudgeEntry';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: '裁判台 · 開賽事',
};

export default function JudgePage() {
  return (
    <main className={styles.page}>
      <JudgeEntry />
    </main>
  );
}
