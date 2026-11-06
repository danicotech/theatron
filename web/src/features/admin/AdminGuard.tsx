'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Code, ConnectError } from '@connectrpc/connect';
import { platformApi } from '../../lib/api/client';
import { DiscordAccess } from '../member/DiscordAccess';
import { MemberStatus } from '../member/MemberAccess';
export function AdminGuard({ children }: { children: ReactNode }) {
  const path = usePathname(),
    [status, setStatus] = useState('loading'),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (path === '/judge/login') return;
    let active = true;
    setStatus('loading');
    void platformApi.auth
      .getMember({})
      .then(({ member }) => {
        if (active) setStatus(member?.canManage ? 'allowed' : 'denied');
      })
      .catch((err) => {
        if (active)
          setStatus(ConnectError.from(err).code === Code.Unauthenticated ? 'anonymous' : 'error');
      });
    return () => {
      active = false;
    };
  }, [path, attempt]);
  if (path === '/judge/login' || status === 'allowed') return children;
  return (
    <MemberStatus>
      {status === 'loading' ? (
        <p role="status">確認管理權限…</p>
      ) : status === 'anonymous' ? (
        <DiscordAccess next={path} />
      ) : status === 'denied' ? (
        <div>
          <h1>此帳號沒有管理權限</h1>
          <p>請使用已列入管理員名單的 Discord 帳號。</p>
          <DiscordAccess next={path} />
        </div>
      ) : (
        <div>
          <p role="alert">無法確認管理權限。</p>
          <button onClick={() => setAttempt((n) => n + 1)}>重試</button>
        </div>
      )}
    </MemberStatus>
  );
}
