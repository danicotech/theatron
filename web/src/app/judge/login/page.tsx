import type { Metadata } from 'next';
import { Suspense } from 'react';

import { JudgeLogin } from '../../../features/admin/JudgeLogin';

import styles from '../page.module.css';

export const metadata: Metadata = { title: '裁判登入' };

export default function Page() {
  return (
    <main className={styles.page}>
      {/* useSearchParams 需要 Suspense 邊界,否則整頁會退成純 client render。 */}
      <Suspense fallback={null}>
        <JudgeLogin />
      </Suspense>
    </main>
  );
}
