import Link from 'next/link';
import type { ReactNode } from 'react';

import { ACTS, STOPS, stopOf, type StopId } from '../features/landing/acts';
import { Theatre } from '../features/landing/Theatre';
import { CONTENT, isPlaceholder, SCHEDULE, TBA } from '../features/landing/content';
import { formatDay } from '../features/landing/dates';
import { PlumDates } from '../features/landing/doc/PlumDates';
import { PrizeWall } from '../features/landing/doc/PrizeWall';
import { RuleScroll } from '../features/landing/doc/RuleScroll';
import { SealButton } from '../features/landing/doc/SealButton';
import {
  BP_PER_GAP,
  CREED,
  HANDICAP_CATEGORIES,
  HANDICAP_TOTAL,
  RANKS,
} from '../features/landing/format';
import { Prologue } from '../features/landing/prologue/Prologue';
import { StopCard } from '../features/landing/StopCard';
import { WordReveal } from '../features/landing/WordReveal';

import styles from './page.module.css';

/**
 * 《劍塚》首頁 —— 三幕、六個定格點。
 *
 * 三條分工是硬的:
 *
 *  1. **3D 與影像只負責氣氛。** 這個檔案裡的每一個字都是語意化 HTML,伺服器端就算好了。
 *     關掉 JS、關掉 WebGL、開啟減少動態,六張卡的比賽資訊一字不少。
 *  2. **比賽事實只有一個來源。** 名稱、組別、日期、獎金、主辦、聯繫全部來自
 *     `features/landing/content.ts`,而那一份現在整份是 `{{PLACEHOLDER}}`。
 *     **不編造。** 定案時改那一個檔案,整站跟著換。
 *  3. **讓武的三十個項目不在這裡。** 首頁講的是制度(四階段位、BP 取得、六大類),
 *     逐項內容的權威位置是 hestia 的 seed;要看完整清單走 `/t/<slug>/rules`,
 *     那一頁從 API 取,永遠跟裁判手上的一致。
 *
 * 幕的帳冊(哪一幕、定格在哪)在 `features/landing/acts.ts`;
 * 這裡只負責把每一張卡的內容排出來。
 *
 * 當屆賽事的代號由 NEXT_PUBLIC_TOURNAMENT_SLUG 指定 —— theatron 是逐活動的前端,
 * 「現在是哪一屆」是部署設定,不是查詢。沒設定時不顯示入口:給一個會 404 的
 * 按鈕比不給更糟。
 */
const slug = process.env.NEXT_PUBLIC_TOURNAMENT_SLUG ?? '';

/**
 * 五張紙的錯位排布。
 *
 * 規格要「非置中對齊格線、留大量負空間」,而且卡片絕不遮住畫面主體。
 * 左右交替讓視線在畫面上來回,而不是一路往下滑過五張長得一樣的東西。
 * 序幕不在這裡 —— 它的文案是首屏的主文案,不是一張浮起來的紙。
 */
const SIDES: Readonly<Record<Exclude<StopId, 'prologue'>, 'left' | 'right'>> = {
  challenge: 'right',
  format: 'left',
  prize: 'right',
  schedule: 'left',
  signup: 'right',
};

/** 一個還沒定案的值。畫「待公布」,不是把大括號印出來。 */
function Field({ value }: { value: string | null }) {
  return isPlaceholder(value) ? (
    <span className={styles.tba} data-placeholder="">
      {TBA}
    </span>
  ) : (
    <>{value}</>
  );
}

export default function HomePage() {
  return (
    <Theatre
      colophon={<Colophon />}
      stages={{
        i: <ActOne />,
        ii: <ActTwo />,
        iii: <ActThree />,
      }}
    />
  );
}

/* ─────────────────────────────────────────────── 第一幕 影 · 旗後鬥劍 */

/**
 * 序幕的文案就是首屏的主文案,不是一張浮起來的紙。
 *
 * 版面照 `design/sword-jianghu` 的語法:左側 eyebrow → 超大兩行標題 → 副標 →
 * 對句。那一套是使用者指定的(「UI 元件擺放位置是我期望的」),量過的數字
 * 記在 notes/2026-09-14-劍塚-三幕重構-grill.md 的 Q14。
 */
function ActOne() {
  const act = ACTS[0]!;
  return (
    <Prologue titleId="stop-prologue-title">
      <p className={styles.eyebrow}>
        <span className={styles.dot} aria-hidden="true" />
        第一幕 {act.name} · {act.subtitle}
      </p>
      {/* 正式名稱還沒定,所以標題是這次視覺的代號,底下明講正式名稱待公布。
          把「待公布」放大當標題是在替主辦宣布一件他還沒決定的事。 */}
      <WordReveal
        as="h1"
        className={styles.heroTitle}
        id="stop-prologue-title"
        text={isPlaceholder(CONTENT.tournamentName) ? CONTENT.workingTitle : CONTENT.tournamentName}
        scrub
      />
      <p className={styles.heroSub}>
        正式名稱 <Field value={CONTENT.tournamentName} />
      </p>
      <p className={styles.couplet}>
        <Field value={CONTENT.tagline} />
      </p>
    </Prologue>
  );
}

/* ─────────────────────────────────────────────── 第二幕 破 · 噴墨與劃破 */

function ActTwo() {
  return (
    <Card stop="challenge" title="這是什麼比賽" seal={CONTENT.workingTitle}>
      <p className={styles.lead}>
        <Field value={CONTENT.tagline} />
      </p>
      <p className={styles.body}>
        一場為武俠玩家而起的對決。段位定其差,BP 量其讓 —— 強弱懸殊的兩個人,
        仍然值得認真打一場。往下四帖依序交代賽制、獎賞、日期與報名。
      </p>
      <ul className={styles.stopList}>
        {STOPS.filter((s) => s.id !== 'prologue' && s.id !== 'challenge').map((s, i) => (
          <li key={s.id}>
            <a href={`#stop-${s.id}`}>
              <b className={styles.mono}>{String(i + 2).padStart(3, '0')}</b>
              <span className={styles.stopName}>{s.kicker}</span>
              <span className={styles.stopWhat}>{s.remember}</span>
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ─────────────────────────────────────────────── 第三幕 界 · 四個場次 */

function ActThree() {
  return (
    <>
      {/* 賽制:四階段位、BP 取得、讓武六大類。這是首頁唯一講規則的地方,
          所以要講到讓人看得懂,不是一句「詳見規則頁」。 */}
      <Card stop="format" title="讓武" subtitle="BALANCE POINT">
        <p className={styles.lead}>{CREED}</p>

        <p className={styles.rankHead}>段位四階,由低至高</p>
        <ol className={styles.rankList}>
          {RANKS.map((r) => (
            <li key={r.level}>
              <b>{r.name}</b>
              <span>{r.title}</span>
            </li>
          ))}
        </ol>
        <p className={styles.body}>
          每差一段,低段位者得 <b className={styles.mono}>{BP_PER_GAP}</b> BP;差兩段{' '}
          <b className={styles.mono}>{BP_PER_GAP * 2}</b>、差三段{' '}
          <b className={styles.mono}>{BP_PER_GAP * 3}</b>。同段為 0,而且高段位者永不獲得反向補償。
        </p>

        <table className={styles.catTable}>
          <caption className={styles.catCaption}>
            讓武六大類,共 <b className={styles.mono}>{HANDICAP_TOTAL}</b> 項
          </caption>
          <thead>
            <tr>
              <th scope="col">類別</th>
              <th scope="col">在做什麼</th>
              <th scope="col">點數</th>
            </tr>
          </thead>
          <tbody>
            {HANDICAP_CATEGORIES.map((c) => (
              <tr key={c.key}>
                <th scope="row">{c.name}</th>
                <td>
                  {c.what}
                  <span className={styles.eg}>例:{c.example}</span>
                </td>
                <td className={styles.mono}>
                  {c.cost[0]}–{c.cost[1]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <RuleScroll />
      </Card>

      <Card stop="prize" title="獎賞">
        <p className={styles.lead}>紅印逐一蓋上剝漆的木牆,一顆印是一項獎賞。</p>
        <PrizeWall />
      </Card>

      <Card
        stop="schedule"
        title="四個日期"
        rows={SCHEDULE.map((s) => ({ label: s.name, value: formatDay(s.iso), mono: true }))}
      >
        <p className={styles.lead}>一條梅枝橫過畫面,每個日期是一朵花,到期才開。</p>
        <PlumDates />
      </Card>

      <Card stop="signup" title="報名" seal="用印">
        <p className={styles.lead}>雙開木門微啟,月光從內照出。用印,門就開了。</p>
        <SealButton text="用印" label="用印 · 看報名方式">
          <dl className={styles.signup}>
            <div className={styles.signupRow}>
              <dt className={styles.signupLabel}>報名方式</dt>
              <dd className={styles.signupValue}>
                {CONTENT.registrationUrl === null ? (
                  <Field value={null} />
                ) : (
                  <a className={styles.cta} href={CONTENT.registrationUrl}>
                    前往報名表單
                  </a>
                )}
              </dd>
            </div>
            <div className={styles.signupRow}>
              <dt className={styles.signupLabel}>開放報名</dt>
              <dd className={styles.signupValue}>{formatDay(CONTENT.registrationOpen)}</dd>
            </div>
            <div className={styles.signupRow}>
              <dt className={styles.signupLabel}>報名截止</dt>
              <dd className={styles.signupValue}>{formatDay(CONTENT.registrationClose)}</dd>
            </div>
          </dl>

          {slug === '' ? (
            <p className={styles.closed}>本屆還沒開賽,賽事頁尚未開放。</p>
          ) : (
            <nav className={styles.ctas} aria-label="進入本屆賽事">
              <Link className={`${styles.cta} ${styles.ctaLead}`} href={`/t/${slug}`}>
                進入本屆賽事
              </Link>
              <Link className={styles.cta} href={`/t/${slug}/bracket`}>
                看對戰表
              </Link>
              <Link className={styles.cta} href={`/t/${slug}/rules`}>
                規則
              </Link>
            </nav>
          )}
        </SealButton>
      </Card>
    </>
  );
}

/**
 * 一張定格卡。
 *
 * 只把「哪一個定格點、偏哪一側」查好交給 `StopCard` —— 卡片的殼是客戶端元件
 * (它要知道現在停在哪),裡面的內容仍然是伺服器端算的,所以關掉 JS 之後
 * 六張卡的字一個都不會少。
 *
 * 錨點**不在這裡**。它是零高度的標記,由殼放在「這一張卡浮上來」的捲動位置上
 * (見 Theatre.tsx 與 acts.ts 的 anchorOffsets)—— 掛在卡片上的話,
 * `#stop-signup` 會跳到第三幕的開頭,因為卡片住在釘住的舞台裡。
 */
function Card({
  stop,
  title,
  subtitle,
  rows,
  seal,
  children,
}: {
  stop: Exclude<StopId, 'prologue'>;
  title: string;
  subtitle?: string;
  rows?: { label: string; value: string; mono?: boolean }[];
  seal?: string;
  children: ReactNode;
}) {
  return (
    <StopCard
      stop={stopOf(stop)}
      side={SIDES[stop]}
      title={title}
      subtitle={subtitle}
      rows={rows}
      seal={seal}
    >
      {children}
    </StopCard>
  );
}

function Colophon() {
  return (
    <footer className={styles.foot}>
      <div className={styles.footGrid}>
        <div className={styles.footBrand}>
          <p className={styles.wordmark}>{CONTENT.workingTitle}</p>
          <p className={styles.footTag}>
            正式名稱 <Field value={CONTENT.tournamentName} />
          </p>
        </div>
        <nav className={styles.footNav} aria-label="頁尾定格點捷徑">
          <h2 className={styles.footHead}>六帖</h2>
          <ul className={styles.footList}>
            {STOPS.map((s, i) => (
              <li key={s.id}>
                <a href={`#stop-${s.id}`}>
                  {String(i).padStart(3, '0')} {s.kicker} · {s.remember}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {slug === '' ? null : (
          <nav className={styles.footNav} aria-label="頁尾賽事連結">
            <h2 className={styles.footHead}>本屆</h2>
            <ul className={styles.footList}>
              <li>
                <Link href={`/t/${slug}`}>賽事</Link>
              </li>
              <li>
                <Link href={`/t/${slug}/bracket`}>對戰表</Link>
              </li>
              <li>
                <Link href={`/t/${slug}/rules`}>規則</Link>
              </li>
            </ul>
          </nav>
        )}
      </div>
      <dl className={styles.credits}>
        <div className={styles.creditRow}>
          <dt className={styles.creditLabel}>主辦</dt>
          <dd className={styles.creditValue}>
            <Field value={CONTENT.organiser} />
          </dd>
        </div>
        <div className={styles.creditRow}>
          <dt className={styles.creditLabel}>合作</dt>
          <dd className={styles.creditValue}>
            {CONTENT.partners.every(isPlaceholder) ? (
              <Field value={null} />
            ) : (
              CONTENT.partners.join('、')
            )}
          </dd>
        </div>
        <div className={styles.creditRow}>
          <dt className={styles.creditLabel}>聯繫</dt>
          <dd className={styles.creditValue}>
            <Field value={CONTENT.contact} />
          </dd>
        </div>
      </dl>
      <p className={styles.footBase}>
        <span className={styles.mono}>JIANZHONG</span>
        <span>比賽資訊尚未定案,標為「待公布」的欄位確認後會直接替換。</span>
      </p>
    </footer>
  );
}
