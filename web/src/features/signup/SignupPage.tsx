'use client';

import Link from 'next/link';
import { useState } from 'react';

import { SignupForm } from './SignupForm';

import styles from './SignupPage.module.css';

/**
 * 報名頁。送出後停在一個確認畫面,不自動跳走 ——
 * 報名這件事一輩子做一次,人會想確認它真的成了。
 */
export function SignupPage({ slug }: { slug: string }) {
  const [done, setDone] = useState<string | null>(null);

  if (done !== null) {
    return (
      <div className={styles.done}>
        <p className={styles.doneLabel}>報名完成</p>
        <h1 className={styles.doneName}>{done}</h1>
        <p className={styles.doneNote}>
          接下來等報名截止、御風羽評段。段位會在抽籤之前一次公布,到時候你會看到自己被評為哪一段。
        </p>
        <p className={styles.doneNote}>之後用同一個遊戲ID 就能進站,不需要密碼。</p>
        <Link className={styles.link} href={`/t/${slug}`}>
          回賽事頁
        </Link>
      </div>
    );
  }

  return (
    <>
      <header className={styles.head}>
        <p className={styles.eyebrow}>百業試鋒</p>
        <h1 className={styles.title}>報名參賽</h1>
        <p className={styles.lede}>
          填一個遊戲ID 就算報名。其餘欄位留空也送得出去 —— 它們是給御風羽評段用的材料。
        </p>
      </header>
      <SignupForm slug={slug} onDone={setDone} />
    </>
  );
}
