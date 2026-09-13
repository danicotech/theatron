'use client';

import { ConnectError } from '@connectrpc/connect';
import { Amount, Button } from '@theatron/ui';
import { useId, useState } from 'react';

import type { HandicapItem } from '../../lib/api/gen/hestia/activity/v1/common_pb';

import styles from './ItemCard.module.css';

/**
 * 一列讓武項目。
 *
 * 長得像賠率單的一列而不是一張卡:34 項排在手機上,卡片套卡片會把畫面
 * 撐成一長串圓角方塊,價格也對不齊。這裡價格靠右、等寬、直角分隔線 ——
 * 借的是賠率單的對齊紀律。
 *
 * 數量用「×N」而不是勾選框:每一項都能重複買,勾選框會讓人以為只能買一次。
 * 互斥不擋(規則頁已經說了由裁判臨場判),所以這裡唯一會擋的是 BP 不夠。
 */
export interface ItemCardProps {
  item: HandicapItem;
  /** 已經買了幾次。 */
  quantity: number;
  /** 還剩多少 BP;決定買不買得起。 */
  remaining: bigint;
  /** 整個商店能不能動(沒開盤 / 已封盤 / 不歸我)。原因在頁面的橫幅,這裡不重述。 */
  editable: boolean;
  onAdd: (item: HandicapItem, targetNote: string) => Promise<void>;
}

export function ItemCard({ item, quantity, remaining, editable, onAdd }: ItemCardProps) {
  const noteId = useId();
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const short = remaining < item.cost;
  const noteMissing = item.requiresTargetNote && note.trim() === '';
  const disabled = !editable || short || noteMissing;

  async function add() {
    if (pending || disabled) return;
    setPending(true);
    setError(null);
    try {
      await onAdd(item, note.trim());
      setNote('');
    } catch (err) {
      setError(ConnectError.from(err).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <li className={styles.row}>
      <div className={styles.head}>
        <h3 className={styles.name}>{item.name}</h3>
        <Amount value={item.cost} currency="BP" tone="neutral" label="價格" />
      </div>

      {item.description === '' ? null : <p className={styles.desc}>{item.description}</p>}

      {item.repeatable || item.appliesToBoth || item.seconds > 0n ? (
        <ul className={styles.tags} aria-label="特性">
          {item.repeatable ? <li className={styles.tag}>可重複</li> : null}
          {item.seconds > 0n ? (
            <li className={styles.tag}>計時 {item.seconds.toString()} 秒</li>
          ) : null}
          {/* 買方自己也受限:這是唯一會反過來咬買方的特性,用玫瑰色標出來。 */}
          {item.appliesToBoth ? <li className={styles.tagBoth}>雙方適用</li> : null}
        </ul>
      ) : null}

      {item.requiresTargetNote ? (
        <div className={styles.field}>
          <label className={styles.label} htmlFor={noteId}>
            指定內容(必填)
          </label>
          <input
            className={styles.input}
            id={noteId}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
            }}
            disabled={!editable || pending}
            autoComplete="off"
            required
          />
        </div>
      ) : null}

      <div className={styles.act}>
        {quantity > 0 ? (
          <span className={styles.qty} aria-label={`已買 ${String(quantity)} 次`}>
            ×{quantity}
          </span>
        ) : null}
        <Button
          size="md"
          disabled={disabled}
          loading={pending}
          onClick={() => {
            void add();
          }}
        >
          買下
        </Button>
        {editable && short ? <span className={styles.reason}>BP 不夠</span> : null}
      </div>

      {error === null ? null : (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
