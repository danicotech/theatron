import type { Violation } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { ViolationRuling } from '../../lib/api/gen/hestia/activity/v1/common_pb';

import { clock } from './time';

import styles from './ViolationList.module.css';

/**
 * 我的違規紀錄。
 *
 * 沒有違規是常態,所以空的時候什麼都不畫 —— 一張「沒有違規」的卡只會讓人
 * 以為這一頁在等什麼。
 *
 * 判決只是紀錄,不是觸發器(schemas/27):判該回合落敗的實際結果,是裁判
 * 把那一回合的勝者填成對方。這裡的文案要把這件事說出來,不然選手會拿這張表
 * 跟比分對,對不上就來問。
 */
export function ViolationList({ violations }: { violations: Violation[] }) {
  if (violations.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="my-violations">
      <h2 className={styles.h2} id="my-violations">
        我的違規紀錄
      </h2>
      <ul className={styles.list}>
        {violations.map((v) => (
          <li key={v.publicId} className={styles.row}>
            <div className={styles.line}>
              <span className={styles.round}>
                {v.roundNo === 0 ? '開賽前' : `第 ${String(v.roundNo)} 回合`}
              </span>
              {v.itemName === '' ? null : <span className={styles.item}>{v.itemName}</span>}
              <span className={rulingClass(v.ruling)}>{rulingLabel(v.ruling)}</span>
              {v.createdAt === undefined ? null : (
                <span className={styles.time}>{clock(v.createdAt)}</span>
              )}
            </div>
            {v.note === '' ? null : <p className={styles.note}>{v.note}</p>}
          </li>
        ))}
      </ul>
      <p className={styles.foot}>判決只是紀錄。實際結果以裁判填的回合勝者為準。</p>
    </section>
  );
}

function rulingLabel(r: ViolationRuling): string {
  switch (r) {
    case ViolationRuling.WARNING:
      return '警告';
    case ViolationRuling.ROUND_LOSS:
      return '判該回合落敗';
    case ViolationRuling.MATCH_LOSS:
      return '判整場落敗';
    case ViolationRuling.NONE:
      return '不處置';
    default:
      return '';
  }
}

/** 會賠上回合或整場的判決用玫瑰色 —— 玫瑰是「輸」的顏色,不是金色。 */
function rulingClass(r: ViolationRuling): string | undefined {
  return r === ViolationRuling.ROUND_LOSS || r === ViolationRuling.MATCH_LOSS
    ? styles.rulingLoss
    : styles.ruling;
}
