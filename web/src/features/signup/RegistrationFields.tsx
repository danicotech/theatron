'use client';
import { formValue } from './formValue';
import { create } from '@bufbuild/protobuf';
import { useId } from 'react';
import {
  MyRegistrationSchema,
  type MyRegistration,
} from '../../lib/api/gen/hestia/activity/v1/signup_pb';
import {
  CharacterConfigSchema,
  Rank,
  type RankInfo,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { SelectedLoadout } from './SelectedLoadout';
import { MartialSelect } from './MartialSelect';
import { AvailabilityFields, readAvailability } from './AvailabilityFields';
import styles from './RegistrationFields.module.css';
export type RegistrationValues = MyRegistration;
export const LADDER_RANKS = [
  '未定段',
  '仗劍',
  '遊刃',
  '開山',
  '斷水',
  '斬風',
  '流雲',
  '藏鋒',
  '飛花',
  '無我',
];
export interface RegistrationFieldsProps {
  characterOnly?: boolean;
  personalOnly?: boolean;
  ranks: RankInfo[];
  rulesVersion?: string;
  rulesHref?: string;
  selfRated: Rank;
  onSelfRated: (rank: Rank) => void;
  defaults?: MyRegistration | undefined;
  displayNameHelp?: string;
  artsDefault?: string | undefined;
  slug?: string;
  memberId?: string;
}
export function readRegistration(
  form: FormData,
  selfRated: Rank,
  rulesVersion = '',
): RegistrationValues {
  const read = (key: string) => formValue(form, key).trim();
  if (form.get('loadoutPending') === 'true') throw new Error('請先確認選擇的報名武庫。');
  if (rulesVersion && form.get('rulesAccepted') !== 'on') throw new Error('請閱讀並確認本屆規則。');
  return create(MyRegistrationSchema, {
    displayName: read('displayName'),
    discordName: read('discord'),
    selfRatedRank: selfRated,
    ladderRank: read('ladderRank'),
    ladderScore: 0,
    artsNote: read('arts'),
    availabilityNote: readAvailability(form),
    acceptedRulesVersion: rulesVersion,
    character: create(CharacterConfigSchema, {
      style: read('characterStyle'),
      weapon: read('characterWeapon'),
      equipment: read('characterEquipment'),
      arts: read('characterArts'),
      snapshotJson: read('characterSnapshot'),
    }),
  });
}
export function RegistrationFields({
  characterOnly = false,
  personalOnly = false,
  ranks,
  selfRated,
  onSelfRated,
  defaults,
  artsDefault,
  rulesVersion = '',
  rulesHref,
  slug = '',
  memberId = '',
}: RegistrationFieldsProps) {
  const id = useId();
  const options = (values: string[], current: string) => [
    ...values,
    ...(current && !values.includes(current) ? [current] : []),
  ];
  return (
    <>
      <input type="hidden" name="displayName" value={defaults?.displayName ?? ''} />
      <input type="hidden" name="discord" value={defaults?.discordName ?? ''} />
      {!characterOnly && (
        <div className={styles.personalGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={id + 'rank'}>
              論劍段位
            </label>
            <select
              className={styles.input}
              id={id + 'rank'}
              name="ladderRank"
              defaultValue={defaults?.ladderRank ?? ''}
            >
              <option value="">請選擇</option>
              {options(LADDER_RANKS, defaults?.ladderRank ?? '').map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <MartialSelect defaultValue={defaults?.artsNote ?? artsDefault ?? ''} />
          <div className={styles.field}>
            <label className={styles.label} htmlFor={id + 'self'}>
              自評組別
            </label>
            <select
              className={styles.input}
              id={id + 'self'}
              name="selfRated"
              value={selfRated}
              onChange={(e) => onSelfRated(Number(e.target.value))}
            >
              <option value={Rank.UNSPECIFIED}>請選擇</option>
              {ranks.map((rank) => (
                <option key={rank.rank} value={rank.rank}>
                  {rank.name} · {rank.title}
                </option>
              ))}
            </select>
          </div>
          <AvailabilityFields defaultValue={defaults?.availabilityNote ?? ''} />
        </div>
      )}
      {!personalOnly && (
        <SelectedLoadout
          slug={slug}
          memberId={memberId}
          defaults={defaults?.character}
          returnTarget="member"
        />
      )}
      {rulesVersion && (
        <label className={styles.rules}>
          <input
            type="checkbox"
            name="rulesAccepted"
            required
            defaultChecked={defaults?.acceptedRulesVersion === rulesVersion}
          />
          <span>
            我已閱讀並同意
            <a href={rulesHref ?? '/#rules'} target="_blank" rel="noreferrer">
              本屆規則
            </a>
          </span>
        </label>
      )}
    </>
  );
}
