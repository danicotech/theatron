'use client';

import { ConnectError } from '@connectrpc/connect';
import { Button } from '@theatron/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';

import { platformApi } from '../../lib/api/client';

import styles from './JudgeLogin.module.css';

/**
 * 裁判登入。
 *
 * 兩條路都通到同一種 session:之後沒有任何一支 RPC 需要知道這個人是怎麼進來的。
 *
 * 為什麼裁判有密碼而選手沒有:裁判能判勝負、觸發真代幣派彩、發獎金。
 * 選手的身分被冒用,損失是那個人的 BP;裁判的身分被冒用,損失是整屆的錢。
 */

/** 回程只收站內相對路徑 —— 從網址列來的值不能直接拿去導向。 */
function safeNext(raw: string | null): string {
  if (raw === null || !raw.startsWith('/') || raw.startsWith('//')) return '/judge';
  return raw;
}

export function JudgeLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const ids = { name: useId(), passcode: useId() };

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const form = new FormData(e.currentTarget);
    const read = (k: string): string => {
      const v = form.get(k);
      return typeof v === 'string' ? v.trim() : '';
    };
    const loginName = read('loginName');
    const passcode = read('passcode');
    if (loginName === '' || passcode === '') return;

    setPending(true);
    setError(null);
    try {
      await platformApi.auth.localLogin({ loginName, passcode });
      router.push(next);
    } catch (err) {
      setError(ConnectError.from(err).message);
      setPending(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>御風羽</p>
        <h1 className={styles.title}>裁判登入</h1>
      </header>

      <form
        className={styles.form}
        onSubmit={(e) => {
          void submit(e);
        }}
        noValidate
      >
        <div className={styles.field}>
          <label className={styles.label} htmlFor={ids.name}>
            登入名
          </label>
          <input
            className={[styles.input, styles.mono].join(' ')}
            id={ids.name}
            name="loginName"
            required
            autoComplete="username"
            spellCheck={false}
            autoFocus
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={ids.passcode}>
            通行碼
          </label>
          <input
            className={[styles.input, styles.mono].join(' ')}
            id={ids.passcode}
            name="passcode"
            type="password"
            required
            autoComplete="current-password"
          />
          <p className={styles.help}>由管理者發給你,只會顯示一次。忘了就請他重新產生一組。</p>
        </div>

        {error === null ? null : (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" loading={pending} fullWidth>
          登入
        </Button>
      </form>

      <div className={styles.alt}>
        <p className={styles.altNote}>如果你的裁判身分是綁 Discord 的:</p>
        <a
          className={styles.altLink}
          href={`/api/auth/discord/start?redirect=${encodeURIComponent(next)}`}
        >
          改用 Discord 登入
        </a>
      </div>
    </div>
  );
}
