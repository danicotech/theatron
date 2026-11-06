import { ToolsRoom } from '../../features/match-tools/ToolsRoom';
import styles from './page.module.css';
export const metadata = { title: '江湖雅戲' };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; room?: string }>;
}) {
  const query = await searchParams;
  return (
    <main id="main" className={styles.page}>
      <ToolsRoom initialCode={query.code ?? ''} initialRoom={query.room ?? ''} />
    </main>
  );
}
