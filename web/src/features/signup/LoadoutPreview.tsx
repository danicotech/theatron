import { BuildCard } from '../signup/BuildCard';
import { useState } from 'react';
import type { Preview, PreviewItem, PreviewStat } from './loadoutPreviewModel';
import styles from './LoadoutPreview.module.css';

function Artwork({
  item,
  book = false,
  manual = false,
}: {
  item: PreviewItem;
  book?: boolean;
  manual?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className={styles.item} data-book={book}>
      <div
        className={styles.artwork}
        data-image={!manual && !!item.image && !failed}
        data-manual={manual}
      >
        {manual ? (
          <span className={styles.manual} aria-hidden="true">
            <span className={styles.manualTitle}>{item.name}</span>
          </span>
        ) : item.image && !failed ? (
          // Static catalog artwork is already optimized and shared with the armory.
          <img
            src={item.image}
            alt=""
            width={120}
            height={120}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className={book ? styles.bookLabel : styles.placeholder} aria-hidden="true">
            {book
              ? item.name
              : item.name === '待配置' || item.name === '未裝備'
                ? '＋'
                : item.name.slice(0, 2)}
          </span>
        )}
        {item.main && <span className={styles.main}>主修</span>}
      </div>
      <figcaption>
        <strong>{item.name}</strong>
        {item.caption && <small>{item.caption}</small>}
      </figcaption>
    </figure>
  );
}

function Stats({ rows }: { rows: PreviewStat[] }) {
  return (
    <dl className={styles.stats}>
      {rows.map((row, i) => (
        <div key={i} data-kind={row.kind}>
          <dt>{row.name}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function GearCard({ item }: { item: PreviewItem }) {
  const [failed, setFailed] = useState(false);
  const gear = item.gear;
  const empty = item.name === '未裝備' || item.name === '待配置';
  return (
    <article className={styles.gearCard} aria-label={`${item.caption ?? ''} ${item.name}`}>
      <header className={styles.gearHeader} data-quality={gear?.quality || undefined}>
        <div className={styles.gearTitle}>
          <small>
            {item.caption}
            {gear?.quality && ` · ${gear.quality}`}
          </small>
          <strong>{item.name}</strong>
          {gear && (
            <small>
              {gear.level ? `${gear.level}級` : '未填等級'}
              {gear.set && ` · ${gear.set}`}
            </small>
          )}
        </div>
        {item.image && !failed ? (
          <img
            src={item.image}
            alt=""
            width={160}
            height={160}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className={styles.gearPlaceholder} aria-hidden="true">
            {empty ? '＋' : '器'}
          </span>
        )}
      </header>
      {gear ? (
        <>
          {gear.base.length > 0 && <Stats rows={gear.base} />}
          <Stats rows={gear.affixes} />
          {!gear.hideSummary && (
            <footer className={styles.gearFooter}>
              <span>{gear.filled} / 6 條</span>
              <strong aria-label={`詞條滾值比例 ${gear.score}`}>{gear.score}</strong>
            </footer>
          )}
        </>
      ) : (
        <p className={styles.gearEmpty}>{empty ? '尚未配置' : '尚無裝備詞條明細'}</p>
      )}
    </article>
  );
}

export function LoadoutPreview({ preview }: { preview: Preview }) {
  return (
    <div className={styles.preview} aria-label="配置預覽">
      {(['style', 'weapon', 'equipment', 'martials', 'minds', 'arts'] as const).map(
        (key, index) => (
          <section key={key} className={styles.section} data-kind={key}>
            <h5>{['流派', '武器', '裝備', '武學', '心法', '奇術'][index]}</h5>
            <div className={styles.items}>
              {(preview[key].length ? preview[key] : [{ name: '待配置' }]).map((entry, i) =>
                key === 'style' ? (
                  <BuildCard key={entry.name} name={entry.name === '待配置' ? '' : entry.name} />
                ) : key === 'weapon' || key === 'equipment' ? (
                  <GearCard key={`${entry.name}:${entry.image}:${i}`} item={entry} />
                ) : (
                  <Artwork
                    key={`${entry.name}:${entry.image}:${i}`}
                    item={entry}
                    book
                    manual={key === 'arts'}
                  />
                ),
              )}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
