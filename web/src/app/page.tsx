import Link from 'next/link';

import { CHAPTERS } from '../features/landing/chapters';
import { CONTENT, isPlaceholder, TBA } from '../features/landing/content';
import { PlumDates } from '../features/landing/doc/PlumDates';
import { PrizeWall } from '../features/landing/doc/PrizeWall';
import { RuleScroll } from '../features/landing/doc/RuleScroll';
import { SealButton } from '../features/landing/doc/SealButton';
import { formatDay } from '../features/landing/dates';
import { HeroChapters } from '../features/landing/HeroChapters';
import { InkMark } from '../features/landing/InkMark';
import { Landing } from '../features/landing/Landing';
import { Prologue } from '../features/landing/prologue/Prologue';
import { Reveal } from '../features/landing/Reveal';
import { Seal } from '../features/landing/Seal';
import { WordReveal } from '../features/landing/WordReveal';

import styles from './page.module.css';

/**
 * 《劍塚》首頁 —— 七章的電影式捲軸。
 *
 * 兩條分工是硬的:
 *
 *  1. **3D 不承載資訊。** 這個檔案裡的每一個字都是語意化 HTML,伺服器端就算好了。
 *     關掉 JS、關掉 WebGL、開啟減少動態,七章的比賽資訊一字不少。畫布只是布景。
 *  2. **比賽事實只有一個來源。** 名稱、組別、日期、獎金、主辦、聯繫全部來自
 *     `features/landing/content.ts`,而那一份現在整份是 `{{PLACEHOLDER}}`。
 *     **不編造。** 定案時改那一個檔案,整站跟著換。
 *
 * 章節帳冊(哪一章叫什麼、場景是什麼、要記住哪件事)在 features/landing/chapters.ts;
 * 這裡只負責把每一章的內容排出來。
 *
 * 當屆賽事的代號由 NEXT_PUBLIC_TOURNAMENT_SLUG 指定 —— theatron 是逐活動的前端,
 * 「現在是哪一屆」是部署設定,不是查詢。沒設定時不顯示入口:給一個會 404 的
 * 按鈕比不給更糟。
 */
const slug = process.env.NEXT_PUBLIC_TOURNAMENT_SLUG ?? '';

/** 章名 → 章節帳冊那一列。標題與 aria 都從帳冊來,不在這裡重打一次。 */
function chapter(id: (typeof CHAPTERS)[number]['id']) {
  const found = CHAPTERS.find((c) => c.id === id);
  if (found === undefined) throw new Error(`章節帳冊沒有這一章:${id}`);
  return found;
}

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
  const ch = {
    c1: chapter('01'),
    c2: chapter('02'),
    c3: chapter('03'),
    c4: chapter('04'),
    c5: chapter('05'),
    c6: chapter('06'),
    c7: chapter('07'),
  };

  // 落款住在 <main> 外面,理由在 Landing 的 colophon prop 上 ——
  // 近景永遠釘在視窗底,而這一段永遠在文件底,兩個必定撞上。
  const colophon = (
    <footer className={styles.foot}>
      <div className={styles.footGrid}>
        <div className={styles.footBrand}>
          <p className={styles.wordmark}>{CONTENT.workingTitle}</p>
          <p className={styles.footTag}>
            正式名稱 <Field value={CONTENT.tournamentName} />
          </p>
        </div>
        <nav className={styles.footNav} aria-label="頁尾章節捷徑">
          <h2 className={styles.footHead}>七章</h2>
          <ul className={styles.footList}>
            {CHAPTERS.map((c) => (
              <li key={c.id}>
                <a href={`#${c.anchor}`}>
                  {c.id} {c.name}
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
      <p className={styles.footBase}>
        <span className={styles.mono}>JIANZHONG</span>
        <span>比賽資訊尚未定案,標為「待公布」的欄位確認後會直接替換。</span>
      </p>
    </footer>
  );

  return (
    <Landing colophon={colophon}>
      {/* ─────────────────────────────────── 01 殘旗 · 序幕 */}
      <Prologue titleId="chapter-01-title">
        <p className={styles.eyebrow}>
          <span className={styles.dot} aria-hidden="true" />
          {ch.c1.act} · {ch.c1.id} {ch.c1.name}
        </p>
        {/* 正式名稱還沒定,所以標題是這次視覺的代號,底下明講正式名稱待公布。
            把「待公布」放大當標題是在替主辦宣布一件他還沒決定的事。 */}
        <WordReveal
          as="h1"
          className={styles.heroTitle}
          id="chapter-01-title"
          text={
            isPlaceholder(CONTENT.tournamentName) ? CONTENT.workingTitle : CONTENT.tournamentName
          }
          scrub
        />
        <p className={styles.heroSub}>
          正式名稱 <Field value={CONTENT.tournamentName} />
        </p>
        <p className={styles.couplet}>
          <Field value={CONTENT.tagline} />
        </p>
      </Prologue>

      {/* ─────────────────────────────────── 02 歸寂 · 戰帖 */}
      <section
        className={styles.sec}
        id={ch.c2.anchor}
        data-chapter-section="02"
        aria-labelledby="chapter-02-title"
      >
        <InkMark asset="ink-war-letter" />
        <header className={styles.secHead}>
          <p className={styles.k}>
            <b>{ch.c2.act}</b> {ch.c2.id}
          </p>
          <span className={styles.rule} aria-hidden="true" />
        </header>

        <div className={styles.spread}>
          <WordReveal as="h2" className={styles.h2} id="chapter-02-title" text={ch.c2.name} />
          <div className={styles.copy}>
            <Reveal as="p" className={styles.lead}>
              這是什麼比賽:
              <Field value={CONTENT.tagline} />
            </Reveal>
            <Reveal as="p" className={styles.body}>
              人已離去,竹影掃過石階。往下七章會依序交代組別與規則、獎賞、四個日期、
              報名方式,最後是主辦與聯繫。每一章只有一件事要記。
            </Reveal>
            <Reveal as="dl" className={styles.facts}>
              <div className={styles.fact}>
                <dt className={styles.factLabel}>組別</dt>
                <dd className={styles.factValue}>
                  {CONTENT.divisions.every(isPlaceholder) ? TBA : CONTENT.divisions.length}
                </dd>
              </div>
              <div className={styles.fact}>
                <dt className={styles.factLabel}>報名截止</dt>
                <dd className={styles.factValue}>{formatDay(CONTENT.registrationClose)}</dd>
              </div>
              <div className={styles.fact}>
                <dt className={styles.factLabel}>初賽</dt>
                <dd className={styles.factValue}>{formatDay(CONTENT.qualifiersDate)}</dd>
              </div>
              <div className={styles.fact}>
                <dt className={styles.factLabel}>決賽</dt>
                <dd className={styles.factValue}>{formatDay(CONTENT.finalsDate)}</dd>
              </div>
            </Reveal>
          </div>
        </div>

        <HeroChapters />
      </section>

      {/* ─────────────────────────────────── 03 破頂 · 賽制 */}
      <section
        className={styles.sec}
        id={ch.c3.anchor}
        data-chapter-section="03"
        aria-labelledby="chapter-03-title"
      >
        <InkMark asset="ink-rules" side="end" />
        <header className={styles.secHead}>
          <p className={styles.k}>
            <b>{ch.c3.act}</b> {ch.c3.id}
          </p>
          <span className={styles.rule} aria-hidden="true" />
        </header>

        <div className={styles.spread}>
          <WordReveal as="h2" className={styles.h2} id="chapter-03-title" text={ch.c3.name} />
          <div className={styles.copy}>
            <Reveal as="p" className={styles.lead}>
              大廳的斷腿木桌上攤著一卷舊捲軸。{ch.c3.remember}都在上面。
            </Reveal>
          </div>
        </div>

        <RuleScroll />
      </section>

      {/* ─────────────────────────────────── 04 朱印 · 承 */}
      <section
        className={styles.sec}
        id={ch.c4.anchor}
        data-chapter-section="04"
        aria-labelledby="chapter-04-title"
      >
        <InkMark asset="ink-rewards" />
        <header className={styles.secHead}>
          <p className={styles.k}>
            <b>{ch.c4.act}</b> {ch.c4.id}
          </p>
          <span className={styles.rule} aria-hidden="true" />
        </header>

        <div className={styles.spread}>
          <WordReveal as="h2" className={styles.h2} id="chapter-04-title" text={ch.c4.name} />
          <div className={styles.copy}>
            <Reveal as="p" className={styles.lead}>
              紅印逐一蓋上剝漆的木牆,一顆印是一項獎賞。
            </Reveal>
          </div>
        </div>

        <PrizeWall />
      </section>

      {/* ─────────────────────────────────── 05 花信 · 承 */}
      <section
        className={styles.sec}
        id={ch.c5.anchor}
        data-chapter-section="05"
        aria-labelledby="chapter-05-title"
      >
        <InkMark asset="ink-schedule" side="end" />
        <header className={styles.secHead}>
          <p className={styles.k}>
            <b>{ch.c5.act}</b> {ch.c5.id}
          </p>
          <span className={styles.rule} aria-hidden="true" />
        </header>

        <div className={styles.spread}>
          <WordReveal as="h2" className={styles.h2} id="chapter-05-title" text={ch.c5.name} />
          <div className={styles.copy}>
            <Reveal as="p" className={styles.lead}>
              一條梅枝橫過畫面,每個日期是一朵花,到期才開。
            </Reveal>
          </div>
        </div>

        <PlumDates />
      </section>

      {/* ─────────────────────────────────── 06 啟門 · 啟 */}
      <section
        className={styles.sec}
        id={ch.c6.anchor}
        data-chapter-section="06"
        aria-labelledby="chapter-06-title"
      >
        <InkMark asset="ink-signup" />
        <header className={styles.secHead}>
          <p className={styles.k}>
            <b>{ch.c6.act}</b> {ch.c6.id}
          </p>
          <span className={styles.rule} aria-hidden="true" />
        </header>

        <div className={styles.spread}>
          <WordReveal as="h2" className={styles.h2} id="chapter-06-title" text={ch.c6.name} />
          <div className={styles.copy}>
            <Reveal as="p" className={styles.lead}>
              雙開木門微啟,月光從內照出。用印,門就開了。
            </Reveal>
          </div>
        </div>

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
      </section>

      {/* ─────────────────────────────────── 07 落款 · 啟 */}
      <section
        className={styles.fin}
        id={ch.c7.anchor}
        data-chapter-section="07"
        aria-labelledby="chapter-07-title"
      >
        <header className={styles.secHead}>
          <p className={styles.k}>
            <b>{ch.c7.act}</b> {ch.c7.id}
          </p>
          <span className={styles.rule} aria-hidden="true" />
        </header>

        <div className={styles.signOff}>
          <WordReveal as="h2" className={styles.finTitle} id="chapter-07-title" text={ch.c7.name} />
          <span className={styles.finSeal} aria-hidden="true">
            <Seal text={CONTENT.workingTitle} />
          </span>
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
      </section>
    </Landing>
  );
}
