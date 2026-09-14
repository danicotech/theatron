'use client';

import { ConnectError } from '@connectrpc/connect';
import { ChapterHead, InkTitle, PaperCard, RankSigil, SectionHead } from '@theatron/ui';
import { useEffect, useState } from 'react';

import { activityApi } from '../../lib/api/activity';
import type { HandicapItem, RankInfo } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { HANDICAP_CATEGORIES } from '../handicap/categories';

import { inkMark } from './inkMarks';

import styles from './RulesPage.module.css';

/**
 * 規則與讓武項目總表。
 *
 * 這一頁存在的理由很具體:選手在選讓武的時候要能**手邊就查得到**每一項是什麼、
 * 多少 BP。原本的痛點就是「全人工操作又怕說明不夠清楚,讓參加者混亂」。
 *
 * 段位名稱、BP 級距、項目與價格全部跟伺服器要 —— 逐屆可調,前端寫死就會
 * 在第二屆變成錯的。
 *
 * 版面上只有一件事是「公告」:段位差換多少 BP。它是會被截圖貼到群裡的那一段,
 * 所以它長在紙上;其餘是查表,查表要的是細線與對齊,不是紙。
 */

const RULES_MARK = inkMark('ink-rules');

export function RulesPage({ slug }: { slug: string }) {
  const [ranks, setRanks] = useState<RankInfo[]>([]);
  const [perGap, setPerGap] = useState<bigint>(0n);
  const [items, setItems] = useState<HandicapItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [r, i] = await Promise.all([
          activityApi.tournament.listRanks({ tournamentSlug: slug }),
          activityApi.handicap.listItems({ tournamentSlug: slug }),
        ]);
        setRanks(r.ranks);
        setPerGap(r.bpPerRankGap);
        setItems(i.items);
      } catch (err) {
        setError(ConnectError.from(err).message);
      }
    })();
  }, [slug]);

  if (error !== null) {
    return (
      <p className={styles.error} role="alert">
        {error}
      </p>
    );
  }

  return (
    <div className={styles.page}>
      <ChapterHead
        number="參"
        eyebrow="百業試鋒 · 規則"
        title="段位定其差,BP 量其讓"
        lede={
          <>
            段位差決定低段位的一方拿到多少讓武 BP,他用這些 BP 對高段位的一方施加正式比賽限制。
            <strong>讓武不是放水</strong> —— 受限的一方仍須全力求勝,只是要用更難的方式取勝。
          </>
        }
        aside={<InkTitle {...RULES_MARK} size="mark" />}
      />

      <section className={styles.section} aria-labelledby="ranks">
        <SectionHead id="ranks" en="THE RANKS">
          段位
        </SectionHead>
        <ul className={styles.ranks}>
          {ranks.map((r, i) => (
            <li key={r.rank} className={styles.rankRow}>
              <RankSigil level={i + 1} total={ranks.length} name={r.name} title={r.title} />
              {r.description === '' ? null : <p className={styles.rankDesc}>{r.description}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="bp">
        <SectionHead id="bp" en="THE HANDICAP">
          BP 怎麼算
        </SectionHead>
        {/* 級距表是會被截圖貼進群組的那一段,所以它是一張貼出去的告示。
            紙上的列本來就是「標籤靠左、數字靠右、一列一條折痕」,
            跟原本的表格是同一種對齊紀律。 */}
        <div className={styles.paperSlot}>
          <PaperCard
            kicker="讓武例"
            index="BP / PER RANK GAP"
            headingLevel={3}
            title="段位差換 BP"
            subtitle="低段位的一方拿到"
            rows={[0, 1, 2, 3].map((gap) => ({
              label: gap === 0 ? '同段' : `差 ${gap.toString()} 段`,
              value: `${(perGap * BigInt(gap)).toString()} BP`,
              mono: true,
            }))}
            note="高段位的一方永遠不會拿到反向補償。BP 每一輪依當下的對手重算,該場用完即作廢 —— 沒花完的不會留到下一輪。"
            tilt="left"
          />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="items">
        <SectionHead id="items" en="THE CATALOGUE">
          讓武項目
        </SectionHead>
        <p className={styles.note}>
          BP 夠就能買,同一項也可以重複買。系統不擋互相矛盾的組合 ——
          真的撞在一起時由裁判臨場判,所以買之前先想清楚你要的是什麼。
        </p>
        {HANDICAP_CATEGORIES.map((c) => {
          const group = items
            .filter((i) => i.category === c.key)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          if (group.length === 0) return null;
          return (
            <div key={c.key} className={styles.group}>
              <h3 className={styles.h3}>{c.label}</h3>
              <ul className={styles.items}>
                {group.map((i) => (
                  <li key={i.publicId} className={styles.item}>
                    <span className={styles.cost}>{i.cost.toString()}</span>
                    <span className={styles.itemBody}>
                      <span className={styles.itemName}>
                        {i.name}
                        {i.repeatable ? <span className={styles.tag}>可重複</span> : null}
                      </span>
                      {i.description === '' ? null : (
                        <span className={styles.itemDesc}>{i.description}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {items.length === 0 ? <p className={styles.note}>讀取讓武項目…</p> : null}
      </section>
    </div>
  );
}
