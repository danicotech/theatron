'use client';
import { useEffect, useRef, useState } from 'react';
import { readRegistrationRoles, type SavedRole } from './registrationRolesRuntime.js';
import styles from './Participation.module.css';

export function SavedLoadoutRoles({
  eventId,
  userId,
  onApply,
  onEdit,
  selectedKey = '',
}: {
  eventId: string;
  userId: string;
  onApply: (role: SavedRole) => void;
  onEdit: (role: SavedRole) => void;
  selectedKey?: string;
}) {
  const [roles, setRoles] = useState<SavedRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const selected = selectedKey;
  const apply = useRef(onApply);
  apply.current = onApply;
  useEffect(() => {
    const lifetime = new AbortController();
    setLoading(true);
    setError('');
    setRoles([]);

    void (async () => {
      try {
        const response = await fetch('/loadout/data/catalog.json', { signal: lifetime.signal });
        if (!response.ok) throw new Error('備戰圖庫讀取失敗，請重試。');
        const catalog: unknown = await response.json();
        if (lifetime.signal.aborted) return;
        const found = readRegistrationRoles(localStorage, catalog, eventId, userId);
        setRoles(found);
        const query = new URLSearchParams(location.search);
        if (
          query.get('artsUser') === userId &&
          (query.get('sportsEvent') || query.get('event')) === eventId &&
          query.has('loadoutRole')
        ) {
          const source = query.get('roleSource') === 'library' ? 'library' : 'event';
          const role = found.find((r) => r.id === query.get('loadoutRole') && r.source === source);
          if (role?.ready) {
            apply.current(role);
          } else setError('這份備戰角色尚未完成或已移除，請重新選擇或前往我的武學配置。');
          const url = new URL(location.href);
          for (const key of ['loadoutRole', 'roleSource', 'artsUser']) url.searchParams.delete(key);
          history.replaceState(history.state, '', url);
        }
      } catch (cause) {
        if (!lifetime.signal.aborted)
          setError(cause instanceof Error ? cause.message : '無法讀取備戰角色，請重試。');
      } finally {
        if (!lifetime.signal.aborted) setLoading(false);
      }
    })();
    const refresh = () => setAttempt((n) => n + 1);
    window.addEventListener('storage', refresh);
    return () => {
      lifetime.abort();
      window.removeEventListener('storage', refresh);
    };
  }, [eventId, userId, attempt]);
  return (
    <section aria-label="已儲存的備戰角色" className={styles.savedRoles}>
      {loading && <p role="status">正在讀取備戰角色…</p>}
      {error && (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            重新讀取
          </button>
        </p>
      )}
      {!loading && !error && roles.length === 0 && <p>還沒有備戰角色，先前往我的武學配置建立。</p>}
      {roles.map((role) => (
        <button
          type="button"
          key={role.source + ':' + role.id}
          aria-pressed={role.ready ? selected === role.source + ':' + role.id : undefined}
          onClick={() => {
            if (!role.ready) {
              onEdit(role);
              return;
            }
            apply.current(role);
          }}
        >
          <strong>{role.name}</strong>
          <span>
            {role.character.style || '尚未選流派'}
            {role.character.weapon && ' · ' + role.character.weapon}
          </span>
          <small>
            {!role.ready
              ? '配置未完成，請前往我的武學配置'
              : selected === role.source + ':' + role.id
                ? '已套用'
                : '套用角色'}{' '}
            · {role.source === 'library' ? '本機角色庫' : '此活動'}
          </small>
        </button>
      ))}
    </section>
  );
}
