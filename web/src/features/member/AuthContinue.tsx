'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { platformApi } from '../../lib/api/client';
import { safeReturnPath, discordLoginHref } from './returnPath';
import { MemberStatus } from './MemberAccess';
export function AuthContinue({ next, slug }: { next: string; slug: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void platformApi.auth
      .getMember({})
      .then(({ member }) => {
        if (!member) throw new Error('Missing member');
        if (active)
          router.replace(
            safeReturnPath(next, member.canManage ? '/judge' : `/t/${encodeURIComponent(slug)}/me`),
          );
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [next, slug, router]);
  return (
    <MemberStatus>
      {failed ? (
        <div>
          <p role="alert">登入確認未完成，請重新登入。</p>
          <a href={discordLoginHref(next)}>重新登入 Discord</a>
        </div>
      ) : (
        <p role="status">登入完成，正在返回…</p>
      )}
    </MemberStatus>
  );
}
