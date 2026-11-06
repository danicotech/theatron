'use client';

import { HelpTip } from '../chrome/HelpTip';
import { Code, ConnectError, createClient } from '@connectrpc/connect';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { platformApi, platformTransport } from '../../lib/api/client';
import {
  ToolHand,
  ToolMode,
  ToolPhase,
  ToolService,
  type ToolRoomResponse,
} from '../../lib/api/gen/hestia/activity/v1/tools_pb';
import styles from './ToolsRoom.module.css';

const api = createClient(ToolService, platformTransport);
const hands = [
  [ToolHand.ROCK, '石頭'],
  [ToolHand.PAPER, '布'],
  [ToolHand.SCISSORS, '剪刀'],
] as const;
const dots = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];

export function DiceFace({ value }: { value: number }) {
  return (
    <svg
      viewBox="0 0 90 90"
      role="img"
      aria-label={`${value} 點`}
      className={styles.die}
      data-red={value === 1 || value === 4 || undefined}
    >
      <rect x="3" y="3" width="84" height="84" rx="10" />
      {(dots[value] ?? []).map((p) => (
        <circle key={p} cx={23 + (p % 3) * 22} cy={23 + Math.floor(p / 3) * 22} r="6" />
      ))}
    </svg>
  );
}

export function ToolsRoom({
  initialCode = '',
  initialRoom = '',
}: {
  initialCode?: string;
  initialRoom?: string;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialCode);
  const [roomId, setRoomId] = useState(initialRoom);
  const [snapshot, setSnapshot] = useState<ToolRoomResponse | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(ToolMode.DICE);
  const [count, setCount] = useState(1);
  const [copied, setCopied] = useState('');
  const [syncMessage, setSyncMessage] = useState('正在連接房間…');
  const nameInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const nameEdited = useRef(false);
  const pending = useRef(false);
  useEffect(() => {
    const life = new AbortController();
    void platformApi.auth
      .getMember({}, { signal: life.signal })
      .then(({ member }) => {
        if (!life.signal.aborted && !nameEdited.current && member) {
          setName(
            Array.from(member.displayName || member.discordUsername)
              .slice(0, 24)
              .join(''),
          );
        }
      })
      .catch(() => {
        /* Guests can enter a room name without a member account. */
      });
    return () => life.abort();
  }, []);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(''), 2500);
    return () => clearTimeout(timer);
  }, [copied]);
  const accept = useCallback((next: ToolRoomResponse) => {
    setSnapshot((old) =>
      old?.room &&
      next.room &&
      old.room.publicId === next.room.publicId &&
      old.room.revision > next.room.revision
        ? old
        : next,
    );
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const life = new AbortController();
    let stream: AbortController | undefined;
    const offline = () => {
      setConnected(false);
      setSyncMessage('網路已離線，恢復連線後會自動同步。');
      stream?.abort();
    };
    const resume = () => {
      if (document.visibilityState === 'visible') stream?.abort();
    };
    window.addEventListener('offline', offline);
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    async function watch() {
      let failures = 0;
      while (!life.signal.aborted) {
        stream = new AbortController();
        const attempt = stream;
        let watchdog: ReturnType<typeof setTimeout>;
        const heartbeat = () => {
          clearTimeout(watchdog);
          watchdog = setTimeout(() => {
            setConnected(false);
            attempt.abort();
          }, 35000);
        };
        heartbeat();
        const cancel = () => attempt.abort();
        life.signal.addEventListener('abort', cancel, { once: true });
        try {
          for await (const value of api.watchRoom(
            { roomPublicId: roomId },
            { signal: stream.signal },
          )) {
            if (life.signal.aborted) return;
            heartbeat();
            accept(value);
            setConnected(true);
            setError('');
            failures = 0;
            if (value.room?.phase === ToolPhase.CLOSED) return;
          }
        } catch (err) {
          if (life.signal.aborted) return;
          const e = ConnectError.from(err);
          if ([Code.PermissionDenied, Code.NotFound, Code.Unauthenticated].includes(e.code)) {
            setSnapshot(null);
            setRoomId('');
            if (location.pathname === '/tools') history.replaceState(null, '', '/tools');
            setError(
              e.code === Code.Unauthenticated
                ? '房間身分已失效，請輸入稱呼與邀請碼重新加入。'
                : e.rawMessage,
            );
            return;
          }
          setSyncMessage('連線中斷，正在重新同步…');
        } finally {
          clearTimeout(watchdog!);
          life.signal.removeEventListener('abort', cancel);
        }
        if (life.signal.aborted) return;
        setConnected(false);
        setSyncMessage('連線中斷，正在重新同步…');
        await new Promise<void>((resolve) => {
          const done = () => {
            clearTimeout(timer);
            life.signal.removeEventListener('abort', done);
            resolve();
          };
          const timer = setTimeout(done, Math.min(1000 * 2 ** failures++, 10000));
          life.signal.addEventListener('abort', done, { once: true });
        });
      }
    }
    void watch();
    return () => {
      life.abort();
      stream?.abort();
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [roomId, accept]);

  async function run(action: () => Promise<ToolRoomResponse>, entering = false) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const value = await action();
      accept(value);
      if (entering && value.room) {
        setConnected(false);
        setSyncMessage('正在連接房間…');
        setCode(value.room.inviteCode);
        setRoomId(value.room.publicId);
        if (location.pathname === '/tools')
          history.replaceState(null, '', '/tools?room=' + encodeURIComponent(value.room.publicId));
      }
    } catch (err) {
      setError(ConnectError.from(err).rawMessage);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function enter(joining: boolean) {
    if (!name.trim()) {
      setError('請先填寫你的稱呼，再建立或加入房間。');
      nameInput.current?.focus();
      return;
    }
    const inviteCode = code.trim().toUpperCase();
    if (joining && !/^[0-9A-HJKMNP-TV-Z]{10}$/.test(inviteCode)) {
      setError('請輸入完整的 10 碼房間邀請碼。');
      codeInput.current?.focus();
      return;
    }
    void run(
      () =>
        joining
          ? api.joinRoom({ inviteCode, name: name.trim() })
          : api.createRoom({ name: name.trim() }),
      true,
    );
  }
  async function copyInvite(kind: 'link' | 'code') {
    if (!snapshot?.room) return;
    try {
      await navigator.clipboard.writeText(
        kind === 'code'
          ? snapshot.room.inviteCode
          : `${location.origin}/tools?code=${encodeURIComponent(snapshot.room.inviteCode)}`,
      );
      setCopied(kind === 'code' ? '代碼已複製' : '連結已複製');
    } catch {
      setError('無法存取剪貼簿，請選取並複製畫面上的邀請碼。');
    }
  }
  const room = snapshot?.room;
  const me = room?.participants.find((p) => p.publicId === snapshot?.mePublicId);
  const owner = room?.ownerPublicId === snapshot?.mePublicId;
  const collecting = room?.phase === ToolPhase.COLLECTING;
  const revealed = room?.phase === ToolPhase.REVEALED;
  const locked = busy || !connected;
  const active = room?.participants.filter((p) => p.active) ?? [];
  const roster = room?.participants.filter((p) => p.inRound) ?? [];
  const reset = () => {
    setRoomId('');
    setSnapshot(null);
    setConnected(false);
    setError('');
    if (location.pathname === '/tools') history.replaceState(null, '', '/tools');
  };

  return (
    <section className={styles.tools} aria-label="江湖雅戲" data-paper-window="plaque">
      <header className={styles.heading}>
        <h1>
          <span className={styles.seal} aria-hidden="true">
            戲
          </span>
          江湖雅戲
          <HelpTip
            label="江湖雅戲"
            text="每間可容納 2～12 人，房間保留 24 小時。使用不同裝置開啟邀請連結即可加入。"
          />
        </h1>
      </header>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      {!room ? (
        <div className={styles.lobby}>
          {roomId ? (
            <p role="status">正在重新連上房間…</p>
          ) : (
            <>
              <label>
                你的稱呼（必填）
                <input
                  ref={nameInput}
                  value={name}
                  onChange={(e) => {
                    nameEdited.current = true;
                    setName(e.target.value);
                  }}
                  maxLength={24}
                  placeholder="輸入房間內顯示的名稱"
                  autoComplete="nickname"
                />
              </label>
              <button
                type="button"
                disabled={busy}
                className={styles.primary}
                data-plaque="accent"
                data-ink-wave="off"
                onClick={() => enter(false)}
              >
                建立房間
              </button>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  enter(true);
                }}
              >
                <label>
                  邀請碼
                  <input
                    ref={codeInput}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\s/g, '').toUpperCase())}
                    maxLength={32}
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                </label>
                <button disabled={busy} data-plaque data-ink-wave="off">
                  加入房間
                </button>
              </form>
            </>
          )}
        </div>
      ) : (
        <>
          <div className={styles.roomBar}>
            <div className={styles.invite}>
              <span className={styles.note}>房間邀請碼</span>
              <strong className={styles.code}>{room.inviteCode}</strong>
            </div>
            <div className={styles.shareActions}>
              <button type="button" onClick={() => void copyInvite('link')}>
                複製連結
              </button>
              <button type="button" onClick={() => void copyInvite('code')}>
                複製代碼
              </button>
              <span role="status" className={styles.copyStatus}>
                {copied}
              </span>
            </div>
            <span role="status" className={styles.sync} data-live={connected || undefined}>
              {room.phase === ToolPhase.CLOSED ? '房間已關閉' : connected ? '已同步' : syncMessage}
            </span>
          </div>
          {room.phase === ToolPhase.CLOSED ? (
            <button type="button" data-plaque data-ink-wave="off" onClick={reset}>
              返回江湖雅戲
            </button>
          ) : (
            <div className={styles.workspace}>
              <aside className={styles.people} aria-label="房間成員">
                <h2>
                  參與者 <span className={styles.number}>{active.length} / 12</span>
                </h2>
                <ul>
                  {active.map((p) => (
                    <li key={p.publicId}>
                      <span className={styles.person}>
                        {p.name}
                        {p.publicId === snapshot?.mePublicId ? '（你）' : ''}
                        {p.publicId === room.ownerPublicId ? (
                          <span className={styles.tag}>房主</span>
                        ) : null}
                      </span>
                      <small data-submitted={(collecting && p.inRound && p.submitted) || undefined}>
                        {collecting
                          ? p.inRound
                            ? p.submitted
                              ? '已提交'
                              : '準備中'
                            : '下回合加入'
                          : '已加入'}
                      </small>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={locked || (collecting && !owner)}
                  onClick={() => {
                    if (
                      owner &&
                      !window.confirm('關閉房間後，所有人都會離開本次江湖雅戲。確定關閉？')
                    )
                      return;
                    void run(async () => {
                      const res = await api.leaveRoom({ roomPublicId: room.publicId });
                      reset();
                      return { ...res, room: undefined };
                    });
                  }}
                >
                  {owner ? '關閉房間' : '離開房間'}
                </button>
              </aside>
              <div className={styles.play}>
                <div className={styles.roundHead}>
                  <h2>{room.roundNumber ? `第 ${room.roundNumber} 回合` : '準備開局'}</h2>
                  <span className={styles.tag}>
                    {room.mode === ToolMode.HANDS
                      ? '猜拳'
                      : room.mode === ToolMode.DICE
                        ? `擲骰 · ${room.diceCount} 顆`
                        : ''}
                  </span>
                </div>
                {owner && !collecting ? (
                  <form
                    className={styles.settings}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(() =>
                        api.startRound({
                          roomPublicId: room.publicId,
                          expectedRound: room.roundNumber,
                          mode,
                          diceCount: count,
                        }),
                      );
                    }}
                  >
                    <label>
                      本回合工具
                      <select value={mode} onChange={(e) => setMode(Number(e.target.value))}>
                        <option value={ToolMode.DICE}>擲骰子</option>
                        <option value={ToolMode.HANDS}>猜拳</option>
                      </select>
                    </label>
                    {mode === ToolMode.DICE ? (
                      <label>
                        每人骰子顆數
                        <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                          {[1, 2, 3, 4].map((n) => (
                            <option key={n} value={n}>
                              {n} 顆
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <button
                      className={styles.primary}
                      data-plaque="accent"
                      data-ink-wave="off"
                      disabled={locked || active.length < 2}
                    >
                      {room.roundNumber ? '開始下一回合' : '開始回合'}
                    </button>
                  </form>
                ) : null}
                {!collecting && !revealed ? (
                  <p className={styles.note}>
                    {room.phase === ToolPhase.CANCELED
                      ? '本回合已取消，未揭曉的提交不公開。'
                      : active.length < 2
                        ? '分享邀請碼，等朋友加入後開始。'
                        : '等候房主開始回合。'}
                  </p>
                ) : null}
                {collecting ? (
                  <div className={styles.submit}>
                    <p>
                      {roster.filter((p) => p.submitted).length} / {roster.length}{' '}
                      人已提交，全部完成後一起揭曉。
                    </p>
                    {!me?.inRound ? (
                      <p>你會從下一回合加入。</p>
                    ) : me.submitted ? (
                      <p role="status">已封存你的提交，等待其他人。</p>
                    ) : room.mode === ToolMode.DICE ? (
                      <button
                        type="button"
                        className={styles.primary}
                        data-plaque="accent"
                        data-ink-wave="off"
                        disabled={locked}
                        onClick={() =>
                          void run(() =>
                            api.submitChoice({
                              roomPublicId: room.publicId,
                              roundNumber: room.roundNumber,
                            }),
                          )
                        }
                      >
                        擲出 {room.diceCount} 顆骰子
                      </button>
                    ) : (
                      <div className={styles.hands} role="group" aria-label="選擇出拳">
                        {hands.map(([hand, label]) => (
                          <button
                            type="button"
                            data-plaque
                            data-ink-wave="off"
                            key={hand}
                            disabled={locked}
                            onClick={() =>
                              void run(() =>
                                api.submitChoice({
                                  roomPublicId: room.publicId,
                                  roundNumber: room.roundNumber,
                                  hand,
                                }),
                              )
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                    {owner ? (
                      <button
                        type="button"
                        className={styles.cancel}
                        disabled={locked}
                        onClick={() => {
                          if (window.confirm('取消本回合？已提交的內容不會揭曉。'))
                            void run(() =>
                              api.cancelRound({
                                roomPublicId: room.publicId,
                                roundNumber: room.roundNumber,
                              }),
                            );
                        }}
                      >
                        取消回合
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {revealed ? (
                  <section aria-label="回合結果" className={styles.results} key={room.roundNumber}>
                    <h2 className="help-heading">
                      回合結果
                      <HelpTip
                        label="回合結果"
                        text={
                          room.mode === ToolMode.HANDS
                            ? '只有兩種拳時，剋制的一方勝出；只有一種或三種拳皆為平手。'
                            : '每人以骰子總點數比大小；最高分可多人並列。'
                        }
                      />
                    </h2>
                    <p role="status" className={styles.verdict}>
                      {room.draw
                        ? '平手'
                        : `${roster
                            .filter((p) => p.winner)
                            .map((p) => p.name)
                            .join('、')} 勝出`}
                    </p>
                    <div className={styles.resultGrid}>
                      {roster.map((p) => (
                        <article
                          key={p.publicId}
                          className={styles.result}
                          data-winner={(!room.draw && p.winner) || undefined}
                        >
                          <h3>
                            {p.name}
                            {p.publicId === snapshot?.mePublicId ? '（你）' : ''}
                          </h3>
                          {!room.draw && p.winner ? (
                            <span className={styles.winSeal} aria-hidden="true">
                              勝
                            </span>
                          ) : null}
                          {room.mode === ToolMode.DICE ? (
                            <>
                              <div className={styles.bowl}>
                                {p.dice.map((value, i) => (
                                  <div
                                    className={styles.pop}
                                    style={{ '--delay': `${i * 120}ms` } as CSSProperties}
                                    key={i}
                                  >
                                    <DiceFace value={value} />
                                  </div>
                                ))}
                              </div>
                              <p className={styles.total}>
                                合計 {p.dice.reduce((a, b) => a + b, 0)} 點
                              </p>
                            </>
                          ) : (
                            <p className={styles.handResult}>
                              {hands.find(([hand]) => hand === p.hand)?.[1]}
                            </p>
                          )}
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
