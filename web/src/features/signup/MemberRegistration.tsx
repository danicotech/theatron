'use client';
import { HelpTip } from '../chrome/HelpTip';
import { safeReturnPath } from '../member/returnPath';
import { formValue } from './formValue';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ConnectError } from '@connectrpc/connect';
import { Button } from '@theatron/ui';
import { platformApi } from '../../lib/api/client';
import styles from './PlayerLogin.module.css';
export function MemberRegistration({ slug, next = '' }: { slug: string; next?: string }) {
  const id = useId(),
    router = useRouter(),
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
      await platformApi.auth.registerMember({
        displayName: formValue(data, 'discord').trim(),
        email: formValue(data, 'email').trim(),
        discordUsername: formValue(data, 'discord').trim(),
        password: formValue(data, 'password'),
      });
      router.replace(safeReturnPath(next, `/t/${encodeURIComponent(slug)}/enroll`));
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
        <label className={styles.label} htmlFor={id + 'email'}>
          Email
        </label>
        <input
          className={styles.input}
          id={id + 'email'}
          name="email"
          type="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
          autoComplete="email"
          disabled={pending}
        />
      </div>
      <div className={styles.field}>
        <div className="help-heading">
          <label className={styles.label} htmlFor={id + 'discord'}>
            帳號
          </label>
          <HelpTip label="帳號" text="2–32 個英文字母、數字、底線或句點。" />
        </div>
        <input
          className={styles.input}
          id={id + 'discord'}
          name="discord"
          required
          minLength={2}
          maxLength={32}
          pattern="[A-Za-z0-9_.]{2,32}"
          aria-describedby={id + 'account-help'}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          disabled={pending}
        />
      </div>
      <p id={id + 'account-help'} hidden>
        2–32 個英文字母、數字、底線或句點。
      </p>
      <div className={styles.field}>
        <div className="help-heading">
          <label className={styles.label} htmlFor={id + 'password'}>
            密碼
          </label>
          <HelpTip label="密碼" text="至少 8 個字元。" />
        </div>
        <input
          className={styles.input}
          id={id + 'password'}
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={256}
          autoComplete="new-password"
          aria-describedby={id + 'help'}
          disabled={pending}
        />
        <p id={id + 'help'} hidden>
          至少 8 個字元。
        </p>
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
        註冊並登入
      </Button>
    </form>
  );
}
