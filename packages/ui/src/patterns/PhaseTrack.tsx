import styles from './PhaseTrack.module.css';

/**
 * 階段軌道:賽事現在走到哪一步。
 *
 * 這是設計規範四個簽名元素之一(tokens.md)。它用編號是有理由的 ——
 * 賽事階段**真的是序列**,而且順序本身帶資訊(段位公布刻意排在抽籤之前,
 * 好讓選手有異議可提)。功能列表用 01/02/03 是裝飾,這裡不是。
 *
 * 階段清單由呼叫端傳進來:這個套件不知道賽事規則,也不該知道
 * 《百業試鋒》有七個階段(packages/ui 的邊界,見 SKILL.md)。
 */
export interface PhaseTrackStep {
  /** 穩定識別子,用來比對 current。 */
  key: string;
  /** 顯示名稱,如「報名」。 */
  label: string;
  /** 補充說明,滑鼠移上去才看得到;不給就不顯示。 */
  hint?: string | undefined;
}

export interface PhaseTrackProps {
  steps: PhaseTrackStep[];
  /** 目前所在階段的 key。找不到時整條軌道都算未到達。 */
  current: string;
  /** 無障礙標籤,預設「賽事階段」。 */
  label?: string;
}

export function PhaseTrack({ steps, current, label = '賽事階段' }: PhaseTrackProps) {
  const currentIndex = steps.findIndex((s) => s.key === current);

  return (
    <nav className={styles.track} aria-label={label}>
      <ol className={styles.list}>
        {steps.map((step, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
          return (
            <li
              key={step.key}
              className={[styles.step, styles[state]].join(' ')}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className={styles.rail} aria-hidden="true" />
              <span className={styles.marker} aria-hidden="true">
                <span className={styles.dot} />
              </span>
              <span className={styles.index} aria-hidden="true">
                {i + 1}
              </span>
              <span className={styles.label} title={step.hint}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
