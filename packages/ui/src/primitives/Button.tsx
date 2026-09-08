import type { ButtonHTMLAttributes, ReactNode } from 'react';

import styles from './Button.module.css';

/**
 * 三個 variant 對應三種語意,不是三種「重要程度」。
 *
 * 語意色的職責是唯一的(tokens.md):金色是錢,玫瑰是「正在發生 / 危險」。
 * 所以這裡沒有 primary —— 一顆「報名參賽」的主要按鈕不該是金色的,
 * 金色一出現使用者就會以為要付錢。
 */
export type ButtonVariant = 'default' | 'money' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 進行中。會 disable 按鈕並標上 aria-busy,避免連點。 */
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'default',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled = false,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const classes = [styles.button, styles[variant], styles[size]];
  if (fullWidth) classes.push(styles.fullWidth);

  return (
    <button
      {...rest}
      type={type}
      className={classes.join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
