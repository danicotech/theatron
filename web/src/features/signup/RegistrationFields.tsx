'use client';

import { RankSigil } from '@theatron/ui';
import { useId } from 'react';

import type { RankInfo } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { Rank } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import type { MyRegistration } from '../../lib/api/gen/hestia/activity/v1/signup_pb';

import styles from './RegistrationFields.module.css';

/**
 * 報名資料的欄位組。
 *
 * 報名與事後修改是**同一組欄位**(契約上就是同一個 MyRegistration),所以
 * 標籤、說明文字、驗證提示只能有一份。兩份表單各寫一次的話,哪天改了其中
 * 一邊的說明,另一邊會繼續講舊的 —— 而看到舊說明的人不會知道自己看的是舊的。
 *
 * 欄位是 uncontrolled(defaultValue + FormData),只有自評段位是受控的:
 * 它不是 <input>,沒有 FormData 讀得到的值。
 */

/** 表單讀回來的值。與 proto 的 MyRegistration 同形,由呼叫端負責送出。 */
export interface RegistrationValues {
  displayName: string;
  discordName: string;
  selfRatedRank: Rank;
  ladderRank: string;
  ladderScore: number;
  artsNote: string;
  availabilityNote: string;
}

export interface RegistrationFieldsProps {
  ranks: RankInfo[];
  /** 目前的自評段位。UNSPECIFIED = 沒填。 */
  selfRated: Rank;
  onSelfRated: (r: Rank) => void;
  /** 既有的值(修改時帶入);報名時不給。 */
  defaults?: MyRegistration | undefined;
  /** 顯示名稱的說明會依情境不同(報名時要講「留空就用遊戲ID」)。 */
  displayNameHelp?: string;
  /**
   * 「常用武學 / PVP 經驗」的預填值。
   *
   * 備戰方案頁（/loadout）按「完成報名」會帶著 ?arts= 導過來,那段文字要落在這一格。
   * 獨立一個 prop 而不是塞進 defaults:defaults 的型別是 MyRegistration(整份報名),
   * 為了預填一格而湊一個假的整份出來,型別會騙人。
   */
  artsDefault?: string | undefined;
}

/** 從表單讀回一組值。與欄位定義放同一個檔案,改名字時不會漏掉讀取端。 */
export function readRegistration(form: FormData, selfRated: Rank): RegistrationValues {
  const read = (k: string): string => {
    const v = form.get(k);
    return typeof v === 'string' ? v.trim() : '';
  };
  return {
    displayName: read('displayName'),
    discordName: read('discord'),
    selfRatedRank: selfRated,
    ladderRank: read('ladderRank'),
    ladderScore: Number(read('ladderScore')) || 0,
    artsNote: read('arts'),
    availabilityNote: read('availability'),
  };
}

export function RegistrationFields({
  ranks,
  selfRated,
  onSelfRated,
  defaults,
  displayNameHelp,
  artsDefault,
}: RegistrationFieldsProps) {
  const ids = {
    displayName: useId(),
    discord: useId(),
    ladderRank: useId(),
    ladderScore: useId(),
    arts: useId(),
    availability: useId(),
  };

  return (
    <>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={ids.displayName}>
          顯示名稱
        </label>
        <input
          className={styles.input}
          id={ids.displayName}
          name="displayName"
          autoComplete="off"
          defaultValue={defaults?.displayName ?? ''}
        />
        {displayNameHelp === undefined ? null : <p className={styles.help}>{displayNameHelp}</p>}
      </div>

      {ranks.length === 0 ? null : (
        <div className={styles.field}>
          <span className={styles.label}>你覺得自己是哪一段</span>
          <div className={styles.ranks}>
            {ranks.map((r, i) => (
              <button
                key={r.rank}
                type="button"
                className={[styles.rank, selfRated === r.rank ? styles.picked : ''].join(' ')}
                aria-pressed={selfRated === r.rank}
                onClick={() => {
                  onSelfRated(selfRated === r.rank ? Rank.UNSPECIFIED : r.rank);
                }}
              >
                <RankSigil level={i + 1} total={ranks.length} name={r.name} title={r.title} />
              </button>
            ))}
          </div>
          <p className={styles.help}>
            評得高或低都不影響資格。自評與裁判評定的差距本身就是裁判要看的東西。
          </p>
        </div>
      )}

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={ids.ladderRank}>
            論劍段位
          </label>
          <input
            className={styles.input}
            id={ids.ladderRank}
            name="ladderRank"
            autoComplete="off"
            defaultValue={defaults?.ladderRank ?? ''}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={ids.ladderScore}>
            論劍積分
          </label>
          <input
            className={[styles.input, styles.mono, styles.num].join(' ')}
            id={ids.ladderScore}
            name="ladderScore"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            defaultValue={
              defaults === undefined || defaults.ladderScore === 0 ? '' : defaults.ladderScore
            }
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={ids.discord}>
          Discord 名稱
        </label>
        <input
          className={styles.input}
          id={ids.discord}
          name="discord"
          autoComplete="off"
          defaultValue={defaults?.discordName ?? ''}
        />
        <p className={styles.help}>裁判要找你的時候用。公告也會 tag 這個名字。</p>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={ids.arts}>
          常用武學 / PVP 經驗
        </label>
        <textarea
          className={styles.textarea}
          id={ids.arts}
          name="arts"
          rows={3}
          defaultValue={defaults?.artsNote ?? artsDefault ?? ''}
        />
        <p className={styles.help}>沒跟你對過的人,靠這段認識你打什麼。</p>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={ids.availability}>
          可出賽時段 / 備註
        </label>
        <textarea
          className={styles.textarea}
          id={ids.availability}
          name="availability"
          rows={2}
          defaultValue={defaults?.availabilityNote ?? ''}
        />
        <p className={styles.help}>排輪次時程會參考。</p>
      </div>
    </>
  );
}
