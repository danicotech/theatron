'use client';
import { HelpTip } from '../chrome/HelpTip';

import { useCallback } from 'react';

import { activityApi } from '../../lib/api/activity';
import type { RankInfo, Tournament } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { usePolling } from '../../lib/api/poll';
import { WuxiaBracket } from '../bracket/WuxiaBracket';
import { tournamentDisplay } from '../landing/tournamentDisplay';

import styles from './MatchList.module.css';

/**
 * 比賽中的裁判總覽:整棵對戰表,每一場都連到它的裁判頁。
 *
 * 用的是與觀眾同一棵 BracketTree —— 裁判要找的是「哪一場在打、哪一場等著開盤」,
 * 那正是晉級樹已經在說的事;另做一份列表只是同一份資料的第二種長相。
 * 手機上分輪檢視預設落在有事情正在發生的那一輪,不是第 1 輪。
 */

export interface MatchListProps {
  slug: string;
  ranks: RankInfo[];
  tournament: Tournament;
  onSelectMatch?: (id: string) => void;
}

export function MatchList({ slug, ranks, tournament, onSelectMatch }: MatchListProps) {
  const load = useCallback(
    () => activityApi.tournament.getBracket({ tournamentSlug: slug }),
    [slug],
  );
  const { data, error } = usePolling(load, 10_000);

  if (data === null) {
    return error === null ? (
      <p className={styles.loading}>讀取對戰表…</p>
    ) : (
      <p className={styles.error} role="alert">
        {error}
      </p>
    );
  }
  if (!data.bracketPublished) {
    return <p className={styles.line}>對戰表還沒公布。</p>;
  }

  const Heading = onSelectMatch ? 'h3' : 'h2';
  const display = tournamentDisplay(slug, { bracket: data, ranks, bestOf: tournament.bestOf });

  return (
    <div className={styles.list}>
      <Heading className="help-heading">
        {onSelectMatch ? '選擇要管理的場次' : '賽程管理'}
        <HelpTip label="賽程管理" text="選擇場次後，可管理開盤、封盤、開賽設定及回合勝負。" />
      </Heading>
      <WuxiaBracket data={display} {...(onSelectMatch ? { onSelectMatch } : {})} />
      {error === null ? null : (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
