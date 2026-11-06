'use client';
import { safeReturnPath } from '../member/returnPath';
import { formValue } from './formValue';
import { Code, ConnectError } from '@connectrpc/connect';
import { Button } from '@theatron/ui';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type FormEvent } from 'react';
import { activityApi } from '../../lib/api/activity';
import { platformApi } from '../../lib/api/client';
import styles from './PlayerLogin.module.css';
export interface PlayerLoginProps {
  slug: string;
  next?: string;
  onSuccess?: () => Promise<void>;
}
export function PlayerLogin({ slug, onSuccess, next = '' }: PlayerLoginProps) {
  const router = useRouter(),
    id = useId(),
    lock = useRef(false);
  const [pending, setPending] = useState(false),
    [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError('');
    const data = new FormData(e.currentTarget);
    try {
      await platformApi.auth.loginMember({
        discordUsername: formValue(data, 'discord'),
        password: formValue(data, 'password'),
      });
      if (safeReturnPath(next)) {
        router.replace(safeReturnPath(next));
        return;
      }
      const { member } = await platformApi.auth.getMember({});
      if (member?.canManage) {
        router.replace('/judge');
        return;
      }
      try {
        await activityApi.signup.login({ tournamentSlug: slug });
      } catch (err) {
        if (ConnectError.from(err).code === Code.NotFound) {
          router.push(`/t/${encodeURIComponent(slug)}/enroll`);
          return;
        }
        throw err;
      }
      if (onSuccess) await onSuccess();
      else router.push(`/t/${encodeURIComponent(slug)}/me`);
    } catch (err) {
      setError(ConnectError.from(err).rawMessage);
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <form className={styles.form} onSubmit={(e) => void submit(e)}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={id + 'discord'}>
          帳號
        </label>
        <input
          className={styles.input}
          id={id + 'discord'}
          name="discord"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          disabled={pending}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={id + 'password'}>
          密碼
        </label>
        <input
          className={styles.input}
          id={id + 'password'}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <Button
        variant="primary"
        type="submit"
        loading={pending}
        size="lg"
        fullWidth
        data-plaque="accent"
        data-ink-wave="off"
      >
        登入
      </Button>
    </form>
  );
}
