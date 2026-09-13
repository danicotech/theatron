'use client';

import type { Timestamp } from '@bufbuild/protobuf/wkt';
import { timestampMs } from '@bufbuild/protobuf/wkt';
import { Button, Card, CardBody, CardHeader } from '@theatron/ui';
import { useEffect, useState } from 'react';

import type { Match, MatchRound, Player } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { currentRoundNo, winsNeeded } from '../bracket/bracketView';

import styles from './MatchConsole.module.css';

/**
 * 回合操作:開始下一回合、計時、判定回合勝者。
 *
 * 計時器是衍生值 —— now() − started_at,伺服器不存倒數狀態。直播頁與這一頁看的是
 * 同一個 started_at,不會各算各的。
 *
 * 判定回合勝者**不可逆**,而且拿到勝場數的那一次會定案整場、觸發晉級與派彩。
 * 所以是兩步:先點人,再按一顆寫著「確定判 X 贏第 N 回合」的按鈕。
 * 按鈕上寫名字而不是「確認」,是要讓誤點在按下去之前就被看見。
 */

export interface RoundControlsProps {
  match: Match;
  p1: Player | undefined;
  p2: Player | undefined;
  /** 幾局幾勝。來自 Tournament.best_of,不寫死 3。 */
  bestOf: number;
  pending: boolean;
  onStart: () => void;
  onFinish: (roundNo: number, winnerPublicId: string, note: string) => void;
}

export function RoundControls({
  match,
  p1,
  p2,
  bestOf,
  pending,
  onStart,
  onFinish,
}: RoundControlsProps) {
  const open = match.rounds.find((r) => r.finishedAt === undefined);
  const roundNo = currentRoundNo(match);

  if (open === undefined) {
    // 第 1 回合是「正式開打」:關下注、開始計時。之後每一回合前置都要重做一次
    // (preamble_every_round):讓守關元、讓半血在按之前做完,計時不含前置。
    return (
      <div className={styles.primary}>
        <p className={styles.primaryCopy}>
          {roundNo === 1
            ? '按下去就是第 1 回合正式決鬥開始:同時關閉下注、開始計時。前置(讓守關元、讓半血)在按之前做完。'
            : `第 ${roundNo} 回合開始前,前置(讓守關元、讓半血)要再做一次。做完再按,計時從按下那一刻起算。`}
        </p>
        <div className={styles.actions}>
          <Button size="lg" loading={pending} onClick={onStart}>
            第 {roundNo} 回合正式決鬥開始
          </Button>
        </div>
      </div>
    );
  }

  // key 綁回合:換回合就重掛,上一回合點到一半的勝者不會帶進下一回合。
  return (
    <LiveRound
      key={open.roundNo}
      round={open}
      match={match}
      p1={p1}
      p2={p2}
      bestOf={bestOf}
      pending={pending}
      onFinish={onFinish}
    />
  );
}

function LiveRound({
  round,
  match,
  p1,
  p2,
  bestOf,
  pending,
  onFinish,
}: {
  round: MatchRound;
  match: Match;
  p1: Player | undefined;
  p2: Player | undefined;
  bestOf: number;
  pending: boolean;
  onFinish: RoundControlsProps['onFinish'];
}) {
  const [winner, setWinner] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const need = winsNeeded(bestOf);
  const sides = [
    {
      id: match.p1PlayerPublicId,
      name: p1?.displayName ?? match.p1PlayerPublicId,
      wins: match.p1RoundWins,
    },
    {
      id: match.p2PlayerPublicId,
      name: p2?.displayName ?? match.p2PlayerPublicId,
      wins: match.p2RoundWins,
    },
  ];
  const picked = sides.find((s) => s.id === winner);
  const decisive = picked !== undefined && picked.wins + 1 >= need;

  return (
    <Card live aria-label={`第 ${round.roundNo} 回合`}>
      <CardHeader
        live
        label={`第 ${round.roundNo} 回合 · 進行中`}
        aside={<span className={styles.mono}>{bestOf > 1 ? `先拿 ${need} 勝` : '單場定勝負'}</span>}
      />
      <CardBody>
        <div className={styles.timerBlock}>
          {round.startedAt === undefined ? null : <RoundTimer startedAt={round.startedAt} />}
          <p className={styles.hint}>分出勝負後點勝者,再按下面那顆確定。</p>

          <div className={styles.pickRow} role="group" aria-label="回合勝者">
            {sides.map((s) => (
              <button
                key={s.id}
                type="button"
                className={[styles.pick, winner === s.id ? styles.picked : ''].join(' ')}
                aria-pressed={winner === s.id}
                disabled={pending}
                onClick={() => {
                  setWinner(winner === s.id ? null : s.id);
                }}
              >
                <span>{s.name}</span>
                <span className={styles.mono}>{s.wins} 勝</span>
              </button>
            ))}
          </div>

          {picked === undefined ? null : (
            <>
              <label className={styles.label}>
                備註(爭議回合的裁決理由,進稽核紀錄)
                <textarea
                  className={styles.field}
                  rows={2}
                  value={note}
                  disabled={pending}
                  onChange={(e) => {
                    setNote(e.target.value);
                  }}
                />
              </label>
              <p className={styles.ask}>
                {decisive
                  ? `這一勝讓 ${picked.name} 拿到 ${need} 勝:整場定案,觸發晉級與派彩。不可逆。`
                  : `判 ${picked.name} 贏第 ${round.roundNo} 回合之後改不回來。`}
              </p>
              <div className={styles.actions}>
                <Button
                  variant="danger"
                  size="lg"
                  loading={pending}
                  onClick={() => {
                    onFinish(round.roundNo, picked.id, note.trim());
                  }}
                >
                  確定判 {picked.name} 贏第 {round.roundNo} 回合
                </Button>
              </div>
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

/** 每秒重算一次。role="timer" 但不 aria-live:螢幕閱讀器不該每秒被唸一次。 */
function RoundTimer({ startedAt }: { startedAt: Timestamp }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, []);
  return (
    <span className={styles.timer} role="timer" aria-label="本回合已進行">
      {formatDuration(now - timestampMs(startedAt))}
    </span>
  );
}

/** mm:ss;超過一小時才出現小時位 —— 一回合通常幾分鐘,固定 h:mm:ss 只是多兩個永遠是 0 的字。 */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 已打過的回合。時長是 finished_at − started_at;進行中的那一回合寫「進行中」而不是數字。 */
export function RoundHistory({
  match,
  p1,
  p2,
}: {
  match: Match;
  p1: Player | undefined;
  p2: Player | undefined;
}) {
  if (match.rounds.length === 0) return null;
  const nameOf = (id: string) =>
    id === match.p1PlayerPublicId ? (p1?.displayName ?? id) : (p2?.displayName ?? id);
  return (
    <table className={styles.rounds}>
      <thead>
        <tr>
          <th scope="col">回合</th>
          <th scope="col">勝者</th>
          <th scope="col" className={styles.num}>
            時長
          </th>
        </tr>
      </thead>
      <tbody>
        {match.rounds.map((r) => (
          <tr key={r.roundNo}>
            <td className={styles.num}>{r.roundNo}</td>
            <td>{r.winnerPlayerPublicId === '' ? '進行中' : nameOf(r.winnerPlayerPublicId)}</td>
            <td className={styles.num}>
              {r.startedAt === undefined || r.finishedAt === undefined
                ? '—'
                : formatDuration(timestampMs(r.finishedAt) - timestampMs(r.startedAt))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
