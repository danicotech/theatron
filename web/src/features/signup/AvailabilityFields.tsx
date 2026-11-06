'use client';
import { formValue } from './formValue';

import { useId, useState } from 'react';
import styles from './AvailabilityFields.module.css';

type Slot = { id: number; date: string; start: string; end: string };
const pattern = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})–(\d{2}:\d{2})$/;

function initialSlots(value: string): { slots: Slot[]; legacy: string } {
  const lines = value.split('\n').filter(Boolean);
  const slots: Slot[] = [];
  const legacy: string[] = [];
  for (const line of lines) {
    const match = pattern.exec(line);
    if (match) slots.push({ id: slots.length, date: match[1]!, start: match[2]!, end: match[3]! });
    else legacy.push(line);
  }
  return { slots, legacy: legacy.join('\n') };
}

export function readAvailability(form: FormData): string {
  if (!form.has('availabilityEditor')) return formValue(form, 'availability').trim();
  const dates = form.getAll('availabilityDate').map(String);
  const starts = form.getAll('availabilityStart').map(String);
  const ends = form.getAll('availabilityEnd').map(String);
  if (dates.length > 20) throw new Error('最多可設定 20 組可出賽時段。');
  const slots = dates
    .map((date, i) => ({ date, start: starts[i] ?? '', end: ends[i] ?? '' }))
    .filter((slot) => slot.date || slot.start || slot.end);
  for (const slot of slots) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(slot.date) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot.start) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot.end)
    )
      throw new Error('請完整選擇每組時段的日期、開始時間與結束時間。');
    if (slot.end <= slot.start) throw new Error('結束時間必須晚於開始時間；跨日請分成兩組。');
  }
  const sorted = [...slots].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1]!,
      current = sorted[i]!;
    if (current.date === previous.date && current.start < previous.end)
      throw new Error('同一天的出賽時段有重疊，請調整或移除重複時段。');
  }
  const legacy = formValue(form, 'availabilityLegacy').trim();
  return [legacy, ...sorted.map((slot) => `${slot.date} ${slot.start}–${slot.end}`)]
    .filter(Boolean)
    .join('\n');
}

export function AvailabilityFields({ defaultValue = '' }: { defaultValue?: string }) {
  const id = useId();
  const [initial] = useState(() => initialSlots(defaultValue));
  const [slots, setSlots] = useState<Slot[]>(initial.slots);
  const [legacy, setLegacy] = useState(initial.legacy);
  const [nextId, setNextId] = useState(initial.slots.length);
  function update(slotId: number, field: 'date' | 'start' | 'end', value: string) {
    setSlots((current) =>
      current.map((slot) => (slot.id === slotId ? { ...slot, [field]: value } : slot)),
    );
  }
  return (
    <fieldset className={styles.group}>
      <legend>
        可出賽時段 <small>台灣時間</small>
      </legend>
      <input type="hidden" name="availabilityEditor" value="calendar" />
      <input type="hidden" name="availabilityLegacy" value={legacy} />
      {legacy && (
        <div className={styles.legacy}>
          <p>{legacy}</p>
          <button type="button" onClick={() => setLegacy('')}>
            移除原時段
          </button>
        </div>
      )}
      {slots.map((slot, index) => (
        <div className={styles.slot} key={slot.id}>
          <div>
            <label htmlFor={`${id}-${slot.id}-date`}>日期 {index + 1}</label>
            <input
              id={`${id}-${slot.id}-date`}
              type="date"
              name="availabilityDate"
              value={slot.date}
              onInput={(e) => update(slot.id, 'date', e.currentTarget.value)}
              onChange={(e) => update(slot.id, 'date', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`${id}-${slot.id}-start`}>開始時間 {index + 1}</label>
            <input
              id={`${id}-${slot.id}-start`}
              type="time"
              name="availabilityStart"
              value={slot.start}
              onInput={(e) => update(slot.id, 'start', e.currentTarget.value)}
              onChange={(e) => update(slot.id, 'start', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`${id}-${slot.id}-end`}>結束時間 {index + 1}</label>
            <input
              id={`${id}-${slot.id}-end`}
              type="time"
              name="availabilityEnd"
              value={slot.end}
              onInput={(e) => update(slot.id, 'end', e.currentTarget.value)}
              onChange={(e) => update(slot.id, 'end', e.target.value)}
            />
          </div>
          <button
            type="button"
            className={styles.remove}
            aria-label={`移除時段 ${index + 1}`}
            onClick={() => setSlots((current) => current.filter((item) => item.id !== slot.id))}
          >
            −
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.add}
        disabled={slots.length >= 20}
        onClick={() => {
          setSlots((current) => [...current, { id: nextId, date: '', start: '', end: '' }]);
          setNextId((value) => value + 1);
        }}
      >
        ＋ 新增時段
      </button>
    </fieldset>
  );
}
