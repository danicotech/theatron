'use client';
import { formValue } from './formValue';
import { create } from '@bufbuild/protobuf';
import { ConnectError } from '@connectrpc/connect';
import { Button } from '@theatron/ui';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { activityApi } from '../../lib/api/activity';
import {
  Rank,
  type RankInfo,
  type CharacterConfig,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';
import type { MemberProfile } from '../../lib/api/gen/hestia/platform/v1/auth_pb';
import { MyRegistrationSchema } from '../../lib/api/gen/hestia/activity/v1/signup_pb';
import { readRegistration, RegistrationFields } from './RegistrationFields';
import { readAvailability } from './AvailabilityFields';
import { SelectedLoadout } from './SelectedLoadout';
import styles from './SignupForm.module.css';
export interface SignupFormProps {
  slug: string;
  member: MemberProfile;
  onDone: (name: string, gameId: string) => void;
  disabled?: boolean;
  rulesVersion?: string;
}
export function SignupForm({
  slug,
  member,
  onDone,
  disabled = false,
  rulesVersion = '',
}: SignupFormProps) {
  const id = useId(),
    lock = useRef(false),
    formRef = useRef<HTMLFormElement>(null);
  const [ranks, setRanks] = useState<RankInfo[]>([]),
    [selfRated, setSelfRated] = useState(Rank.UNSPECIFIED);
  const [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const [character, setCharacter] = useState<Pick<
    CharacterConfig,
    'style' | 'weapon' | 'equipment' | 'arts'
  > | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({}),
    [loaded, setLoaded] = useState(false);
  const draftKey = `enrollment-draft:${slug}:${member.publicId}`;
  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(sessionStorage.getItem(draftKey) ?? '{}');
      if (parsed && typeof parsed === 'object') {
        const valid = Object.fromEntries(
          Object.entries(parsed).filter(
            ([key, value]) =>
              ['gameId', 'ladderRank', 'arts', 'availability', 'selfRated'].includes(key) &&
              typeof value === 'string',
          ),
        );
        setDraft(valid);
        const rank = Number(valid.selfRated);
        if ([0, 1, 2, 3, 4].includes(rank)) setSelfRated(rank);
      }
    } catch {
      /* unavailable storage does not block enrollment */
    }
    setLoaded(true);
    void activityApi.tournament
      .listRanks({ tournamentSlug: slug })
      .then((res) => setRanks(res.ranks))
      .catch(() => setRanks([]));
  }, [slug, draftKey]);
  function saveDraft() {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    const values: Record<string, string> = {
      ...draft,
      selfRated: data.has('selfRated') ? formValue(data, 'selfRated') : String(selfRated),
    };
    for (const key of ['gameId', 'ladderRank', 'arts', 'availability'])
      if (data.has(key)) values[key] = formValue(data, key);
    if (data.has('availabilityEditor')) {
      try {
        values.availability = readAvailability(data);
      } catch {
        /* Keep last complete slots while a new row is being entered. */
      }
    }
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(values));
    } catch {
      setError('瀏覽器無法保存草稿，離開前請先記下已填資料。');
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || disabled) return;
    if (!character) {
      setError('請先選擇並確認報名武庫。');
      return;
    }
    const data = new FormData(event.currentTarget),
      gameId = formValue(data, 'gameId').trim();
    if (!gameId) {
      setError('請填寫遊戲 ID。');
      return;
    }
    lock.current = true;
    setPending(true);
    setError('');
    try {
      const reg = readRegistration(data, selfRated, rulesVersion);
      const res = await activityApi.signup.register({
        tournamentSlug: slug,
        gameId,
        displayName: member.displayName,
        discordName: member.discordUsername,
        selfRatedRank: reg.selfRatedRank,
        ladderRank: reg.ladderRank,
        ladderScore: 0,
        artsNote: reg.artsNote,
        availabilityNote: reg.availabilityNote,
        character,
        acceptedRulesVersion: reg.acceptedRulesVersion,
      });
      if (!res.player) throw new Error('未收到報名結果，請到我的報名確認。');
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        /* enrollment has already been committed */
      }
      onDone(res.player.displayName, gameId);
    } catch (err) {
      setError(ConnectError.from(err).rawMessage);
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  if (!loaded) return <p role="status">正在讀取報名草稿…</p>;
  const defaults = create(MyRegistrationSchema, {
    displayName: member.displayName,
    discordName: member.discordUsername,
    ladderRank: draft.ladderRank ?? '',
    artsNote: draft.arts ?? '',
    availabilityNote: draft.availability ?? '',
  });
  return (
    <form
      ref={formRef}
      className={styles.form}
      onSubmit={(e) => void submit(e)}
      onChange={saveDraft}
    >
      <fieldset className={styles.optional} disabled={pending || disabled}>
        <legend className={styles.legend}>一・選擇報名武庫</legend>
        <SelectedLoadout
          slug={slug}
          memberId={member.publicId}
          onConfirm={setCharacter}
          onEdit={saveDraft}
        />
      </fieldset>
      {character && (
        <fieldset className={styles.optional} disabled={pending || disabled}>
          <legend className={styles.legend}>二・參賽資料</legend>
          <div className={styles.gameIdField}>
            <label className={styles.gameIdLabel} htmlFor={id}>
              遊戲 ID
            </label>
            <input
              className={styles.gameIdInput}
              id={id}
              name="gameId"
              required
              maxLength={128}
              defaultValue={draft.gameId ?? ''}
              autoComplete="off"
            />
          </div>
          <RegistrationFields
            personalOnly
            defaults={defaults}
            ranks={ranks}
            selfRated={selfRated}
            onSelfRated={setSelfRated}
            rulesVersion={rulesVersion}
            rulesHref="/#rules"
          />
          <Button
            variant="primary"
            type="submit"
            size="lg"
            loading={pending}
            disabled={disabled}
            fullWidth
          >
            確認報名
          </Button>
        </fieldset>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
