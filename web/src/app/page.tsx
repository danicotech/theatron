import Link from 'next/link';

import styles from './page.module.css';

// 首屏還沒做(M5 待辦的最後一項)。這頁先當入口,不要長成一個假的 landing page。
export default function HomePage() {
  return (
    <main className={styles.shell}>
      <div>
        <div className={styles.label}>theatron</div>
        <h1 className={styles.title}>元件庫與 token 已經就位</h1>
      </div>
      <p className={styles.lede}>
        賽程樹、投注單、商店還沒進來。現在能看的是設計系統本身 —— 三層 token、主題注入,
        以及第一批套上去的元件。
      </p>
      <div className={styles.links}>
        <Link href="/kitchen-sink">看所有元件的所有狀態</Link>
      </div>
    </main>
  );
}
