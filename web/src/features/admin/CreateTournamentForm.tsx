'use client';

import { Button } from '@theatron/ui';
import { ConnectError } from '@connectrpc/connect';
import { useId, useState, type FormEvent } from 'react';

import { activityApi } from '../../lib/api/activity';

import styles from './CreateTournamentForm.module.css';

/**
 * 開一屆賽事。裁判後台的第一個動作 —— 沒有它,報名、評段、抽籤、
 * 選讓武、下注全部沒有立足點。
 *
 * # 為什麼規則旋鈕留空而不是預填預設值
 *
 * 預設值的權威在伺服器(tournament.DefaultConfig)。把 8、12000 這些數字
 * 抄一份到表單裡,就是同一個概念的第二個權威位置 —— 哪天後端調了,
 * 這裡會繼續顯示舊的,而且沒有人會發現。所以留空、標明「留空用預設」,
 * 建立完成後由賽事總覽顯示實際生效的值。
 */

/** 送出後拿到的結果,由呼叫端決定要怎麼帶使用者過去。 */
export interface CreatedTournament {
  slug: string;
  name: string;
  handicapItemCount: number;
}

export interface CreateTournamentFormProps {
  onCreated: (t: CreatedTournament) => void;
}

/** 只收正整數;空字串代表沒填,送 0 讓伺服器用預設。 */
function toAmount(raw: string): bigint {
  const trimmed = raw.trim();
  if (trimmed === '') return 0n;
  return BigInt(trimmed);
}

export function CreateTournamentForm({ onCreated }: CreateTournamentFormProps) {
  const ids = {
    community: useId(),
    slug: useId(),
    name: useId(),
    bonus: useId(),
    gap: useId(),
    champion: useId(),
    runnerUp: useId(),
    third: useId(),
    participation: useId(),
  };

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; reason: string } | null>(null);
  const [third, setThird] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const form = new FormData(e.currentTarget);
    // FormData 的值可能是 File(表單裡有 <input type="file"> 時)。
    // 直接 String() 會得到 "[object File]" 而且沒有任何徵兆,所以明確只收字串。
    const read = (k: string): string => {
      const v = form.get(k);
      return typeof v === 'string' ? v : '';
    };

    setPending(true);
    setError(null);
    try {
      const res = await activityApi.judge.createTournament({
        communityPublicId: read('community').trim(),
        slug: read('slug').trim(),
        name: read('name').trim(),
        signupBonus: toAmount(read('bonus')),
        bpPerRankGap: toAmount(read('gap')),
        prizes: {
          champion: toAmount(read('champion')),
          runnerUp: toAmount(read('runnerUp')),
          third: toAmount(read('third')),
          participation: toAmount(read('participation')),
        },
      });
      const t = res.tournament;
      onCreated({
        slug: t?.slug ?? read('slug').trim(),
        name: t?.name ?? read('name').trim(),
        handicapItemCount: res.handicapItemCount,
      });
    } catch (err) {
      const ce = ConnectError.from(err);
      setError({
        message: ce.message,
        reason: ce.metadata.get('hestia-error-reason') ?? '',
      });
    } finally {
      setPending(false);
    }
  }

  const thirdSet = toAmount(third) > 0n;

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        void submit(e);
      }}
      noValidate
    >
      <fieldset className={styles.group} disabled={pending}>
        <legend className={styles.legend}>這一屆是什麼</legend>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={ids.name}>
            賽事名稱
          </label>
          <input
            className={styles.input}
            id={ids.name}
            name="name"
            required
            autoComplete="off"
            placeholder="百業試鋒 2026 春季賽"
          />
          <p className={styles.help}>公告與頁面上顯示的名字。</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={ids.slug}>
            網址代號
          </label>
          <input
            className={[styles.input, styles.mono].join(' ')}
            id={ids.slug}
            name="slug"
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="2026-baiye-shifeng"
            aria-invalid={error?.reason === 'tournament_slug_taken' || undefined}
          />
          <p className={styles.help}>
            小寫英數與連字號。<strong>建立後不能改</strong> —— 它會出現在已經發出去的公告網址裡。
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={ids.community}>
            社群
          </label>
          <input
            className={[styles.input, styles.mono].join(' ')}
            id={ids.community}
            name="community"
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="01J0..."
            aria-invalid={error?.reason === 'community_not_found' || undefined}
          />
          <p className={styles.help}>這屆掛在哪個社群底下,填該社群的 public_id。</p>
        </div>
      </fieldset>

      <fieldset className={styles.group} disabled={pending}>
        <legend className={styles.legend}>規則旋鈕</legend>
        <p className={styles.groupNote}>
          全部可留空 —— 留空就用伺服器的預設值,建立完成後在總覽看得到實際生效的數字。
        </p>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={ids.gap}>
              每差一段的 BP
            </label>
            <input
              className={[styles.input, styles.mono, styles.num].join(' ')}
              id={ids.gap}
              name="gap"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
            />
            <p className={styles.help}>差二段、三段依比例加倍;同段永遠是 0。</p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={ids.bonus}>
              報名獎勵
            </label>
            <input
              className={[styles.input, styles.mono, styles.num].join(' ')}
              id={ids.bonus}
              name="bonus"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
            />
            <p className={styles.help}>報名就發的平台代幣,留空或 0 = 不發。</p>
          </div>
        </div>
      </fieldset>

      <fieldset className={styles.group} disabled={pending}>
        <legend className={styles.legend}>獎金</legend>

        <div className={styles.prizes}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={ids.champion}>
              冠軍
            </label>
            <input
              className={[styles.input, styles.mono, styles.num].join(' ')}
              id={ids.champion}
              name="champion"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={ids.runnerUp}>
              亞軍
            </label>
            <input
              className={[styles.input, styles.mono, styles.num].join(' ')}
              id={ids.runnerUp}
              name="runnerUp"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={ids.third}>
              季軍
            </label>
            <input
              className={[styles.input, styles.mono, styles.num].join(' ')}
              id={ids.third}
              name="third"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={third}
              onChange={(e) => setThird(e.target.value)}
              aria-describedby={thirdSet ? ids.third + '-warn' : undefined}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={ids.participation}>
              參賽獎
            </label>
            <input
              className={[styles.input, styles.mono, styles.num].join(' ')}
              id={ids.participation}
              name="participation"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
            />
          </div>
        </div>

        {thirdSet ? (
          <p className={styles.warn} id={ids.third + '-warn'} role="status">
            單淘汰沒有季軍賽,四強的兩個敗者之間沒有比過 —— 所以設了季軍獎金,賽後按「發獎」會
            <strong>整批拒發</strong>,不是只跳過季軍。 要發季軍獎得先加一場季軍賽。
          </p>
        ) : null}
      </fieldset>

      {error === null ? null : (
        <p className={styles.error} role="alert">
          {error.message}
        </p>
      )}

      <div className={styles.actions}>
        <Button type="submit" size="lg" loading={pending}>
          {pending ? '建立中' : '開賽事'}
        </Button>
        <p className={styles.actionsNote}>
          建立的同時會把這一屆的 34 項讓武一起放進去,兩者要嘛都成功、要嘛都不留。
        </p>
      </div>
    </form>
  );
}
