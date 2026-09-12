'use client';

import { ConnectError } from '@connectrpc/connect';
import { Button } from '@theatron/ui';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';

import { activityApi } from '../../lib/api/activity';

import styles from './PlayerLogin.module.css';

/**
 * 選手進站。
 *
 * **只要遊戲ID,沒有密碼**(2026-09-13 定案)。代價是明確的:遊戲ID 全服唯一
 * 且公開,所以知道你遊戲ID 的人就能用你的身分花掉你的 BP。裁判能做的補救是
 * 把人標成棄賽 —— 非參賽中的選手一律進不來。
 *
 * 因此這一頁**不寫「登入」兩個字**:沒有密碼的東西叫登入會讓人以為它保護了什麼。
 */

export interface PlayerLoginProps {
  slug: string;
}

export function PlayerLogin({ slug }: PlayerLoginProps) {
  const router = useRouter();
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const v = new FormData(e.currentTarget).get('gameId');
    const gameId = typeof v === 'string' ? v.trim() : '';
    if (gameId === '') return;

    setPending(true);
    setError(null);
    try {
      await activityApi.signup.login({ tournamentSlug: slug, gameId });
      router.push(`/t/${slug}`);
    } catch (err) {
      setError(ConnectError.from(err).message);
      setPending(false);
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        void submit(e);
      }}
      noValidate
    >
      <div className={styles.field}>
        <label className={styles.label} htmlFor={id}>
          遊戲ID
        </label>
        <input
          className={styles.input}
          id={id}
          name="gameId"
          required
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />
        <p className={styles.help}>就是你報名時填的那一個。</p>
      </div>

      {error === null ? null : (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" loading={pending} fullWidth>
        進站
      </Button>
    </form>
  );
}
