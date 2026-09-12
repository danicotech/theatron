'use client';

import Link from 'next/link';
import { useState } from 'react';

import { CreateTournamentForm, type CreatedTournament } from './CreateTournamentForm';

import styles from './JudgeEntry.module.css';

/**
 * 裁判後台的入口。
 *
 * 建立成功後不自動跳轉:通行碼那類「只顯示一次」的東西在這個系統裡很多,
 * 裁判需要一個停下來確認的畫面,而不是被沖到下一頁。下一步由他自己按。
 */
export function JudgeEntry() {
  const [created, setCreated] = useState<CreatedTournament | null>(null);

  if (created !== null) {
    return (
      <div className={styles.done}>
        <p className={styles.doneLabel}>賽事已建立</p>
        <h2 className={styles.doneName}>{created.name}</h2>
        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>網址代號</dt>
            <dd className={styles.mono}>{created.slug}</dd>
          </div>
          <div className={styles.fact}>
            <dt>讓武項目</dt>
            <dd className={styles.mono}>{created.handicapItemCount}</dd>
          </div>
          <div className={styles.fact}>
            <dt>目前階段</dt>
            <dd>報名中</dd>
          </div>
        </dl>
        <p className={styles.next}>報名已經開著。接下來等選手報名,報名截止後才輪到評段。</p>
        <Link className={styles.link} href={`/judge/${created.slug}`}>
          進入這一屆的裁判台
        </Link>
      </div>
    );
  }

  return (
    <>
      <header className={styles.head}>
        <p className={styles.eyebrow}>裁判台</p>
        <h1 className={styles.title}>開一屆賽事</h1>
        <p className={styles.lede}>
          建立之後報名立刻開著。段位、抽籤、開封盤都在建立之後才做 ——
          這一頁只決定這屆叫什麼、掛在哪、以及規則的幾個數字。
        </p>
      </header>
      <CreateTournamentForm onCreated={setCreated} />
    </>
  );
}
