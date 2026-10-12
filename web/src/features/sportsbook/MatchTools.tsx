'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './MatchTools.module.css';

export type Hand = '剪刀' | '石頭' | '布';
const hands: Hand[] = ['剪刀', '石頭', '布'];
export function handWinner(a: Hand, b: Hand): 0 | 1 | 2 {
  if (a === b) return 0;
  return (a === '剪刀' && b === '布') ||
    (a === '石頭' && b === '剪刀') ||
    (a === '布' && b === '石頭')
    ? 1
    : 2;
}
export function diceValue() {
  const value = new Uint32Array(1);
  // Rejection sampling keeps all six sides equally likely.
  do {
    crypto.getRandomValues(value);
  } while (value[0]! >= 4294967292);
  return (value[0]! % 6) + 1;
}

/**
 * Single-device demo only; deliberately has no tournament writes.
 * The planned referee/player invitation flow belongs in ../match-tools/ after
 * Hestia contracts are available. See docs/REALTIME_INTEGRATION.md; local random
 * results and device handoff must never stand in for a synchronized room.
 */
export function MatchTools() {
  const [mode, setMode] = useState<'dice' | 'hands'>('dice');
  const [names, setNames] = useState(['甲方', '乙方']);
  const [dice, setDice] = useState<number[] | null>(null);
  const [rolling, setRolling] = useState(false);
  const [choices, setChoices] = useState<Hand[]>([]);
  const [handoff, setHandoff] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const name = (i: number) => names[i]?.trim() || (i === 0 ? '甲方' : '乙方');
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function reset() {
    if (timer.current) clearTimeout(timer.current);
    busy.current = false;
    setDice(null);
    setRolling(false);
    setChoices([]);
    setHandoff(false);
  }
  function roll() {
    if (busy.current) return;
    busy.current = true;
    setDice(null);
    setRolling(true);
    const result = [diceValue(), diceValue()];
    const finish = () => {
      setDice(result);
      setRolling(false);
      busy.current = false;
      timer.current = null;
    };
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) finish();
    else timer.current = setTimeout(finish, 720);
  }
  const result =
    mode === 'dice'
      ? dice
        ? dice[0] === dice[1]
          ? 0
          : dice[0]! > dice[1]!
            ? 1
            : 2
        : null
      : choices.length === 2
        ? handWinner(choices[0]!, choices[1]!)
        : null;
  return (
    <section className={styles.tools} aria-label="對局小工具">
      <p className={styles.note}>
        比大小或猜拳，雙方自行約定用途；結果不會更改賽程、先後攻或賽果。
      </p>
      <div className={styles.modes} role="group" aria-label="選擇小工具">
        <button
          type="button"
          aria-pressed={mode === 'dice'}
          onClick={() => {
            reset();
            setMode('dice');
          }}
        >
          擲骰比大小
        </button>
        <button
          type="button"
          aria-pressed={mode === 'hands'}
          onClick={() => {
            reset();
            setMode('hands');
          }}
        >
          剪刀石頭布
        </button>
      </div>
      <div className={styles.names}>
        {names.map((value, i) => (
          <label key={i}>
            {i === 0 ? '甲方稱呼' : '乙方稱呼'}
            <input
              value={value}
              maxLength={24}
              disabled={rolling || choices.length > 0}
              onChange={(e) => setNames((old) => old.map((n, j) => (j === i ? e.target.value : n)))}
            />
          </label>
        ))}
      </div>
      {mode === 'dice' ? (
        <>
          <div className={styles.table} aria-hidden="true">
            {[0, 1].map((i) => (
              <div key={i}>
                <span>{name(i)}</span>
                <div className={styles.die} data-rolling={rolling || undefined}>
                  {dice ? (
                    Array.from({ length: 9 }, (_, p) => (
                      <i
                        key={p}
                        data-dot={
                          [
                            [],
                            [4],
                            [0, 8],
                            [0, 4, 8],
                            [0, 2, 6, 8],
                            [0, 2, 4, 6, 8],
                            [0, 2, 3, 5, 6, 8],
                          ][dice[i]!]!.includes(p) || undefined
                        }
                      />
                    ))
                  ) : (
                    <b>?</b>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button className={styles.primary} type="button" disabled={rolling} onClick={roll}>
            {rolling ? '擲骰中…' : dice ? '再擲一次' : '雙方擲骰'}
          </button>
        </>
      ) : (
        <div className={styles.handStage}>
          {handoff ? (
            <>
              <h3>已封存出拳</h3>
              <p>請把畫面交給 {name(1)}，準備好後再繼續。</p>
              <button className={styles.primary} type="button" onClick={() => setHandoff(false)}>
                我是 {name(1)}，開始選擇
              </button>
            </>
          ) : choices.length < 2 ? (
            <>
              <h3>{name(choices.length)}，請出拳</h3>
              <p>
                {choices.length === 0 ? '選好後隱藏，交由另一方出拳。' : '雙方選好後一起揭曉。'}
              </p>
              <div className={styles.hands}>
                {hands.map((hand) => (
                  <button
                    type="button"
                    key={hand}
                    onClick={() => {
                      setChoices((old) => [...old, hand]);
                      if (!choices.length) setHandoff(true);
                    }}
                  >
                    {hand}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className={styles.reveal}>
              {choices.map((hand, i) => (
                <p key={i}>
                  {name(i)}
                  <strong>{hand}</strong>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
      <div className={styles.result} role="status" aria-live="polite">
        {rolling ? (
          '正在擲骰'
        ) : result === null ? (
          '等待雙方結果'
        ) : (
          <>
            {mode === 'dice' && dice && (
              <p>
                {name(0)} {dice[0]} 點 · {name(1)} {dice[1]} 點
              </p>
            )}
            <strong>{result === 0 ? '平手，可再來一次' : `${name(result - 1)} 勝出`}</strong>
          </>
        )}
      </div>
      {mode === 'hands' && choices.length > 0 && (
        <button className={styles.restart} type="button" onClick={reset}>
          {choices.length === 2 ? '再猜一次' : '重新開始'}
        </button>
      )}
    </section>
  );
}
