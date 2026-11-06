'use client';
import { useState } from 'react';
import type { MemberProfile } from '../../lib/api/gen/hestia/platform/v1/auth_pb';
import styles from './MemberOverview.module.css';

export function MemberOverview({
  member,
  displayName,
  enrolled = false,
  gameId,
  rankName,
}: {
  member?: MemberProfile | undefined;
  displayName?: string;
  enrolled?: boolean;
  gameId?: string;
  rankName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const name = member?.displayName || displayName || '江湖來客';
  const avatar = member?.avatarUrl;
  const validAvatar =
    avatar &&
    /^https:\/\/cdn\.discordapp\.com\/avatars\/[0-9]+\/[a-zA-Z0-9_]+\.(png|webp|gif)(\?.*)?$/.test(
      avatar,
    );
  return (
    <div className={styles.profile}>
      <div className={styles.masthead} aria-hidden="true">
        <span>夜鴉閣</span>
        <span>江湖名帖</span>
      </div>
      <header className={styles.identity}>
        <svg className={styles.landscape} viewBox="0 0 600 260" fill="none" aria-hidden="true">
          <path d="M0 250 100 166 160 202 264 80 325 150 399 37 470 132 510 108 600 194M80 260 204 186 260 208 374 118 442 181 530 145 600 218M264 80 280 170 325 150M399 37 405 120 442 181" />
        </svg>
        <div className={styles.avatar} role="img" aria-label={`${name}的頭像`}>
          {validAvatar && !failed ? (
            <img
              src={avatar}
              alt=""
              width={112}
              height={112}
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
            />
          ) : (
            <span aria-hidden="true">{Array.from(name)[0]}</span>
          )}
        </div>
        <div className={styles.name}>
          <span className={styles.caption}>個人名帖</span>
          <h3>{name}</h3>
          {member?.discordUsername ? <p>@{member.discordUsername.replace(/^@/, '')}</p> : null}
          <span className={styles.badge}>{member?.canManage ? '管理員帳號' : '一般會員'}</span>
        </div>
        <span className={styles.seal} aria-hidden="true">
          夜鴉
        </span>
      </header>
      <dl className={styles.facts}>
        <div>
          <dt>本屆報名</dt>
          <dd>{enrolled ? '已報名' : '尚未報名'}</dd>
        </div>
        <div>
          <dt>Discord</dt>
          <dd>{member?.discordId ? '已連結' : '尚未連結'}</dd>
        </div>
        {gameId ? (
          <div>
            <dt>遊戲 ID</dt>
            <dd>{gameId}</dd>
          </div>
        ) : null}
        {enrolled ? (
          <div>
            <dt>參賽段位</dt>
            <dd>{rankName || '未評定'}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
