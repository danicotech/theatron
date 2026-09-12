'use client';

import { ConnectError } from '@connectrpc/connect';
import { Button } from '@theatron/ui';
import { useEffect, useId, useState, type FormEvent } from 'react';

import { activityApi } from '../../lib/api/activity';
import type { RankInfo } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { Rank } from '../../lib/api/gen/hestia/activity/v1/common_pb';

import { readRegistration, RegistrationFields } from './RegistrationFields';

import styles from './SignupForm.module.css';

/**
 * 報名。
 *
 * **只有遊戲ID 必填。** 其餘欄位是給裁判評段用的材料,填得越細,段位評得越準 ——
 * 所以它們的說明寫的是「這會幫到你」,不是「這一欄還沒填」。把六個欄位都標成
 * 必填,擋掉的不是敷衍的人,是懶得開電腦的人。
 *
 * 欄位本身來自 RegistrationFields:報名與事後修改是同一組欄位,只能有一份定義。
 */

export interface SignupFormProps {
  slug: string;
  onDone: (name: string) => void;
}

export function SignupForm({ slug, onDone }: SignupFormProps) {
  const gameIdField = useId();

  const [ranks, setRanks] = useState<RankInfo[]>([]);
  const [selfRated, setSelfRated] = useState<Rank>(Rank.UNSPECIFIED);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void activityApi.tournament
      .listRanks({ tournamentSlug: slug })
      .then((r) => {
        setRanks(r.ranks);
      })
      .catch(() => {
        // 段位清單讀不到不該擋住報名 —— 自評本來就是選填的。
        setRanks([]);
      });
  }, [slug]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const form = new FormData(e.currentTarget);
    const rawGameId = form.get('gameId');
    const gameId = typeof rawGameId === 'string' ? rawGameId.trim() : '';
    const reg = readRegistration(form, selfRated);

    setPending(true);
    setError(null);
    try {
      const res = await activityApi.signup.register({ tournamentSlug: slug, gameId, ...reg });
      onDone(res.player?.displayName ?? (reg.displayName || gameId));
    } catch (err) {
      setError(ConnectError.from(err).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        void submit(e);
      }}
      noValidate
    >
      <div className={styles.required}>
        <div className={styles.gameIdField}>
          <label className={styles.gameIdLabel} htmlFor={gameIdField}>
            遊戲ID
          </label>
          <input
            className={styles.gameIdInput}
            id={gameIdField}
            name="gameId"
            required
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          <p className={styles.gameIdHelp}>場上辨識用,也是你之後進站的方式。全服唯一。</p>
        </div>
      </div>

      <fieldset className={styles.optional} disabled={pending}>
        <legend className={styles.legend}>下面都可以留空</legend>
        <p className={styles.legendNote}>
          這些是御風羽評段時看的材料。填得越具體,段位評得越貼近你的實力 —— 評得準,讓武 BP
          才會落在對的一邊。
        </p>

        <RegistrationFields
          ranks={ranks}
          selfRated={selfRated}
          onSelfRated={setSelfRated}
          displayNameHelp="對戰表上要怎麼稱呼你。留空就用遊戲ID。"
        />
      </fieldset>

      {error === null ? null : (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <Button type="submit" size="lg" loading={pending} fullWidth>
          報名參賽
        </Button>
      </div>
    </form>
  );
}
