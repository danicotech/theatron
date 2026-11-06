'use client';
import { useState } from 'react';
import { Button } from '@theatron/ui';
import { memberLogout } from '../../lib/api/memberSession';

export function MemberLogout({
  slug,
  onLogout,
}: {
  slug: string;
  onLogout?: (() => void) | undefined;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await memberLogout();
      if (onLogout) onLogout();
      else window.location.replace(`/t/${encodeURIComponent(slug)}/login`);
    } catch {
      setError('登出失敗，請再試一次。');
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <Button loading={pending} disabled={pending} onClick={() => void logout()}>
        登出
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
