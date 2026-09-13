'use client';

import { ConnectError } from '@connectrpc/connect';
import { Amount, Button, Card, CardBody, CardFooter, CardHeader } from '@theatron/ui';
import { useState } from 'react';

import type { HandicapSelection } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { HandicapCategory } from '../../lib/api/gen/hestia/activity/v1/common_pb';

import styles from './SelectionList.module.css';

/**
 * 讓武單 —— 已買項目的票根。
 *
 * 伺服器每買一次一列(各自帶價格快照與指定內容),畫面上同一項同一指定內容
 * 合併成「×N」,退的時候一次退一張:退掉的是最近買的那一筆,因為 VoidSelection
 * 認的是單筆的 public_id。
 *
 * 封盤前只有買方看得到這張單;封盤後雙方與觀眾都看得到,這時它是唯讀的,
 * 並且會多出系統抽選的結果。
 */
export interface SelectionListProps {
  label: string;
  selections: HandicapSelection[];
  /** 還能退。false = 已封盤或這張單不是我的。 */
  canVoid: boolean;
  onVoid?: ((selectionPublicId: string) => Promise<void>) | undefined;
  /** 空單時的邀請句。 */
  emptyCopy: string;
}

interface Group {
  key: string;
  first: HandicapSelection;
  ids: string[];
}

function groupSelections(selections: HandicapSelection[]): Group[] {
  const groups = new Map<string, Group>();
  for (const s of selections) {
    const key = JSON.stringify([s.itemPublicId, s.targetNote, s.drawResult]);
    const g = groups.get(key);
    if (g === undefined) {
      groups.set(key, { key, first: s, ids: [s.publicId] });
    } else {
      g.ids.push(s.publicId);
    }
  }
  return [...groups.values()];
}

export function SelectionList({
  label,
  selections,
  canVoid,
  onVoid,
  emptyCopy,
}: SelectionListProps) {
  const groups = groupSelections(selections);
  const total = selections.reduce((sum, s) => sum + s.cost, 0n);
  const victoryCount = selections.filter((s) => s.category === HandicapCategory.VICTORY).length;

  return (
    <Card aria-label={label}>
      <CardHeader
        label={label}
        aside={
          selections.length === 0 ? undefined : (
            <Amount value={total} currency="BP" size="sm" label="合計" />
          )
        }
      />
      <CardBody>
        {groups.length === 0 ? (
          <p className={styles.empty}>{emptyCopy}</p>
        ) : (
          <ul className={styles.list}>
            {groups.map((g) => (
              <Row key={g.key} group={g} canVoid={canVoid} onVoid={onVoid} />
            ))}
          </ul>
        )}
      </CardBody>
      {/* 非阻擋式:系統不擋互斥,裁判臨場判。這句只是提醒,所以是 status 不是 alert。 */}
      {victoryCount >= 2 ? (
        <CardFooter>
          <p className={styles.notice} role="status">
            選了 {victoryCount} 項勝利條件。此類項目同時生效可能互相矛盾,請與裁判確認。
          </p>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function Row({
  group,
  canVoid,
  onVoid,
}: {
  group: Group;
  canVoid: boolean;
  onVoid: ((selectionPublicId: string) => Promise<void>) | undefined;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = group.first;
  const count = group.ids.length;

  async function voidOne() {
    // 退最近買的那一筆:對使用者來說「退一張」哪一張都一樣,但退最新的
    // 讓價格快照較舊的那幾張留下,與伺服器的時間順序一致。
    const id = group.ids[group.ids.length - 1];
    if (pending || onVoid === undefined || id === undefined) return;
    setPending(true);
    setError(null);
    try {
      await onVoid(id);
    } catch (err) {
      setError(ConnectError.from(err).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <li className={styles.row}>
      <div className={styles.main}>
        <div className={styles.nameLine}>
          <span className={styles.name}>{s.itemName}</span>
          {count > 1 ? (
            <span className={styles.qty} aria-label={`${String(count)} 張`}>
              ×{count}
            </span>
          ) : null}
          {s.appliesToBoth ? <span className={styles.both}>雙方適用</span> : null}
        </div>
        {s.targetNote === '' ? null : <p className={styles.note}>{s.targetNote}</p>}
        {s.drawResult === '' ? null : <p className={styles.draw}>系統抽選:{s.drawResult}</p>}
      </div>
      <div className={styles.side}>
        <Amount value={s.cost} currency="BP" tone="neutral" size="sm" label="每張" />
        {canVoid && onVoid !== undefined ? (
          <Button
            size="sm"
            loading={pending}
            onClick={() => {
              void voidOne();
            }}
          >
            退掉
          </Button>
        ) : null}
      </div>
      {error === null ? null : (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
