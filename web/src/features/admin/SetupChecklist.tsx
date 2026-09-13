'use client';

import { Button } from '@theatron/ui';

import type { SetupChecklistEntry } from '../../lib/api/gen/hestia/activity/v1/judge_pb';

import styles from './MatchConsole.module.css';

/**
 * 開賽前設定確認。封盤後才有這張清單:每一筆未作廢的讓武項目 + 給裁判的執行說明
 * + 抽選結果。裁判逐項核對場上真的改好了,然後**整張一次確認** —— 伺服器只收一次,
 * 逐項打勾只會多出一份沒有權威的狀態。
 *
 * 執行說明從不離開裁判端(選手看的是 description,不是 referee_note)。
 */

export interface SetupChecklistProps {
  entries: SetupChecklistEntry[];
  /** 還沒確認時給按鈕;確認過(重看設定)就只剩清單。 */
  confirm?: { pending: boolean; onConfirm: () => void } | undefined;
}

export function SetupChecklist({ entries, confirm }: SetupChecklistProps) {
  return (
    <>
      {entries.length === 0 ? (
        <p className={styles.primaryCopy}>本場沒有讓武項目,沒有要核對的設定。</p>
      ) : (
        <ol className={styles.list} aria-label="開賽前設定">
          {entries.map((e) => (
            <li key={e.selectionPublicId}>
              <div className={styles.row}>
                <span className={styles.itemName}>{e.itemName}</span>
                {e.appliesToBoth ? <span className={styles.tag}>雙方都受限</span> : null}
              </div>
              {e.targetNote === '' ? null : (
                <p className={styles.detail}>
                  指定:<b>{e.targetNote}</b>
                </p>
              )}
              {e.drawResult === '' ? null : (
                <p className={styles.detail}>
                  抽到:<b>{e.drawResult}</b>
                </p>
              )}
              <p className={styles.refereeNote}>{e.refereeNote}</p>
            </li>
          ))}
        </ol>
      )}

      {confirm === undefined ? null : (
        <>
          <p className={styles.hint}>確認之後才能開打,而且只能確認一次。</p>
          <div className={styles.actions}>
            <Button size="lg" loading={confirm.pending} onClick={confirm.onConfirm}>
              確認開賽前設定
            </Button>
          </div>
        </>
      )}
    </>
  );
}
