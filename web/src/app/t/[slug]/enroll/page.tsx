import type { Metadata } from 'next';
import { SignupPage } from '../../../../features/signup/SignupPage';
import styles from '../../../../features/signup/EnrollmentPage.module.css';
export const metadata: Metadata = { title: '報名參賽' };
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main id="main" className={styles.page}>
      <h1>報名參賽</h1>
      <SignupPage slug={slug} />
    </main>
  );
}
