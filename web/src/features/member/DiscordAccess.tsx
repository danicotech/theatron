import styles from './DiscordAccess.module.css';
import { discordLoginHref } from './returnPath';
export function DiscordAccess({ next = '', error = '' }: { next?: string; error?: string }) {
  return (
    <section className={styles.gate} aria-label="Discord 登入">
      <p className={styles.divider}>或快速註冊／登入</p>
      {error && (
        <p role="alert">
          {error === 'oauth_denied'
            ? '已取消 Discord 授權，可以重新登入。'
            : 'Discord 登入未完成，請重試。'}
        </p>
      )}
      <div className={styles.gateActions}>
        <a className={styles.gatePrimary} href={discordLoginHref(next)}>
          Discord 快速註冊／登入
        </a>
      </div>
    </section>
  );
}
