import { timestampMs } from '@bufbuild/protobuf/wkt';
import { PaperCard, SealStamp } from '@theatron/ui';

import type {
  HandicapSelection,
  MatchHandicaps,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { HANDICAP_CATEGORIES } from '../handicap/categories';

import styles from './HandicapNotice.module.css';

/**
 * 讓武公示。
 *
 * 這不是一張卡片列表,是**貼出來的公告**:封盤那一刻,雙方與觀眾看到的是同一份
 * 內容,Discord 公告也是從同一個 MatchHandicaps 產生的。所以它長在紙上 ——
 * 頁首有編號、標題置中、條目用折痕分欄、封盤之後右下角蓋印。
 *
 * 印只在封盤後出現。印是最後蓋的,蓋下去就不能改了,而封盤正是這件事。
 *
 * 封盤前,伺服器只回請求者自己的選擇;觀眾沒登入就是空的。這裡不拿空陣列
 * 推論「他什麼都沒買」,而是看 locked_at:封盤了才知道全貌。
 */

export interface HandicapNoticeProps {
  handicaps: MatchHandicaps | null;
  /** 讀取失敗的訊息;公告讀不到不該讓整個場次頁壞掉,所以只在這一區說。 */
  error: string | null;
  /** 施加方(低段位)的顯示名。 */
  holderName: string;
  /** 受限方(高段位)的顯示名。 */
  constrainedName: string;
  budget: bigint;
}

export function HandicapNotice({
  handicaps,
  error,
  holderName,
  constrainedName,
  budget,
}: HandicapNoticeProps) {
  const locked = handicaps?.lockedAt;

  return (
    <section className={styles.slot} aria-labelledby="handicap-notice">
      <PaperCard
        kicker={locked === undefined ? '封盤前' : `封盤 ${clock(timestampMs(locked))}`}
        index="HANDICAP NOTICE"
        headingLevel={2}
        title={<span id="handicap-notice">讓武公示</span>}
        stamp={locked === undefined ? undefined : <SealStamp text="封盤" />}
        tilt="none"
      >
        {error !== null && handicaps === null ? (
          <p className={styles.error}>{error}</p>
        ) : locked === undefined ? (
          // 中文句子不能跨 JSX 行:換行會被折成一個半形空格,句號後就多一個洞。
          <p className={styles.statement}>
            <strong>{holderName}</strong>
            {` 持 ${budget.toString()} BP 選購中。買了什麼在封盤前只有本人看得到;封盤後全部貼在這裡,`}
            <strong>{constrainedName}</strong>
            {' 照單受限。'}
          </p>
        ) : handicaps === null || handicaps.selections.length === 0 ? (
          <p className={styles.statement}>
            <strong>{holderName}</strong>
            {` 一項也沒買,${budget.toString()} BP 全數放棄。本場沒有任何限制。`}
          </p>
        ) : (
          <>
            <p className={styles.statement}>
              <strong>{holderName}</strong>
              {' 對 '}
              <strong>{constrainedName}</strong>
              {` 施加以下限制,共 ${(handicaps.budget?.spent ?? sumCost(handicaps.selections)).toString()} BP。受限方仍須全力求勝 —— 讓武不是放水。`}
            </p>
            {HANDICAP_CATEGORIES.map((c) => {
              const group = handicaps.selections.filter((s) => s.category === c.key);
              if (group.length === 0) return null;
              return (
                <div key={c.key} className={styles.group}>
                  <h3 className={styles.groupHead}>{c.label}</h3>
                  <ul className={styles.rows}>
                    {group.map((s) => (
                      <li key={s.publicId} className={styles.row}>
                        <span className={styles.itemName}>
                          {s.itemName}
                          {s.appliesToBoth ? <span className={styles.tag}>雙方適用</span> : null}
                        </span>
                        <span className={styles.cost}>{s.cost.toString()} BP</span>
                        {s.targetNote === '' ? null : (
                          <span className={styles.detail}>
                            <span className={styles.detailKey}>指定</span>
                            <span>{s.targetNote}</span>
                          </span>
                        )}
                        {s.drawResult === '' ? null : (
                          <span className={styles.detail}>
                            <span className={styles.detailKey}>系統抽選</span>
                            <span className={styles.draw}>{s.drawResult}</span>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </>
        )}
      </PaperCard>
    </section>
  );
}

/** budget 沒帶(理論上封盤後一定有)時的後備:公示上的總額不能是空的。 */
function sumCost(selections: HandicapSelection[]): bigint {
  return selections.reduce((acc, s) => acc + s.cost, 0n);
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
