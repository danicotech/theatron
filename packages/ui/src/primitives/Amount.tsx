import { formatAmount, toMachineAmount, type MoneyValue } from '../format/money';

import styles from './Amount.module.css';

/**
 * 金額 / 數值顯示。
 *
 * value 只收 bigint 或整數字串,不收 number:後端是 int64,protobuf 的 JSON
 * 把它編成字串,拿去 Number 一過超過 2^53 就靜默失真。詳見 format/money.ts。
 */
export type AmountTone = 'money' | 'neutral' | 'win' | 'live' | 'muted';
export type AmountSize = 'sm' | 'md' | 'lg';

export interface AmountProps {
  value: MoneyValue;
  /** 幣別代碼(currencies.code)。給了才顯示標籤。 */
  currency?: string;
  /** 小數位。後端代幣是整數,預設 0。 */
  scale?: number;
  /** 預設 money —— 這個元件多數時候顯示的就是錢。 */
  tone?: AmountTone;
  size?: AmountSize;
  /** 正數要不要加 +。發點 / 扣點的帳本列表會要。 */
  signDisplay?: 'auto' | 'always' | 'never';
  /** 給螢幕閱讀器的說明,例如「餘額」。 */
  label?: string;
}

export function Amount({
  value,
  currency,
  scale = 0,
  tone = 'money',
  size = 'md',
  signDisplay = 'auto',
  label,
}: AmountProps) {
  const display = formatAmount(value, { scale, signDisplay });
  const machine = toMachineAmount(value, scale);

  return (
    <data
      className={[styles.amount, styles[tone], styles[size]].join(' ')}
      value={machine}
      aria-label={label === undefined ? undefined : `${label} ${machine}${currency ?? ''}`}
    >
      <span className={styles.value}>{display}</span>
      {currency === undefined ? null : <span className={styles.currency}>{currency}</span>}
    </data>
  );
}
