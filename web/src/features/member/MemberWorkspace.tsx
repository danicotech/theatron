'use client';

import { Code, ConnectError } from '@connectrpc/connect';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { platformApi } from '../../lib/api/client';
import { activityApi } from '../../lib/api/activity';
import type { MemberProfile } from '../../lib/api/gen/hestia/platform/v1/auth_pb';
import { MyBets } from '../betting/MyBets';
import { MyPlayer } from '../signup/MyPlayer';
import { PlayerLogin } from '../signup/PlayerLogin';
import { MemberAccess, MemberStatus } from './MemberAccess';
import { DiscordAccess } from './DiscordAccess';
import { MemberShell, type MemberView } from './MemberShell';
import { MemberOverview } from './MemberOverview';
import { PersonalArmory } from './PersonalArmory';

/** Restore the event session after OAuth without making a spectator enroll. */
export function MemberWorkspace({ slug, view }: { slug: string; view: MemberView }) {
  const [member, setMember] = useState<MemberProfile>();
  const [status, setStatus] = useState<'loading' | 'anonymous' | 'enrolled' | 'member' | 'error'>(
    'loading',
  );
  const [attempt, setAttempt] = useState(0);
  const base = `/t/${encodeURIComponent(slug)}`;
  useEffect(() => {
    let active = true;
    setStatus('loading');
    void (async () => {
      try {
        const result = await platformApi.auth.getMember({});
        if (!result.member) throw new Error('Missing member');
        if (!active) return;
        setMember(result.member);
        try {
          await activityApi.signup.login({ tournamentSlug: slug });
          if (active) setStatus('enrolled');
        } catch (error) {
          if (ConnectError.from(error).code !== Code.NotFound) throw error;
          if (active) setStatus('member');
        }
      } catch (error) {
        if (active)
          setStatus(ConnectError.from(error).code === Code.Unauthenticated ? 'anonymous' : 'error');
      }
    })();
    return () => {
      active = false;
    };
  }, [slug, attempt]);
  const loggedOut = () => {
    setMember(undefined);
    setStatus('anonymous');
  };
  if (status === 'loading')
    return (
      <MemberStatus>
        <p role="status">正在確認會員資料…</p>
      </MemberStatus>
    );
  if (status === 'error')
    return (
      <MemberStatus>
        <p role="alert">會員資料暫時無法讀取。</p>
        <button onClick={() => setAttempt((value) => value + 1)}>重試</button>
      </MemberStatus>
    );
  if (status === 'anonymous')
    return (
      <MemberAccess slug={slug} mode="login" next={base + '/me?view=' + view}>
        <PlayerLogin
          slug={slug}
          onSuccess={() => {
            setAttempt((value) => value + 1);
            return Promise.resolve();
          }}
        />
        <DiscordAccess next={base + '/me'} />
      </MemberAccess>
    );
  if (view === 'bets')
    return (
      <MemberShell slug={slug} view={view} onLogout={loggedOut} canManage={member?.canManage}>
        <MyBets slug={slug} embedded />
      </MemberShell>
    );
  if (status === 'enrolled') return <MyPlayer slug={slug} view={view} member={member} />;
  if (view === 'character')
    return (
      <MemberShell slug={slug} view={view} onLogout={loggedOut} canManage={member?.canManage}>
        <PersonalArmory slug={slug} memberId={member?.publicId ?? ''} />
      </MemberShell>
    );
  return (
    <MemberShell slug={slug} view={view} onLogout={loggedOut} canManage={member?.canManage}>
      {view === 'overview' ? (
        <MemberOverview member={member} />
      ) : (
        <>
          <h3>{member?.displayName}</h3>
          <p>已登入，尚未報名本屆賽事。</p>
          <p>
            <Link href={base + '/enroll'}>前往報名</Link>
          </p>
        </>
      )}
    </MemberShell>
  );
}
