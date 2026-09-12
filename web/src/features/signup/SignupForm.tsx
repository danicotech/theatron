'use client';

import { ConnectError } from '@connectrpc/connect';
import { Button, RankSigil } from '@theatron/ui';
import { useEffect, useId, useState, type FormEvent } from 'react';

import { activityApi } from '../../lib/api/activity';
import type { RankInfo } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { Rank } from '../../lib/api/gen/hestia/activity/v1/common_pb';

import styles from './SignupForm.module.css';

/**
 * 報名。
 *
 * **只有遊戲ID 必填。** 其餘欄位是給裁判評段用的材料,填得越細,段位評得越準 ——
 * 所以它們的說明寫的是「這會幫到你」,不是「這一欄還沒填」。把六個欄位都標成
 * 必填,擋掉的不是敷衍的人,是懶得開電腦的人。
 */

export interface SignupFormProps {
  slug: string;
  onDone: (name: string) => void;
}

export function SignupForm({ slug, onDone }: SignupFormProps) {
  const ids = {
    gameId: useId(),
    displayName: useId(),
    discord: useId(),
    ladderRank: useId(),
    ladderScore: useId(),
    arts: useId(),
    availability: useId(),
  };

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
    const read = (k: string): string => {
      const v = form.get(k);
      return typeof v === 'string' ? v.trim() : '';
    };

    setPending(true);
    setError(null);
    try {
      const res = await activityApi.signup.register({
        tournamentSlug: slug,
        gameId: read('gameId'),
        displayName: read('displayName'),
        discordName: read('discord'),
        selfRatedRank: selfRated,
        ladderRank: read('ladderRank'),
        ladderScore: Number(read('ladderScore')) || 0,
        artsNote: read('arts'),
        availabilityNote: read('availability'),
      });
      onDone(res.player?.displayName ?? (read('displayName') || read('gameId')));
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
        <div className={styles.field}>
          <label className={styles.label} htmlFor={ids.gameId}>
            遊戲ID
          </label>
          <input
            className={[styles.input, styles.mono].join(' ')}
            id={ids.gameId}
            name="gameId"
            required
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          <p className={styles.help}>場上辨識用,也是你之後進站的方式。全服唯一。</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={ids.displayName}>
            顯示名稱
          </label>
          <input
            className={styles.input}
            id={ids.displayName}
            name="displayName"
            autoComplete="off"
          />
          <p className={styles.help}>對戰表上要怎麼稱呼你。留空就用遊戲ID。</p>
        </div>
      </div>

      <fieldset className={styles.optional} disabled={pending}>
        <legend className={styles.legend}>下面都可以留空</legend>
        <p className={styles.legendNote}>
          這些是御風羽評段時看的材料。填得越具體,段位評得越貼近你的實力 —— 評得準,讓武 BP
          才會落在對的一邊。
        </p>

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
                    setSelfRated(selfRated === r.rank ? Rank.UNSPECIFIED : r.rank);
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
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={ids.discord}>
            Discord 名稱
          </label>
          <input className={styles.input} id={ids.discord} name="discord" autoComplete="off" />
          <p className={styles.help}>裁判要找你的時候用。公告也會 tag 這個名字。</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={ids.arts}>
            常用武學 / PVP 經驗
          </label>
          <textarea className={styles.textarea} id={ids.arts} name="arts" rows={3} />
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
          />
          <p className={styles.help}>排輪次時程會參考。</p>
        </div>
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
