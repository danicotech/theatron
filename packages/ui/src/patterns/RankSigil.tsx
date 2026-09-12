import styles from './RankSigil.module.css';

/**
 * 段位徽記。
 *
 * 段位是**有序**的,所以徽記必須看得出高低,不能只是四種顏色 ——
 * 換了主題、或色盲的人看,顏色就沒有順序可言。做法是刻度:
 * 總共幾格、亮了幾格,一眼就是第幾階。
 *
 * 名稱與階數都由呼叫端給:這個套件不知道《百業試鋒》有四段、
 * 也不知道它們叫什麼(packages/ui 的邊界,見 SKILL.md)。
 */
export interface RankSigilProps {
  /** 第幾階,1 起算。0 或負數視為未評定。 */
  level: number;
  /** 總共幾階。 */
  total: number;
  /** 段位名稱,如「飛花」。未評定時傳空字串。 */
  name: string;
  /** 境界別稱,如「純熟之境」。不給就不顯示。 */
  title?: string | undefined;
  size?: 'sm' | 'md';
}

export function RankSigil({ level, total, name, title, size = 'md' }: RankSigilProps) {
  const unranked = level <= 0 || name === '';
  const marks = Array.from({ length: Math.max(total, 0) }, (_, i) => i < level);
  const reading = unranked ? '未評定段位' : `段位 ${name}${title === undefined ? '' : ` ${title}`}`;

  return (
    <span
      className={[styles.sigil, styles[size], unranked ? styles.unranked : ''].join(' ')}
      role="img"
      aria-label={reading}
    >
      <span className={styles.marks} aria-hidden="true">
        {marks.map((on, i) => (
          <span key={i} className={on ? styles.on : styles.off} />
        ))}
      </span>
      <span className={styles.text} aria-hidden="true">
        <span className={styles.name}>{unranked ? '未評定' : name}</span>
        {title === undefined || unranked ? null : <span className={styles.title}>{title}</span>}
      </span>
    </span>
  );
}
