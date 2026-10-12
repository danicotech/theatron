'use client';

import { useId, useState } from 'react';
import type { Command, Match, Member, Tournament } from './model';
import { bpBudget, bpCatalog, bpRankNames, bpSelections, bpSpent } from './bp';
import styles from './ParticipantBp.module.css';

export function ParticipantBp({
  event,
  match,
  member,
  busy,
  run,
  manage = false,
}: {
  event: Tournament;
  match: Match;
  member: Member | undefined;
  busy: boolean;
  run: (command: Command) => Promise<boolean>;
  manage?: boolean;
}) {
  const prefix = useId();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [refund, setRefund] = useState<Record<string, string>>({});
  const budget = bpBudget(event, match);
  const selections = bpSelections(event, match);
  const spent = bpSpent(event, match);
  const own = !!member && [match.p1, match.p2].includes(event.links[member.id] || '');
  const canChoose =
    !manage &&
    match.status === 'upcoming' &&
    !!member &&
    !!budget?.playerId &&
    event.links[member.id] === budget.playerId;
  const locked = match.status !== 'upcoming';
  const revealSelections =
    manage || locked || (!!member && budget?.playerId === event.links[member.id]);
  async function submit(command: Command, success: string) {
    setMessage('');
    if (await run(command)) setMessage(success);
  }
  if (!manage && !own) return null;
  return (
    <section className={styles.panel} aria-label="本場讓武 BP">
      <header className={styles.header}>
        <h3>本場讓武</h3>
        <span className={styles.amount}>
          {budget ? `${budget.total - spent} / ${budget.total} BP` : '待評段'}
        </span>
      </header>
      {manage && (
        <div className={styles.ranks}>
          {[match.p1, match.p2].filter(Boolean).map((id) => {
            const player = event.players.find((p) => p.id === id);
            const rankLocked = event.matches.some(
              (m) =>
                [m.p1, m.p2].includes(id) &&
                (m.status !== 'upcoming' || bpSelections(event, m).length),
            );
            return (
              <label key={id}>
                {player?.name} · 大會評段
                <select
                  aria-label={`${player?.name} 大會評段`}
                  value={event.bpRanks?.[id] ?? ''}
                  disabled={busy || rankLocked}
                  onChange={(e) =>
                    void submit(
                      {
                        type: 'bp-rank',
                        eventId: event.id,
                        playerId: id,
                        rank: Number(e.target.value),
                      },
                      '評段已更新。',
                    )
                  }
                >
                  <option value="" disabled>
                    尚未評定
                  </option>
                  {bpRankNames.map((name, i) => (
                    <option key={name} value={i}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      )}
      <p className={styles.note}>
        {locked
          ? '本場已鎖定，讓武配置三局固定。'
          : !budget
            ? '雙方段位由大會評定後，低段位方每差一段取得 8 BP。'
            : !budget.total
              ? '雙方同段，本場不使用 BP。'
              : `由 ${event.players.find((p) => p.id === budget.playerId)?.name} 選擇；開賽後鎖定。`}
      </p>
      {!revealSelections && budget?.total ? (
        <p className={styles.note}>對手正在選擇讓武，開賽鎖定後公布配置。</p>
      ) : null}
      {revealSelections && selections.length > 0 && (
        <ul className={styles.selections}>
          {selections.map((s) => {
            const item = bpCatalog.find((i) => i.id === s.itemId)!;
            return (
              <li key={s.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span className={styles.amount}> {item.cost} BP</span>
                  {s.targetNote && <p>{s.targetNote}</p>}
                  {s.refundReason && <p>已退款：{s.refundReason}</p>}
                </div>
                {!locked && !busy && !s.refundReason && s.userId === member?.id && !manage && (
                  <button
                    type="button"
                    onClick={() =>
                      void submit(
                        {
                          type: 'bp-remove',
                          eventId: event.id,
                          userId: member.id,
                          selectionId: s.id,
                        },
                        '已移除，BP 已返還。',
                      )
                    }
                  >
                    移除
                  </button>
                )}
                {manage && !locked && !s.refundReason && (
                  <div className={styles.refund}>
                    <input
                      aria-label={`${item.name} 退款原因`}
                      placeholder="裁判退款原因"
                      maxLength={200}
                      value={refund[s.id] || ''}
                      onChange={(e) => setRefund({ ...refund, [s.id]: e.target.value })}
                    />
                    <button
                      type="button"
                      disabled={busy || !refund[s.id]?.trim()}
                      onClick={() =>
                        void submit(
                          {
                            type: 'bp-refund',
                            eventId: event.id,
                            selectionId: s.id,
                            reason: refund[s.id]!,
                          },
                          '已記錄裁判退款。',
                        )
                      }
                    >
                      退還 BP
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {revealSelections && !selections.length && <p className={styles.note}>尚未選擇讓武項目。</p>}
      {canChoose && (
        <div className={styles.catalog}>
          {[...new Set(bpCatalog.map((i) => i.category))].map((category) => (
            <details key={category}>
              <summary>{category}</summary>
              {bpCatalog
                .filter((i) => i.category === category)
                .map((item) => {
                  const selected =
                    !item.repeatable &&
                    selections.some((s) => s.itemId === item.id && !s.refundReason);
                  const affordable = item.cost <= budget.total - spent;
                  return (
                    <article key={item.id}>
                      <h4>
                        {item.name}
                        <span className={styles.amount}>{item.cost} BP</span>
                      </h4>
                      <p className={styles.description}>{item.description}</p>
                      {item.requiresTarget && (
                        <label htmlFor={`${prefix}-${item.id}`}>
                          指定內容
                          <input
                            id={`${prefix}-${item.id}`}
                            maxLength={200}
                            value={notes[item.id] || ''}
                            onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                          />
                        </label>
                      )}
                      <button
                        type="button"
                        disabled={
                          busy ||
                          !affordable ||
                          selected ||
                          (item.requiresTarget && !notes[item.id]?.trim())
                        }
                        onClick={() =>
                          void submit(
                            {
                              type: 'bp-select',
                              eventId: event.id,
                              matchId: match.id,
                              userId: member.id,
                              itemId: item.id,
                              targetNote: notes[item.id] || '',
                            },
                            '已加入本場讓武。',
                          )
                        }
                      >
                        {selected ? '已選擇' : !affordable ? 'BP 不足' : '加入讓武'}
                      </button>
                    </article>
                  );
                })}
            </details>
          ))}
        </div>
      )}
      <p role="status" className={styles.note}>
        {message}
      </p>
    </section>
  );
}
