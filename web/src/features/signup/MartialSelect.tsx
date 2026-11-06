'use client';
import { useEffect, useId, useState } from 'react';
import styles from './RegistrationFields.module.css';

export function MartialSelect({ defaultValue = '' }: { defaultValue?: string }) {
  const id = useId();
  const [names, setNames] = useState<string[]>([]);
  const [selected, setSelected] = useState(defaultValue);
  const [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    void fetch('/loadout/data/catalog.json', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error('catalog');
        const data: unknown = await res.json();
        if (
          !data ||
          typeof data !== 'object' ||
          !('martials' in data) ||
          !Array.isArray(data.martials)
        )
          throw new Error('catalog');
        const options = data.martials.flatMap((item: unknown) =>
          item && typeof item === 'object' && 'name' in item && typeof item.name === 'string'
            ? [item.name]
            : [],
        );
        if (!options.length) throw new Error('catalog');
        if (!controller.signal.aborted) setNames([...new Set(options)]);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [attempt]);
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        常用武學
      </label>
      <select
        className={styles.input}
        id={id}
        name="arts"
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
      >
        <option value="">
          {names.length ? '請選擇' : error ? '武學清單讀取失敗' : '正在讀取武學…'}
        </option>
        {selected && !names.includes(selected) && (
          <option value={selected}>{selected}（原有資料）</option>
        )}
        {names.map((name) => (
          <option value={name} key={name}>
            {name}
          </option>
        ))}
      </select>
      {error && (
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          重新讀取武學
        </button>
      )}
    </div>
  );
}
