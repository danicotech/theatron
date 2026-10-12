'use client';

import { useEffect, useState } from 'react';
import { execute, readState } from './database';
import { Sportsbook } from './Sportsbook';
import styles from './Sportsbook.module.css';

/** Only mounted after an explicit registration action, never on homepage load. */
export function RegistrationEntry({
  eventId = '',
  embedded = false,
  scrollForm = false,
  onResolved,
  onReady,
}: {
  eventId?: string | undefined;
  embedded?: boolean;
  scrollForm?: boolean;
  onResolved?: (id: string) => void;
  onReady?: (ready: boolean) => void;
}) {
  const [resolved, setResolved] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setResolved('');
    onReady?.(false);
    void (async () => {
      try {
        setError('');
        let id = eventId || (await execute({ type: 'registration-open' }));
        let state = await readState();
        const selected = state.events.find((e) => e.id === id);
        if (!selected) throw new Error('找不到這場活動，請確認報名連結。');
        // A preview match snapshot is not an enrollment activity. Resolve the
        // existing local registration instead of trapping this entry in read-only mode.
        if (!selected.registration && new URLSearchParams(location.search).get('preview') === '1') {
          id = await execute({ type: 'registration-open' });
          state = await readState();
          if (!state.events.some((e) => e.id === id && e.registration))
            throw new Error('報名表尚未準備完成，請重試。');
        }
        if (active) {
          if (!embedded) {
            const url = new URL(location.href);
            url.searchParams.set('event', id);
            url.searchParams.set('tab', 'participation');
            history.replaceState(null, '', url);
          }
          setResolved(id);
          onResolved?.(id);
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : '報名資料讀取失敗，請重試。');
          onReady?.(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [eventId, attempt, embedded, onResolved, onReady]);
  if (!resolved)
    return (
      <div className={styles.app} data-embedded={embedded}>
        <h2>報名赴約</h2>
        {error ? (
          <>
            <p role="alert" className={styles.error}>
              {error}
            </p>
            <button onClick={() => setAttempt((n) => n + 1)}>重新讀取報名表</button>
          </>
        ) : (
          <p role="status">正在開啟報名表…</p>
        )}
      </div>
    );
  return (
    <Sportsbook
      key={resolved}
      initialEventId={resolved}
      registrationOnly
      embedded={embedded}
      scrollForm={scrollForm}
      onRegistrationReady={onReady}
    />
  );
}
