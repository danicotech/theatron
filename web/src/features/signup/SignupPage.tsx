'use client';
import { HelpTip } from '../chrome/HelpTip';
import Link from 'next/link';
import { memberLoginHref } from '../member/returnPath';
import { useEffect, useState } from 'react';
import { Code, ConnectError } from '@connectrpc/connect';
import { platformApi } from '../../lib/api/client';
import { activityApi } from '../../lib/api/activity';
import type { MemberProfile } from '../../lib/api/gen/hestia/platform/v1/auth_pb';
import { TournamentPhase } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { ConnectionStatus } from '../realtime/ConnectionStatus';
import { useTournamentRealtime } from '../realtime/useTournamentRealtime';
import { tournamentRealtime } from '../realtime/tournamentRealtime';
import { SignupForm } from './SignupForm';
import styles from './SignupPage.module.css';
export function SignupPage({ slug }: { slug: string }) {
  const state = useTournamentRealtime(slug);
  const [member, setMember] = useState<MemberProfile | null>(null),
    [status, setStatus] = useState<'loading' | 'anonymous' | 'ready' | 'enrolled' | 'error'>(
      'loading',
    );
  const [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setStatus('loading');
    void (async () => {
      try {
        const res = await platformApi.auth.getMember({});
        if (!res.member) throw new Error('會員資料未回傳');
        if (!active) return;
        setMember(res.member);
        try {
          await activityApi.signup.login({ tournamentSlug: slug });
          if (active) setStatus('enrolled');
        } catch (err) {
          if (ConnectError.from(err).code === Code.NotFound) {
            if (active) setStatus('ready');
          } else throw err;
        }
      } catch (err) {
        if (!active) return;
        const ce = ConnectError.from(err);
        setStatus(ce.code === Code.Unauthenticated ? 'anonymous' : 'error');
        setError(ce.rawMessage);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug, attempt]);
  const base = `/t/${encodeURIComponent(slug)}`;
  if (status === 'loading') return <p role="status">正在確認會員資料…</p>;
  if (status === 'anonymous')
    return (
      <section className={styles.gate} aria-labelledby="enrollment-access-title">
        <h2 id="enrollment-access-title">
          先登入，再報名
          <HelpTip label="報名登入" text="登入後直接返回此處，選擇武庫並填寫參賽資料。" />
        </h2>

        <div className={styles.gateActions}>
          <Link className={styles.gatePrimary} href={memberLoginHref(slug, base + '/enroll')}>
            使用帳號註冊／登入
          </Link>
        </div>
      </section>
    );
  if (status === 'error')
    return (
      <div>
        <p role="alert">{error}</p>
        <button type="button" onClick={() => setAttempt((n) => n + 1)}>
          重試
        </button>
      </div>
    );
  if (status === 'enrolled')
    return (
      <div className={styles.done}>
        <h2 className={styles.doneName}>報名資料已保存</h2>
        <Link className={styles.link} href={base + '/me?view=registration'}>
          查看我的報名
        </Link>
        <Link className={styles.link} href={base + '/me?view=character'}>
          查看報名武庫
        </Link>
      </div>
    );
  return (
    <div className={styles.stack}>
      <p>
        {member?.displayName} <span>／ @{member?.discordUsername}</span>
      </p>
      {state.status !== 'ready' && <ConnectionStatus slug={slug} state={state} />}
      {state.tournament && state.tournament.phase !== TournamentPhase.SIGNUP ? (
        <p>本屆尚未開放或已截止報名。</p>
      ) : state.tournament && member ? (
        <SignupForm
          slug={slug}
          member={member}
          rulesVersion={state.tournament.rulesVersion}
          disabled={state.status !== 'ready'}
          onDone={() => {
            tournamentRealtime(slug).invalidate();
            setAttempt((n) => n + 1);
          }}
        />
      ) : null}
    </div>
  );
}
