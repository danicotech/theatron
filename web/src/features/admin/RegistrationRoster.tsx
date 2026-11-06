'use client';
import { HelpTip } from '../chrome/HelpTip';
import { BuildCard } from '../signup/BuildCard';
import { ConnectError } from '@connectrpc/connect';
import { useEffect, useState } from 'react';
import { activityApi } from '../../lib/api/activity';
import type { PlayerDossier } from '../../lib/api/gen/hestia/activity/v1/judge_pb';
import { useTournamentRealtime } from '../realtime/useTournamentRealtime';
import styles from './RegistrationRoster.module.css';

export function RegistrationRoster({ slug }: { slug: string }) {
  const sync = useTournamentRealtime(slug);
  const [players, setPlayers] = useState<PlayerDossier[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void activityApi.judge
      .listUnranked({ tournamentSlug: slug, includeRanked: true }, { signal: controller.signal })
      .then((res) => {
        if (!controller.signal.aborted) {
          setPlayers(res.players);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(ConnectError.from(err).message);
      });
    return () => controller.abort();
  }, [slug, sync.revision]);
  return (
    <section className={styles.roster} aria-label="報名名冊">
      <h2>
        報名名冊
        <HelpTip label="報名名冊" text="報名資料僅供裁判查看。新報名與資料修改會自動更新。" />
      </h2>
      {error ? <p role="alert">{error}</p> : null}
      {players === null && !error ? <p>讀取報名資料…</p> : null}
      {players?.length === 0 ? <p>尚無選手報名。</p> : null}
      {players?.map((entry) => (
        <details className={styles.entry} key={entry.player?.publicId}>
          <summary>
            {entry.player?.displayName} · {entry.player?.gameId}
          </summary>
          <dl>
            {(
              [
                ['Discord 名稱', entry.discordName],
                ['論劍段位', entry.ladderRank],
                ['論劍積分', String(entry.ladderScore)],
                ['流派', entry.character?.style],
                ['武器', entry.character?.weapon],
                ['裝備', entry.character?.equipment],
                ['武學', entry.character?.arts],
                ['常用武學 / PVP 經驗', entry.artsNote],
                ['可出賽時段 / 備註', entry.availabilityNote],
                [
                  '規則確認',
                  entry.acceptedRulesVersion
                    ? `已確認版本 ${entry.acceptedRulesVersion}${entry.acceptedRulesVersion === sync.tournament?.rulesVersion ? '' : '（需確認新版）'}`
                    : '尚未確認',
                ],
                [
                  '確認時間',
                  entry.rulesAcceptedAt
                    ? new Date(Number(entry.rulesAcceptedAt.seconds) * 1000).toLocaleString('zh-TW')
                    : '',
                ],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{label === '流派' ? <BuildCard name={value} /> : value || '未填'}</dd>
              </div>
            ))}
          </dl>
        </details>
      ))}
    </section>
  );
}
