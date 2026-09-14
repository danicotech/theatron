'use client';

import { ChapterHead, InkLink, PaperCard, SealStamp } from '@theatron/ui';
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
    // 建立成功的畫面是一張**發出去的告示**:這一屆從這一刻起存在了。
    // 它是唯讀的,只有一條路往下走 —— 所以它可以長在紙上,表單不行。
    return (
      <div className={styles.done}>
        <PaperCard
          kicker="賽事已建立"
          index="TOURNAMENT / OPEN"
          headingLevel={2}
          title={created.name}
          rows={[
            { label: '網址代號', value: created.slug, mono: true },
            { label: '讓武項目', value: created.handicapItemCount, mono: true },
            { label: '目前階段', value: '報名中' },
          ]}
          note="報名已經開著。接下來等選手報名,報名截止後才輪到評段。"
          stamp={<SealStamp text="立" />}
          tilt="left"
          action={
            <InkLink href={`/judge/${created.slug}`} tone="vermilion">
              進入這一屆的裁判台
            </InkLink>
          }
        />
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      {/* 開賽事不在觀眾的導覽序列裡,印記用「開」。 */}
      <ChapterHead
        number="開"
        eyebrow="裁判台"
        title="開一屆賽事"
        lede="建立之後報名立刻開著。段位、抽籤、開封盤都在建立之後才做 —— 這一頁只決定這屆叫什麼、掛在哪、以及規則的幾個數字。"
      />
      <CreateTournamentForm onCreated={setCreated} />
    </div>
  );
}
