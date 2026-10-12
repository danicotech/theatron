'use client';

import { useEffect, useRef, useState } from 'react';
import type { Command, Kind, State, Tournament } from './model';
import { shuffleSeats } from './managerEngine';
import { defaultSnapshot } from './engine';
import styles from './ManagerOperations.module.css';

const value = (form: FormData, key: string) => {
  const entry = form.get(key);
  return typeof entry === 'string' ? entry : '';
};

const kinds: [Kind, string][] = [
  ['winner', '整場勝負'],
  ['round', '單局勝負'],
  ['score', 'BO3 比分'],
  ['duration', '單局時間'],
  ['total', '整場時間'],
  ['place', '活動名次'],
];
type Props = {
  event: Tournament;
  state: State;
  busy: boolean;
  run: (command: Command) => Promise<unknown>;
  ask: (command: Command, title: string, description: string) => void;
};

export function ManagerOperations({ event, state, busy, run, ask }: Props) {
  const unpublished = event.registration && !event.registration.published;
  const players = unpublished
    ? event
        .registration!.entries.filter((e) => e.status === 'confirmed')
        .map((e) => ({ id: e.playerId, name: e.name }))
    : event.players;
  const natural = unpublished
    ? players.map((p) => p.id)
    : event.matches
        .filter((m) => m.round === 1 && m.kind === 'bracket')
        .sort((a, b) => a.slot - b.slot)
        .flatMap((m) => [m.p1, m.p2])
        .filter(Boolean);
  const [order, setOrder] = useState<string[] | null>(null);
  const ids = [
    ...(order || natural).filter((id) => players.some((p) => p.id === id)),
    ...natural.filter((id) => order && !order.includes(id)),
  ];
  const preview = ids.length >= 2 ? defaultSnapshot(ids.length) : null;
  const previewIds = new Map(preview?.players.map((p, i) => [p.id, ids[i]!]));
  const firstRound =
    order || unpublished
      ? (preview?.rounds[0]?.matches || []).map((m) => ({
          ...m,
          p1: previewIds.get(m.p1) || '',
          p2: previewIds.get(m.p2) || '',
        }))
      : event.matches
          .filter((m) => m.round === 1 && m.kind === 'bracket')
          .sort((a, b) => a.slot - b.slot);
  const seats = firstRound.flatMap((m) => [
    { id: m.p1, group: m.slot + 1 },
    { id: m.p2, group: m.slot + 1 },
  ]);
  const [drag, setDrag] = useState('');
  const [drawing, setDrawing] = useState<'seats' | 'raffle' | null>(null);
  const [notice, setNotice] = useState('');
  const [kind, setKind] = useState<Kind>('winner');
  const [prizeId, setPrizeId] = useState('');
  const [scope, setScope] = useState('members');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const locked = event.started || state.bets.some((b) => b.eventId === event.id);
  const name = (id: string) => players.find((p) => p.id === id)?.name || '待定';
  function swap(from: string, to: string) {
    if (locked || busy || drawing || from === to) return;
    const next = [...ids],
      a = next.indexOf(from),
      b = next.indexOf(to);
    if (a < 0 || b < 0) return;
    [next[a], next[b]] = [next[b]!, next[a]!];
    setOrder(next);
    setNotice(`${name(from)} 與 ${name(to)} 已交換預覽籤位，儲存後生效。`);
  }
  function animate(type: 'seats' | 'raffle', action: () => void) {
    if (busy || drawing) return;
    setDrawing(type);
    timer.current = setTimeout(
      () => {
        setDrawing(null);
        action();
      },
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900,
    );
  }
  const markets = state.markets.filter((m) => m.eventId === event.id && m.kind === kind);
  const ceremony = event.ceremony;
  const eligible = state.members.filter(
    (m) =>
      !m.anonymous &&
      (scope === 'members' || event.links[m.id]) &&
      !ceremony?.draws.some((d) => d.userId === m.id),
  );
  const prize = state.prizes.find((p) => p.id === prizeId && p.active && p.stock > 0);
  const latestDraw = ceremony?.draws.at(-1);
  return (
    <section className={styles.operations} aria-label="活動管理工具">
      <details>
        <summary>抽籤與籤位安排</summary>
        <p>每列顯示一組對局，空席為輪空。拖曳交換，或使用換位選單；確認後才套用。</p>
        {locked && <p role="status">已有注單或已開賽，籤位已鎖定。</p>}
        <div className={styles.drawStage} data-drawing={drawing === 'seats'} aria-label="求籤台">
          <div className={styles.sticks} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <span>籤</span>
          </div>
          <div>
            <h3>對局求籤</h3>
            <p>全體選手抽取首輪籤位</p>
            <button
              type="button"
              disabled={busy || locked || !!drawing || ids.length < 2}
              onClick={() =>
                animate('seats', () => {
                  setOrder(shuffleSeats(ids));
                  setNotice('抽籤完成，請檢查籤位後套用。');
                })
              }
            >
              {drawing === 'seats' ? '求籤中…' : '抽取籤位'}
            </button>
          </div>
        </div>
        <ol className={styles.seats} aria-label="首輪籤位預覽">
          {seats.map(({ id, group }, i) =>
            !id ? (
              <li key={`bye-${i}`} data-player="" data-group={group}>
                <span className={styles.seatNumber}>
                  第 {group} 組 · 籤 {i + 1}
                </span>
                <strong>輪空</strong>
              </li>
            ) : (
              <li
                key={id}
                data-player={id}
                data-group={group}
                draggable={!locked && !busy && !drawing}
                onDragStart={(e) => {
                  setDrag(id);
                  e.dataTransfer.setData('text/plain', id);
                }}
                onDragEnd={() => setDrag('')}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  swap(e.dataTransfer.getData('text/plain') || drag, id);
                  setDrag('');
                }}
              >
                <span className={styles.seatNumber}>
                  第 {group} 組 · 籤 {i + 1}
                </span>
                <strong>{name(id)}</strong>
                <label>
                  <span className={styles.srOnly}>{name(id)} 換至籤位</span>
                  <select
                    value=""
                    disabled={locked || busy || !!drawing}
                    onChange={(e) => swap(id, e.target.value)}
                  >
                    <option value="">換位…</option>
                    {ids
                      .filter((other) => other !== id)
                      .map((other) => (
                        <option key={other} value={other}>
                          籤 {seats.findIndex((seat) => seat.id === other) + 1} · {name(other)}
                        </option>
                      ))}
                  </select>
                </label>
              </li>
            ),
          )}
        </ol>
        {!ids.length && <p>尚無完成報名的選手。</p>}
        <div className={styles.actions}>
          <p role="status">{notice}</p>
          <button
            disabled={
              locked ||
              busy ||
              !!drawing ||
              ids.length < 2 ||
              !!(unpublished && event.registration?.open)
            }
            onClick={() =>
              ask(
                unpublished
                  ? { type: 'publish-roster', eventId: event.id, playerIds: ids }
                  : { type: 'reseed', eventId: event.id, playerIds: ids },
                unpublished ? '發布抽籤對局' : '套用新籤位',
                `依序安排：${ids.map(name).join('、')}。${unpublished ? '發布後開放投注。' : '已有的盤口投票與讓武選擇會清除。'}`,
              )
            }
          >
            確認套用籤位
          </button>
        </div>
        {unpublished && event.registration?.open && <p>請先在活動設定關閉報名，再發布抽籤對局。</p>}
      </details>

      <details>
        <summary>下注類型與盤口開關</summary>
        <p>類型沿用對應賽果計算。可暫停或重開未開賽項目；有注單後鎖定名稱。</p>
        <div className={styles.actions}>
          <label>
            管理下注類型
            <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              {kinds.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy}
            onClick={() =>
              ask(
                { type: 'market-admin', eventId: event.id, kind, enabled: false },
                '暫停此類型投注',
                '暫停尚未開賽與後續輪次的同類型項目；既有注單保留並依賽果結算。',
              )
            }
          >
            全部暫停
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void run({ type: 'market-admin', eventId: event.id, kind, enabled: true })
            }
          >
            開放未開賽項目
          </button>
        </div>
        <p role="status">
          此類型：
          {event.disabledMarketKinds?.includes(kind)
            ? '已暫停，後續輪次也保持關閉'
            : '開放未開賽及後續輪次'}
        </p>
        <div className={styles.marketList}>
          {markets.map((m) => {
            const match = event.matches.find((x) => x.id === m.matchId);
            const unavailable =
              (m.kind === 'place' ? event.started : match?.status !== 'upcoming') ||
              m.status === 'settled' ||
              m.status === 'void';
            const hasBets = state.bets.some((b) => b.legs.some((l) => l.marketId === m.id));
            return (
              <form
                key={`${m.id}:${m.title}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  void run({
                    type: 'market-admin',
                    eventId: event.id,
                    marketId: m.id,
                    title: value(data, 'title'),
                  });
                }}
              >
                <p>
                  {match
                    ? `第 ${match.round} 輪 · ${name(match.p1)} ／ ${name(match.p2)}`
                    : '全活動'}{' '}
                  ·{' '}
                  {m.status === 'open'
                    ? '開放投注'
                    : m.status === 'closed'
                      ? '已封盤'
                      : m.status === 'void'
                        ? '已作廢'
                        : '已結算'}
                </p>
                <div className={styles.marketRow}>
                  <label>
                    盤口名稱
                    <input
                      name="title"
                      defaultValue={m.title}
                      maxLength={80}
                      required
                      disabled={busy || unavailable || hasBets}
                    />
                  </label>
                  <button disabled={busy || unavailable || hasBets}>儲存名稱</button>
                  <button
                    type="button"
                    disabled={busy || unavailable}
                    onClick={() =>
                      void run({
                        type: 'market-admin',
                        eventId: event.id,
                        marketId: m.id,
                        enabled: m.status !== 'open',
                      })
                    }
                  >
                    {m.status === 'open' ? '暫停投注' : '重新開放'}
                  </button>
                </div>
              </form>
            );
          })}
        </div>
        {!markets.length && <p>此類型尚無盤口；可先設定開關，後續輪次產生時會套用。</p>}
      </details>

      <details>
        <summary>抽獎與頒獎</summary>
        <p>本機抽獎與頒發記錄。抽獎保留一份獎品庫存，同一會員在本活動只中獎一次。</p>
        <div className={styles.drawStage} data-drawing={drawing === 'raffle'}>
          <div className={styles.sticks} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <span>賞</span>
          </div>
          <div>
            <h3>幸運賞</h3>
            <p role="status">
              {drawing === 'raffle'
                ? '正在抽取幸運籤…'
                : latestDraw
                  ? `${latestDraw.name} · ${latestDraw.prize}`
                  : '選擇獎品與名單後抽取'}
            </p>
          </div>
        </div>
        <div className={styles.actions}>
          <label>
            抽獎獎品
            <select value={prizeId} onChange={(e) => setPrizeId(e.target.value)}>
              <option value="">選擇獎品</option>
              {state.prizes
                .filter((p) => p.active && p.stock > 0)
                .map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name} · 餘 {p.stock} 份
                  </option>
                ))}
            </select>
          </label>
          <label>
            抽獎範圍
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="members">所有已註冊會員</option>
              <option value="players">本活動參賽會員</option>
            </select>
          </label>
          <button
            disabled={busy || !!drawing || !prize || !eligible.length}
            onClick={() =>
              animate(
                'raffle',
                () =>
                  void run({
                    type: 'raffle',
                    eventId: event.id,
                    prizeId,
                    userIds: eligible.map((m) => m.id),
                  }),
              )
            }
          >
            {drawing === 'raffle' ? '抽籤中…' : `抽取 1 名（${eligible.length} 人）`}
          </button>
        </div>
        <details>
          <summary>查看本次抽獎名單（{eligible.length} 人）</summary>
          <p>{eligible.map((m) => m.name).join('、') || '尚無符合資格的會員'}</p>
        </details>
        <ul className={styles.records}>
          {ceremony?.draws.map((d) => (
            <li key={d.id}>
              <span>
                <strong>{d.name}</strong> · {d.prize}
              </span>
              {d.delivered ? (
                <span>已標記頒發</span>
              ) : (
                <button
                  disabled={busy}
                  onClick={() =>
                    ask(
                      {
                        type: 'ceremony-deliver',
                        eventId: event.id,
                        recordId: d.id,
                        category: 'draws',
                      },
                      '標記抽獎頒發',
                      `${d.name} · ${d.prize}。僅記錄現場發放狀態。`,
                    )
                  }
                >
                  標記頒發
                </button>
              )}
            </li>
          ))}
        </ul>
        <h3>頒獎名冊</h3>
        <form
          className={styles.awardForm}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            ask(
              {
                type: 'award',
                eventId: event.id,
                playerId: value(f, 'player'),
                title: value(f, 'title'),
                prize: value(f, 'prize'),
              },
              '登錄頒獎名冊',
              `${name(value(f, 'player'))} · ${value(f, 'title')} · ${value(f, 'prize')}。此記錄不更改賽果或自動扣除兌換庫存。`,
            );
          }}
        >
          <label>
            得獎選手
            <select name="player" required defaultValue="">
              <option value="" disabled>
                選擇選手
              </option>
              {event.players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            獎項名稱
            <input name="title" placeholder="例如：冠軍、最佳風采" required maxLength={80} />
          </label>
          <label>
            獎勵內容
            <input name="prize" required maxLength={120} />
          </label>
          <button disabled={busy || !event.players.length}>登錄獎項</button>
        </form>
        <ul className={styles.records}>
          {ceremony?.awards.map((a) => (
            <li key={a.id}>
              <span>
                <strong>{a.title}</strong> · {name(a.playerId)}
                <small>{a.prize}</small>
              </span>
              {a.delivered ? (
                <span>已標記頒發</span>
              ) : (
                <button
                  disabled={busy}
                  onClick={() =>
                    ask(
                      {
                        type: 'ceremony-deliver',
                        eventId: event.id,
                        recordId: a.id,
                        category: 'awards',
                      },
                      '標記獎項頒發',
                      `${a.title} · ${name(a.playerId)}。僅記錄現場發放狀態。`,
                    )
                  }
                >
                  標記頒發
                </button>
              )}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
