'use client';

import { Button } from '@theatron/ui';
import { useState } from 'react';

import type { MatchHandicaps, Player } from '../../lib/api/gen/hestia/activity/v1/common_pb';

import styles from './MatchConsole.module.css';

/**
 * 封盤前的讓武檢視。選手端在封盤前只看得到自己買的,裁判走的是 ReviewHandicap ——
 * 場上要他執行的規則就寫在這些項目裡,看不到內容等於沒人執行得了。
 *
 * 代退不是不可逆(封盤前選手能拿退回來的 BP 重買),所以不做二次確認;
 * 二次確認由必填的理由承擔 —— 要打字的動作不會誤觸。
 */

export interface HandicapReviewProps {
  handicaps: MatchHandicaps | null;
  holder: Player | undefined;
  budget: bigint;
  pending: boolean;
  onRefund: (selectionPublicId: string, reason: string) => void;
}

export function HandicapReview({
  handicaps,
  holder,
  budget,
  pending,
  onRefund,
}: HandicapReviewProps) {
  const [refunding, setRefunding] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  if (budget === 0n) {
    return <p className={styles.line}>同段對決,本場沒有 BP,沒有讓武要看。</p>;
  }
  if (handicaps === null) {
    return <p className={styles.loading}>讀取讓武內容…</p>;
  }

  const b = handicaps.budget;
  const name = holder?.displayName ?? handicaps.budget?.playerPublicId ?? '';

  return (
    <>
      <p className={styles.line}>
        {name} 的預算{' '}
        <span className={styles.mono}>
          {b === undefined ? budget.toString() : `${b.spent.toString()} / ${b.budget.toString()}`}
        </span>{' '}
        BP
        {b === undefined ? null : (
          <>
            ,還剩 <span className={styles.mono}>{b.remaining.toString()}</span>
          </>
        )}
      </p>

      {handicaps.selections.length === 0 ? (
        <p className={styles.hint}>
          {name} 還沒買任何讓武。買了會出現在這裡,封盤前隨時可以回來看。
        </p>
      ) : (
        <ul className={styles.list} aria-label="已選的讓武">
          {handicaps.selections.map((s) => (
            <li key={s.publicId}>
              <div className={styles.row}>
                <span className={styles.itemName}>{s.itemName}</span>
                {s.appliesToBoth ? <span className={styles.tag}>雙方都受限</span> : null}
                <span className={styles.cost}>{s.cost.toString()} BP</span>
              </div>
              {/* 執行說明:裁判判斷要不要代退的依據(例如「禁用奇術」與「禁用任意奇術」重疊,
                  規則要求確認後返還後者的 BP)。只在 JudgeService 的回應裡有值,選手端永遠是空的。 */}
              {s.refereeNote === '' ? null : <p className={styles.detail}>{s.refereeNote}</p>}
              {s.targetNote === '' ? null : (
                <p className={styles.detail}>
                  指定:<b>{s.targetNote}</b>
                </p>
              )}
              {refunding === s.publicId ? (
                <>
                  <label className={styles.label}>
                    退掉的理由(必填,進稽核紀錄)
                    <textarea
                      className={styles.field}
                      rows={2}
                      value={reason}
                      disabled={pending}
                      onChange={(e) => {
                        setReason(e.target.value);
                      }}
                    />
                  </label>
                  <div className={styles.actions}>
                    <Button
                      loading={pending}
                      disabled={reason.trim() === ''}
                      onClick={() => {
                        onRefund(s.publicId, reason.trim());
                        setRefunding(null);
                        setReason('');
                      }}
                    >
                      退掉「{s.itemName}」
                    </Button>
                    <Button
                      disabled={pending}
                      onClick={() => {
                        setRefunding(null);
                        setReason('');
                      }}
                    >
                      不退
                    </Button>
                  </div>
                </>
              ) : (
                <div className={styles.actions}>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      setRefunding(s.publicId);
                      setReason('');
                    }}
                  >
                    代退這一項
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
