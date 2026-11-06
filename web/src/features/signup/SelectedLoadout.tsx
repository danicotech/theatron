'use client';
import { BuildCard } from '../signup/BuildCard';
import { HelpTip } from '../chrome/HelpTip';
import { useEffect, useId, useState, useRef } from 'react';
import { Button } from '@theatron/ui';
import Link from 'next/link';
import { readRegistrationRoles, type SavedRole } from '../sportsbook/registrationRolesRuntime.js';
import type { CharacterConfig } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import styles from './SelectedLoadout.module.css';
import { LoadoutPreview } from './LoadoutPreview';
import { loadoutPreview, readPreviewData, type Preview } from './loadoutPreviewModel';
import { readLoadoutSnapshot, serializeLoadoutSnapshot } from './loadoutSnapshot';
type Character = Pick<CharacterConfig, 'style' | 'weapon' | 'equipment' | 'arts'> &
  Partial<Pick<CharacterConfig, 'snapshotJson'>>;
const empty: Character = { style: '', weapon: '', equipment: '', arts: '' };
export function SelectedLoadout({
  slug,
  memberId,
  defaults,
  onConfirm,
  onEdit,
  returnTarget = 'enrollment',
  compact = false,
  locked = false,
  lockedLabel = '本屆參賽配置已鎖定',
  confirmLabel = '使用此武庫，確認',
}: {
  slug: string;
  memberId: string;
  defaults?: Character | undefined;
  onConfirm?: (character: Character, role: SavedRole) => void | Promise<void>;
  onEdit?: () => void;
  returnTarget?: 'enrollment' | 'member';
  compact?: boolean;
  locked?: boolean;
  lockedLabel?: string;
  confirmLabel?: string;
}) {
  const id = useId();
  const initialStyle = useRef(defaults?.style);
  const returnedRoleHandled = useRef(false);
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [catalogData, setCatalogData] = useState<unknown>(null);
  const [roles, setRoles] = useState<SavedRole[]>([]),
    [candidate, setCandidate] = useState<SavedRole | null>(null);
  const [confirmed, setConfirmed] = useState<Character>(defaults ?? empty),
    [saved, setSaved] = useState(!!defaults?.style);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  useEffect(() => {
    if (!memberId) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void fetch('/loadout/data/catalog.json', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error('武庫讀取失敗，請重試。');
        const catalog: unknown = await res.json();
        if (controller.signal.aborted) return;
        const found = readRegistrationRoles(localStorage, catalog, slug, memberId);
        setRoles(found);
        setCatalogData(catalog);
        setPreviews(
          Object.fromEntries(
            found.map((role) => [
              `${role.source}:${role.id}`,
              loadoutPreview(
                catalog,
                role.character,
                readPreviewData(localStorage, role, slug, memberId),
              ),
            ]),
          ),
        );
        const requested = new URLSearchParams(location.search).get('loadoutRole');
        if (requested && !locked && !returnedRoleHandled.current) {
          const returned = found.find((role) => role.source === 'library' && role.id === requested);
          if (returned) {
            returnedRoleHandled.current = true;
            setCandidate(returned);
            setSaved(false);
          }
        } else if (compact && !initialStyle.current) {
          setCandidate(found.find((role) => role.source === 'library') ?? null);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : '武庫讀取失敗。');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    const refresh = () => setAttempt((n) => n + 1);
    window.addEventListener('storage', refresh);
    return () => {
      controller.abort();
      window.removeEventListener('storage', refresh);
    };
  }, [slug, memberId, attempt, compact, locked]);
  async function confirm() {
    if (!candidate || !candidate.ready || locked || confirming) return;
    setConfirming(true);
    setConfirmError('');
    try {
      const preview = previews[`${candidate.source}:${candidate.id}`];
      if (!preview) throw new Error('請重新讀取並確認武庫。');
      const snapshot = { ...candidate.character, snapshotJson: serializeLoadoutSnapshot(preview) };
      await onConfirm?.(snapshot, candidate);
      setConfirmed(snapshot);
      setSaved(true);
      // Consume the handoff after success so a refresh cannot reopen the same draft.
      if (compact) {
        const url = new URL(location.href);
        url.searchParams.delete('loadoutRole');
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      }
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : '儲存失敗，請重試。');
    } finally {
      setConfirming(false);
    }
  }
  const visual =
    (candidate && !saved && !locked && previews[`${candidate.source}:${candidate.id}`]) ||
    readLoadoutSnapshot(confirmed.snapshotJson) ||
    loadoutPreview(catalogData, confirmed);
  if (compact) {
    const editHref = `/loadout?t=${encodeURIComponent(slug)}&returnTo=member${candidate ? `&loadoutRole=${encodeURIComponent(candidate.id)}` : ''}`;
    return (
      <section className={styles.panel} aria-label="武庫選擇">
        <div className={styles.library}>
          <div>
            <div className="help-heading">
              <strong>個人武庫</strong>
              <HelpTip label="個人武庫" text="隨時可編輯，不影響已確認的參賽配置。" />
            </div>
          </div>
          <Link className={styles.editLink} href={editHref}>
            編輯個人武庫 ↗
          </Link>
        </div>
        <div className={styles.competitionState} data-locked={locked} role="status">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            {locked ? (
              <>
                <rect x="5" y="10" width="14" height="11" rx="1" />
                <path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" />
              </>
            ) : (
              <>
                <path d="m5 12 4 4L19 6" />
                <path d="M20 13v7H4V4h10" />
              </>
            )}
          </svg>
          <div>
            <strong>
              {locked ? lockedLabel : defaults?.style ? '開賽前 · 可更換參賽配置' : '選擇參賽配置'}
            </strong>
            <HelpTip
              label="參賽配置"
              text={
                locked
                  ? '以下為已確認的參賽配置，無法更換。'
                  : '選擇武庫後，按確認才會套用至本屆報名。'
              }
            />
          </div>
        </div>
        {loading ? <p role="status">讀取武庫中…</p> : null}
        {error ? (
          <p role="alert">
            {error} <Button onClick={() => setAttempt((n) => n + 1)}>重試</Button>
          </p>
        ) : null}
        {roles.length > 0 && !locked && (
          <label className={styles.choice}>
            武庫方案
            <select
              value={candidate ? `${candidate.source}:${candidate.id}` : ''}
              disabled={confirming || locked}
              onChange={(e) => {
                const next = roles.find((role) => `${role.source}:${role.id}` === e.target.value);
                setCandidate(next ?? null);
                setSaved(false);
                setConfirmError('');
              }}
            >
              <option value="">{defaults?.style ? '目前參賽配置' : '選擇方案'}</option>
              {roles.map((role) => (
                <option key={`${role.source}:${role.id}`} value={`${role.source}:${role.id}`}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <h4 className={styles.previewTitle}>
          {candidate && !saved && !locked ? '待確認配置' : '目前參賽配置'}
        </h4>
        <LoadoutPreview preview={visual} />
        {candidate && !saved && !locked ? (
          <Button
            variant="primary"
            disabled={!candidate.ready || confirming}
            onClick={() => void confirm()}
          >
            {confirming ? '儲存中…' : confirmLabel}
          </Button>
        ) : null}
        {candidate && !candidate.ready && !locked ? (
          <p className={styles.status}>請至武庫完成配置</p>
        ) : null}
        {saved && candidate ? (
          <p role="status" className={styles.status}>
            參賽配置已確認更新
          </p>
        ) : null}
        {confirmError ? <p role="alert">{confirmError}</p> : null}
      </section>
    );
  }
  function edit() {
    onEdit?.();
    const url = new URL('/loadout', location.origin);
    url.searchParams.set('slug', slug);
    url.searchParams.set('returnTo', returnTarget);
    url.searchParams.set('t', slug);
    if (candidate) url.searchParams.set('loadoutRole', candidate.id);
    location.assign(url.href);
  }
  return (
    <section className={styles.panel} aria-labelledby={id}>
      <div className={styles.heading}>
        <h3 id={id}>
          報名武庫
          <HelpTip
            label="報名武庫"
            text="在武庫完成配置後返回，選擇方案並按確認，才會套用至本屆報名。"
          />
        </h3>
        <Button variant="primary" type="button" onClick={edit}>
          前往武器庫配置
        </Button>
      </div>
      {loading ? <p role="status">正在讀取武庫…</p> : null}
      {error ? (
        <p role="alert">
          {error}{' '}
          <Button type="button" onClick={() => setAttempt((n) => n + 1)}>
            重新讀取
          </Button>
        </p>
      ) : null}
      {!loading && !error && !roles.length ? <p>先建立並保存一套武庫，再回來選擇。</p> : null}
      <div className={styles.options}>
        {roles.map((role) => (
          <button
            key={role.source + role.id}
            type="button"
            className={styles.option}
            disabled={locked || confirming}
            aria-pressed={candidate?.id === role.id && candidate.source === role.source}
            onClick={() => {
              setCandidate(role);
              setSaved(false);
            }}
          >
            <strong>{role.name}</strong>
            <span>
              <BuildCard name={role.character.style} />
            </span>
            <small>{role.ready ? '檢視配置' : '尚未完成配置'}</small>
          </button>
        ))}
      </div>
      {(candidate || saved) && (
        <div className={styles.review}>
          <h4>{candidate?.name ?? '目前報名使用的武庫'}</h4>
          <LoadoutPreview preview={visual} />
          {candidate && !saved ? (
            <Button
              variant="primary"
              type="button"
              disabled={!candidate.ready || confirming || locked}
              onClick={() => void confirm()}
            >
              使用此武庫，確認
            </Button>
          ) : (
            <p role="status">已確認此武庫</p>
          )}
        </div>
      )}
      {confirmError ? <p role="alert">{confirmError}</p> : null}
      <input type="hidden" name="characterSnapshot" value={confirmed.snapshotJson ?? ''} />
      <input type="hidden" name="loadoutPending" value={candidate && !saved ? 'true' : 'false'} />
      {(['style', 'weapon', 'equipment', 'arts'] as const).map((key, i) => (
        <input
          type="hidden"
          key={key}
          name={['characterStyle', 'characterWeapon', 'characterEquipment', 'characterArts'][i]}
          value={confirmed[key]}
        />
      ))}
    </section>
  );
}
