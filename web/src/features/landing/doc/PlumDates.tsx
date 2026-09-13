import { SCHEDULE } from '../content';
import { dateState, formatDay, STATE_LABEL, bloomOf } from '../dates';
import { Blossom, PlumBranch } from '../Plum';
import styles from './PlumDates.module.css';

export interface PlumDatesProps {
  /**
   * 「現在」。預設是伺服器渲染的那一刻。
   *
   * 傳得進來是為了測得起來 —— 「到期才開花」這條規則如果只能靠等真的日子到
   * 才驗得到,它等於沒有驗過。
   */
  now?: Date;
}

/**
 * 第五章〈花信〉:一條梅枝橫過畫面,每個日期是一朵花,到期才開。
 *
 * 開花是**狀態的視覺**,不是動畫:哪一朵開著,說的是「這一關已經到了」。
 * 所以每一朵旁邊都有字 —— 到期/未到期/待公布 都寫出來。只靠花開不開傳達
 * 一件事實,對看不到顏色形狀的人就是沒有傳達。
 *
 * 梅枝本身純裝飾,在清單後面。資訊全部在 `<ol>` 裡。
 */
export function PlumDates({ now }: PlumDatesProps) {
  const at = now ?? new Date();

  return (
    <div className={styles.season}>
      <PlumBranch from="right" className={styles.branch} />

      <ol className={styles.dates} data-testid="plum-dates">
        {SCHEDULE.map((entry) => {
          const state = dateState(entry.iso, at);
          return (
            <li className={styles.node} key={entry.field} data-date-state={state}>
              <span className={styles.flower}>
                <Blossom open={bloomOf(state)} />
              </span>
              <span className={styles.text}>
                <b className={styles.name}>{entry.name}</b>
                <time className={styles.day} dateTime={state === 'unknown' ? undefined : entry.iso}>
                  {formatDay(entry.iso)}
                </time>
                <span className={styles.status}>{STATE_LABEL[state]}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
