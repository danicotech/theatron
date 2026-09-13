import { Amount } from '@theatron/ui';

import type { BpBudget } from '../../lib/api/gen/hestia/activity/v1/common_pb';

import styles from './BpMeter.module.css';

/**
 * BP 餘額計。
 *
 * 借的是轉播 lower-third 的構圖:一個大數字帶一條進度條,其餘都小。
 * 「剩餘」是唯一的大字 —— 選購時每一下都在問「我還剩多少」,預算與已用
 * 只是對帳用,看得到就好。
 *
 * 金色只用在剩餘的數字與條:BP 不是平台代幣,但在這一頁它就是選手要花的東西,
 * 「花掉會少」這件事要一眼看懂。整頁的高音只有這一處。
 */
export interface BpMeterProps {
  budget: BpBudget;
  /** 每差一段幾 BP;> 0 才算得出段位差。 */
  perGap: bigint;
}

export function BpMeter({ budget, perGap }: BpMeterProps) {
  const total = budget.budget;
  const remaining = budget.remaining;
  // 條長用整數百分比:BP 是小整數,精度夠;不經 Number 就不會踩 int64 的坑。
  const pct = total <= 0n ? 0n : (remaining * 100n) / total;
  const gap = perGap > 0n && total % perGap === 0n ? total / perGap : undefined;

  return (
    <section className={styles.meter} aria-label="BP 餘額計">
      <div className={styles.row}>
        <div className={styles.main}>
          <span className={styles.key}>剩餘</span>
          <Amount value={remaining} currency="BP" size="lg" label="剩餘" />
        </div>
        <dl className={styles.side}>
          <div className={styles.sideItem}>
            <dt>預算</dt>
            <dd>
              <Amount value={total} tone="neutral" size="sm" />
            </dd>
          </div>
          <div className={styles.sideItem}>
            <dt>已用</dt>
            <dd>
              <Amount value={budget.spent} tone="neutral" size="sm" />
            </dd>
          </div>
        </dl>
      </div>
      <div
        className={styles.bar}
        role="meter"
        aria-label="剩餘 BP 佔預算的比例"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number(pct)}
      >
        <span className={styles.fill} style={{ inlineSize: `${pct.toString()}%` }} />
      </div>
      <p className={styles.foot}>
        {gap === undefined ? '' : `差 ${gap.toString()} 段 × ${perGap.toString()} BP。`}
        沒花完的賽後作廢,不會留到下一輪。
      </p>
    </section>
  );
}
