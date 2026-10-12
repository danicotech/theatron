import type { Tournament } from './model';
import styles from './Sportsbook.module.css';
import receiptStyles from './MyCeremonyPrizes.module.css';

/** Member-facing receipts; ceremony administration never changes a match result. */
export function MyCeremonyPrizes({ events, userId }: { events: Tournament[]; userId: string }) {
  if (!userId) return null;
  const records = events
    .flatMap((event) => [
      ...(event.ceremony?.draws || [])
        .filter((draw) => draw.userId === userId)
        .map((draw) => ({
          id: `${event.id}:draw:${draw.id}`,
          event: event.name,
          title: '抽獎得獎',
          prize: draw.prize,
          delivered: draw.delivered,
          created: draw.created,
        })),
      ...(event.ceremony?.awards || [])
        .filter((award) => event.links[userId] === award.playerId)
        .map((award) => ({
          id: `${event.id}:award:${award.id}`,
          event: event.name,
          title: award.title,
          prize: award.prize,
          delivered: award.delivered,
          created: award.created,
        })),
    ])
    .sort((a, b) => b.created - a.created);
  if (!records.length) return null;
  return (
    <section className={receiptStyles.receipts} aria-label="活動得獎紀錄">
      <h3>活動得獎</h3>
      {records.map((record) => (
        <article className={styles.ticket} key={record.id}>
          <h4>
            {record.title} · {record.prize}
          </h4>
          <p>{record.event}</p>
          <p>{record.delivered ? '已標記頒發' : '待現場頒發'}</p>
          <small>登錄時間 {new Date(record.created).toLocaleString('zh-TW')}</small>
        </article>
      ))}
    </section>
  );
}
