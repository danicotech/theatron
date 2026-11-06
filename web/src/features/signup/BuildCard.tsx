'use client';

import { useState } from 'react';
import builds from './buildCards.json';
import styles from './BuildCard.module.css';

function Icon({ path, className }: { path: string; className: string | undefined }) {
  const [failed, setFailed] = useState(false);
  return failed ? null : (
    <img
      className={className}
      src={'/loadout/assets/' + path}
      alt=""
      width={42}
      height={42}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/** Catalog identity only; does not replace a player's confirmed martial selections. */
export function BuildCard({ name }: { name?: string | undefined }) {
  const build = builds.find((entry) => entry.name === name);
  return (
    <span className={styles.card} data-build-card data-family={build?.family}>
      <span className={styles.content}>
        <span className={styles.heading}>
          {build?.img ? <Icon key={build.img} path={build.img} className={styles.sigil} /> : null}
          <strong>{name || '尚未選擇流派'}</strong>
        </span>
        <span className={styles.martials}>
          {build?.martials.length ? (
            build.martials.map((martial) => (
              <span className={styles.martial} key={martial.key}>
                {martial.img ? (
                  <Icon key={martial.img} path={martial.img} className={styles.icon} />
                ) : null}
                <span>{martial.name}</span>
              </span>
            ))
          ) : (
            <span className={styles.empty}>
              {!name || name === '待配置' ? '選擇流派後顯示對應武學' : '此流派尚無武學資料'}
            </span>
          )}
        </span>
      </span>
      {build?.familyImg ? (
        <Icon key={build.familyImg} path={build.familyImg} className={styles.family} />
      ) : null}
    </span>
  );
}
