import type { ButtonHTMLAttributes, ReactNode } from 'react';

import styles from './Button.module.css';

/** 主要操作、金額與危險操作各自使用語意色；取消與次要操作維持中性。 */
export type ButtonVariant = 'default' | 'primary' | 'money' | 'danger';
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
      data-ink-variant={variant}
      className={classes.join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
