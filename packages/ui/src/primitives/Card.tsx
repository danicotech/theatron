import type { HTMLAttributes, ReactNode } from 'react';

import styles from './Card.module.css';

export type CardTone = 'raised' | 'overlay';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'className' | 'title'> {
  tone?: CardTone;
  /** 這張卡的內容正在發生(比賽進行中、商店限時開放)。 */
  live?: boolean;
  children: ReactNode;
}

export function Card({ tone = 'raised', live = false, children, ...rest }: CardProps) {
  const classes = [styles.card];
  if (tone === 'overlay') classes.push(styles.overlay);
  if (live) classes.push(styles.live);

  return (
    <section {...rest} className={classes.join(' ')}>
      {children}
    </section>
  );
}

export interface CardHeaderProps {
  /** 單據標頭的全大寫小字:第 3 輪、票號、商品類別。 */
  label?: ReactNode;
  title?: ReactNode;
  /** 卡片在頁面大綱中的層級；預設在章節 h2 之下。 */
  headingLevel?: 2 | 3 | 4;
  /** 標頭右側:賠率、倒數、狀態。 */
  aside?: ReactNode;
  /** 在標頭左側顯示脈動的紅點。 */
  live?: boolean;
}

export function CardHeader({
  label,
  title,
  aside,
  live = false,
  headingLevel = 3,
}: CardHeaderProps) {
  const Heading = ({ 2: 'h2', 3: 'h3', 4: 'h4' } as const)[headingLevel];
  return (
    <header className={styles.header}>
      <div>
        {label === undefined ? null : (
          <div className={styles.label}>
            {live ? <span className={styles.liveDot} aria-hidden="true" /> : null}
            {label}
          </div>
        )}
        {title === undefined ? null : <Heading className={styles.title}>{title}</Heading>}
      </div>
      {aside === undefined ? null : <div>{aside}</div>}
    </header>
  );
}

export function CardBody({ children }: { children: ReactNode }) {
  return <div className={styles.body}>{children}</div>;
}

export function CardFooter({ children }: { children: ReactNode }) {
  return <footer className={styles.footer}>{children}</footer>;
}
