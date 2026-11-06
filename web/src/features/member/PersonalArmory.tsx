'use client';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { activityApi } from '../../lib/api/activity';
import { MatchStatus } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { SelectedLoadout } from '../signup/SelectedLoadout';
import styles from './PersonalArmory.module.css';
export function PersonalArmory({
  slug,
  memberId,
  children,
  rankName = '未評定',
  ladderRank,
  matchId,
  playerId,
  revision = 0,
}: {
  slug: string;
  memberId: string;
  children?: ReactNode;
  rankName?: string;
  ladderRank?: string | undefined;
  matchId?: string | undefined;
  playerId?: string | undefined;
  revision?: number;
}) {
  const router = useRouter();
  const [bp, setBp] = useState<{ matchId: string; label: string }>({ matchId: '', label: '—' });
  useEffect(() => {
    if (!matchId || !playerId) return;
    const controller = new AbortController();
    void activityApi.handicap
      .getMatchHandicaps({ matchPublicId: matchId }, { signal: controller.signal })
      .then(({ handicaps }) => {
        if (controller.signal.aborted) return;
        const label =
          !handicaps || handicaps.status === MatchStatus.PENDING
            ? '尚未開放'
            : handicaps.constrainedPlayerPublicId === playerId
              ? '受讓武方'
              : handicaps.budget?.playerPublicId === playerId
                ? handicaps.budget.remaining.toString()
                : '—';
        setBp({ matchId, label });
      })
      .catch(() => {
        if (!controller.signal.aborted) setBp({ matchId, label: '暫時無法讀取' });
      });
    return () => controller.abort();
  }, [matchId, playerId, revision]);
  return (
    <div className={styles.container}>
      <div className={styles.columns}>
        <div className={styles.loadout}>
          {children ?? (
            <SelectedLoadout
              compact
              slug={slug}
              memberId={memberId}
              returnTarget="member"
              confirmLabel="使用此武庫報名"
              onConfirm={(_, role) => {
                router.push(
                  `/t/${encodeURIComponent(slug)}/enroll?loadoutRole=${encodeURIComponent(role.id)}`,
                );
              }}
            />
          )}
        </div>
        <aside className={styles.info} aria-label="BP 與個人段位">
          <dl>
            <div>
              <dt>個人段位</dt>
              <dd>{rankName}</dd>
            </div>
            <div>
              <dt>論劍段位</dt>
              <dd>{ladderRank || '未填寫'}</dd>
            </div>
            <div>
              <dt>可用 BP</dt>
              <dd>{matchId ? (bp.matchId === matchId ? bp.label : '讀取中…') : '尚未配對'}</dd>
            </div>
          </dl>
          {matchId ? (
            <Link href={`/t/${encodeURIComponent(slug)}/me/handicap`}>查看本場讓武 →</Link>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
