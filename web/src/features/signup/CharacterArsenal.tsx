'use client';

import { BuildCard } from '../signup/BuildCard';
import { useEffect, useId, useRef, useState } from 'react';
import type { CharacterConfig } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import styles from './CharacterArsenal.module.css';

const fields = [
  { key: 'style', name: 'characterStyle', label: '流派', groups: ['builds'], limit: 200 },
  { key: 'weapon', name: 'characterWeapon', label: '武器', groups: ['weapons'], limit: 200 },
  { key: 'equipment', name: 'characterEquipment', label: '裝備', groups: ['sets'], limit: 2000 },
  {
    key: 'arts',
    name: 'characterArts',
    label: '武學',
    groups: ['martials', 'minds', 'arts'],
    limit: 2000,
  },
] as const;
type Field = (typeof fields)[number];
type Key = Field['key'];
type Group = Field['groups'][number];
type Item = { key: string; name: string; img?: string; weapons?: string[] };
type Catalog = Record<Group, Item[]>;
const groupLabels: Record<Group, string> = {
  builds: '流派',
  weapons: '武器',
  sets: '裝備套裝',
  martials: '武學',
  minds: '心法',
  arts: '奇術',
};
function parseCatalog(input: unknown): Catalog {
  if (!input || typeof input !== 'object') throw Error('武庫資料不完整，請重新讀取。');
  const result = {} as Catalog;
  for (const group of Object.keys(groupLabels) as Group[]) {
    const values = (input as Record<string, unknown>)[group];
    if (!Array.isArray(values) || !values.length) throw Error('武庫資料不完整，請重新讀取。');
    result[group] = values.map((value: unknown) => {
      if (!value || typeof value !== 'object') throw Error('武庫資料不完整，請重新讀取。');
      const item = value as Record<string, unknown>;
      if (typeof item.key !== 'string' || typeof item.name !== 'string' || !item.name.trim())
        throw Error('武庫資料不完整，請重新讀取。');
      return {
        key: item.key,
        name: item.name,
        ...(typeof item.img === 'string' &&
        /^[\w/-]+\.(png|webp)$/.test(item.img) &&
        !item.img.includes('..')
          ? { img: item.img }
          : {}),
      };
    });
  }
  const martials = (input as Record<string, unknown>).martials as Record<string, unknown>[];
  for (const build of result.builds) {
    const keys = [
      ...new Set(martials.filter((m) => m.build === build.key).map((m) => m.weaponKey)),
    ];
    build.weapons = keys.flatMap((key) =>
      result.weapons.filter((w) => w.key === key).map((w) => w.name),
    );
  }
  return result;
}

export function CharacterArsenal({ defaults }: { defaults?: CharacterConfig | undefined }) {
  const id = useId();
  const pickerHeading = useRef<HTMLHeadingElement>(null);
  const triggers = useRef<Partial<Record<Key, HTMLButtonElement | null>>>({});
  const [values, setValues] = useState<Record<Key, string>>(() => ({
    style: defaults?.style ?? '',
    weapon: defaults?.weapon ?? '',
    equipment: defaults?.equipment ?? '',
    arts: defaults?.arts ?? '',
  }));
  const [active, setActive] = useState<Key | null>(null);
  const [group, setGroup] = useState<Group>('builds');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [limitError, setLimitError] = useState('');
  useEffect(() => {
    if (active) {
      pickerHeading.current?.focus({ preventScroll: true });
      pickerHeading.current?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [active]);
  useEffect(() => {
    if (!active || catalog) return;
    const controller = new AbortController();
    setError('');
    void fetch('/loadout/data/catalog.json', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw Error('武庫暫時無法讀取，請重試。');
        const data: unknown = await response.json();
        if (!controller.signal.aborted) setCatalog(parseCatalog(data));
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : '武庫暫時無法讀取，請重試。');
      });
    return () => controller.abort();
  }, [active, catalog, attempt]);
  const field = fields.find((f) => f.key === active);
  const close = () => {
    const key = active;
    setActive(null);
    if (key) triggers.current[key]?.focus();
  };
  const choose = (item: Item) => {
    if (!field || (field.key === 'style' && item.weapons?.length !== 2)) return;
    const selected = values[field.key].split('、').filter(Boolean);
    const next = selected.includes(item.name)
      ? selected.filter((name) => name !== item.name)
      : field.key === 'style'
        ? [item.name]
        : [...selected, item.name];
    const value = next.join('、');
    if (value.length > field.limit) {
      setLimitError('所選內容過多，請先移除部分項目。');
      return;
    }
    setLimitError('');
    setValues((previous) => ({
      ...previous,
      [field.key]: value,
      ...(field.key === 'style' && value ? { weapon: item.weapons!.join('、') } : {}),
    }));
  };
  return (
    <div className={styles.root}>
      <div className={styles.fields}>
        {fields.map((f) => (
          <section className={styles.field} key={f.key} aria-label={f.label}>
            <div className={styles.fieldHeading}>
              <strong>{f.label}</strong>
              <button
                ref={(node) => {
                  triggers.current[f.key] = node;
                }}
                type="button"
                aria-expanded={active === f.key}
                aria-controls={id}
                onClick={() => {
                  setActive(active === f.key ? null : f.key);
                  setGroup(f.groups[0]);
                  setLimitError('');
                }}
              >
                從武庫選擇{f.label}
              </button>
            </div>
            <input type="hidden" name={f.name} value={values[f.key]} />
            <div className={styles.value} aria-live="polite">
              {f.key === 'style' ? <BuildCard name={values[f.key]} /> : values[f.key] || '尚未選擇'}
            </div>
            {values[f.key] && (
              <button
                className={styles.clear}
                type="button"
                onClick={() => {
                  setValues((previous) => ({ ...previous, [f.key]: '' }));
                  setLimitError('');
                }}
              >
                清除{f.label}
              </button>
            )}
          </section>
        ))}
      </div>
      <section
        id={id}
        hidden={!field}
        className={styles.picker}
        aria-label={field ? `${field.label}武庫` : '武庫'}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            close();
          }
        }}
      >
        {field && (
          <>
            <div className={styles.heading}>
              <h3 ref={pickerHeading} tabIndex={-1}>
                選擇{field.key === 'equipment' ? '裝備套裝' : field.label}
              </h3>
              <button type="button" onClick={close}>
                完成選擇
              </button>
            </div>
            {field.groups.length > 1 && (
              <div className={styles.categories} aria-label="武學分類">
                {field.groups.map((g) => (
                  <button
                    type="button"
                    key={g}
                    aria-pressed={group === g}
                    onClick={() => setGroup(g)}
                  >
                    {groupLabels[g]}
                  </button>
                ))}
              </div>
            )}
            {!catalog && !error && <p role="status">正在開啟武庫…</p>}
            {error && (
              <p role="alert">
                {error}{' '}
                <button type="button" onClick={() => setAttempt((n) => n + 1)}>
                  重新讀取
                </button>
              </p>
            )}
            {limitError && <p role="alert">{limitError}</p>}
            {catalog && (
              <div className={styles.options} data-builds={group === 'builds'}>
                {catalog[group].map((item) => (
                  <button
                    className={group === 'builds' ? styles.buildOption : styles.option}
                    type="button"
                    key={item.key}
                    aria-label={item.name}
                    aria-describedby={group === 'builds' ? `${id}-${item.key}-weapons` : undefined}
                    disabled={group === 'builds' && item.weapons?.length !== 2}
                    aria-pressed={values[field.key].split('、').includes(item.name)}
                    onClick={() => choose(item)}
                  >
                    {group === 'builds' ? (
                      <BuildCard name={item.name} />
                    ) : (
                      <>
                        {/* Existing local catalog artwork; explicit dimensions prevent layout shifts. */}
                        {item.img ? (
                          <img
                            src={'/loadout/assets/' + item.img}
                            width={56}
                            height={56}
                            alt=""
                            loading="lazy"
                          />
                        ) : (
                          <span className={styles.seal} aria-hidden="true">
                            {item.name.slice(0, 1)}
                          </span>
                        )}
                        <span className={styles.optionContent}>{item.name}</span>
                      </>
                    )}
                    {group === 'builds' && (
                      <span hidden id={`${id}-${item.key}-weapons`}>
                        {item.weapons?.length === 2 ? item.weapons.join('・') : '武器資料待補'}
                      </span>
                    )}
                    <span className={styles.mark} aria-hidden="true">
                      {values[field.key].split('、').includes(item.name) ? '✓' : '+'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
