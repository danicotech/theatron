'use client';

import { Button } from '@theatron/ui';
import { useState } from 'react';

import type {
  HandicapSelection,
  Match,
  Player,
  Violation,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { ViolationRuling } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { currentRoundNo } from '../bracket/bracketView';

import styles from './MatchConsole.module.css';

/**
 * 違規紀錄。**只記事實與判決,不觸發任何後果**(schemas/27):判該回合負就由裁判
 * 把那一回合的勝者填成對方,判整場負就照著把回合填完。系統不代替裁判改賽果 ——
 * 賽果有派彩跟著,自動化一步就是派彩爭議。
 */

export interface ViolationRecord {
  roundNo: number;
  playerPublicId: string;
  itemPublicId: string;
  ruling: ViolationRuling;
  note: string;
}

export interface ViolationPanelProps {
  match: Match;
  p1: Player | undefined;
  p2: Player | undefined;
  violations: Violation[];
  /** 本場已成立的讓武選擇,讓「違反哪一項」有得選。 */
  selections: HandicapSelection[];
  pending: boolean;
  onRecord: (v: ViolationRecord) => void;
}

const RULINGS: { value: ViolationRuling; label: string }[] = [
  { value: ViolationRuling.WARNING, label: '警告' },
  { value: ViolationRuling.ROUND_LOSS, label: '判該回合負' },
  { value: ViolationRuling.MATCH_LOSS, label: '判整場負' },
  { value: ViolationRuling.NONE, label: '不予處分' },
];

export function rulingLabel(r: ViolationRuling): string {
  return RULINGS.find((x) => x.value === r)?.label ?? '';
}

export function ViolationPanel({
  match,
  p1,
  p2,
  violations,
  selections,
  pending,
  onRecord,
}: ViolationPanelProps) {
  const [player, setPlayer] = useState<string | null>(null);
  // 預設落在正在打的那一回合;還沒開打就是「開賽前」(0)。
  const openRound = match.rounds.find((r) => r.finishedAt === undefined);
  const [roundNo, setRoundNo] = useState<number>(
    openRound === undefined ? 0 : currentRoundNo(match),
  );
  const [item, setItem] = useState('');
  const [ruling, setRuling] = useState<ViolationRuling>(ViolationRuling.WARNING);
  const [note, setNote] = useState('');

  const sides = [
    { id: match.p1PlayerPublicId, name: p1?.displayName ?? match.p1PlayerPublicId },
    { id: match.p2PlayerPublicId, name: p2?.displayName ?? match.p2PlayerPublicId },
  ];
  // 同一項目買多次是多筆選擇,但違反的是「項目」;去重後才不會在下拉裡出現三個一樣的名字。
  const items = [...new Map(selections.map((s) => [s.itemPublicId, s.itemName])).entries()];
  const roundChoices = Array.from({ length: match.rounds.length }, (_, i) => i + 1);

  const canSubmit = player !== null && note.trim() !== '' && !pending;

  return (
    <>
      <p className={styles.hint}>
        違規只是紀錄,不會自動改賽果:判該回合負就把那一回合的勝者填成對方,判整場負就照著把回合填完。
      </p>

      {violations.length === 0 ? null : (
        <ol className={styles.list} aria-label="違規紀錄">
          {violations.map((v) => (
            <li key={v.publicId}>
              <div className={styles.row}>
                <span className={styles.mono}>
                  {v.roundNo === 0 ? '開賽前' : `第 ${v.roundNo} 回合`}
                </span>
                <span className={styles.itemName}>{v.playerDisplayName}</span>
                <span className={styles.tag}>{rulingLabel(v.ruling)}</span>
              </div>
              {v.itemName === '' ? null : <p className={styles.detail}>違反:{v.itemName}</p>}
              <p className={styles.refereeNote}>{v.note}</p>
            </li>
          ))}
        </ol>
      )}

      <fieldset className={styles.fieldset} disabled={pending}>
        <legend className={styles.legend}>記一筆違規</legend>

        <div className={styles.pickRow} role="group" aria-label="違規者">
          {sides.map((s) => (
            <button
              key={s.id}
              type="button"
              className={[styles.pick, player === s.id ? styles.picked : ''].join(' ')}
              aria-pressed={player === s.id}
              onClick={() => {
                setPlayer(player === s.id ? null : s.id);
              }}
            >
              {s.name}
            </button>
          ))}
        </div>

        <label className={styles.label}>
          發生在
          <select
            className={styles.field}
            value={roundNo}
            onChange={(e) => {
              setRoundNo(Number(e.target.value));
            }}
          >
            <option value={0}>開賽前</option>
            {roundChoices.map((n) => (
              <option key={n} value={n}>
                第 {n} 回合
              </option>
            ))}
          </select>
        </label>

        {items.length === 0 ? null : (
          <label className={styles.label}>
            違反哪一項
            <select
              className={styles.field}
              value={item}
              onChange={(e) => {
                setItem(e.target.value);
              }}
            >
              <option value="">通則(不對應特定讓武)</option>
              {items.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className={styles.label}>
          判決
          <select
            className={styles.field}
            value={ruling}
            onChange={(e) => {
              setRuling(Number(e.target.value));
            }}
          >
            {RULINGS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.label}>
          發生了什麼、為什麼這樣判(必填)
          <textarea
            className={styles.field}
            rows={3}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
            }}
          />
        </label>

        <div className={styles.actions}>
          <Button
            loading={pending}
            disabled={!canSubmit}
            onClick={() => {
              if (player === null) return;
              onRecord({
                roundNo,
                playerPublicId: player,
                itemPublicId: item,
                ruling,
                note: note.trim(),
              });
              setPlayer(null);
              setItem('');
              setNote('');
            }}
          >
            記一筆違規
          </Button>
        </div>
      </fieldset>
    </>
  );
}
