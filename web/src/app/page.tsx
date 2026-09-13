import Link from 'next/link';
import { RankSigil } from '@theatron/ui';

import { HeroChapters } from '../features/landing/HeroChapters';
import { InkMark } from '../features/landing/InkMark';
import { Landing } from '../features/landing/Landing';
import { Reveal } from '../features/landing/Reveal';
import { WordReveal } from '../features/landing/WordReveal';

import styles from './page.module.css';

/**
 * 首頁。
 *
 * 引號裡的句子是使用者自己寫的,**不要改寫也不要「潤飾」** ——
 * 它們是這個賽事的語氣來源。其餘段落是結構性說明,可以改。
 *
 * 版面是五章的捲動敘事(序、讓武、段位、賽程、赴約),語法取自
 * references/kage-optimise:固定的環境層、超大左對齊標題、直排 CJK、
 * 細小字距的技術標籤、髮絲線、大量留白、釘在視窗底緣的近景去背素材。
 * 章節帳冊(哪一章配哪張背景、站哪幾件近景)在 features/landing/chapters.ts,
 * 不在這裡 —— 這裡只有字。
 *
 * 這個檔案是伺服器元件:所有字在沒有 JS 的情況下就已經在 HTML 裡,
 * Landing 那層殼只負責場景、近景與出場動態。
 *
 * 當屆賽事的代號由 NEXT_PUBLIC_TOURNAMENT_SLUG 指定。theatron 是逐活動的前端
 * (見 CLAUDE.md 的四 repo 表),所以「現在是哪一屆」是部署設定,不是查詢。
 * 沒設定時不顯示入口 —— 給一個會 404 的按鈕比不給更糟。
 */
const slug = process.env.NEXT_PUBLIC_TOURNAMENT_SLUG ?? '';

/** 讓武的四個數字。它們是規則本身,不是行銷數字,所以敢放這麼大。 */
const FACTS: ReadonlyArray<{ label: string; value: string }> = [
  { label: '段位', value: '4' },
  { label: '每差一段 BP', value: '8' },
  { label: '讓武項目', value: '34' },
  { label: '一場', value: '3 局 2 勝' },
];

/**
 * 四段。順序就是高低,所以用 <ol>,卡片也隨階數往下錯開 ——
 * 錯位在這裡不是裝飾,它畫的是同一件事:一階比一階深。
 */
const RANKS: ReadonlyArray<{ name: string; title: string; line: string }> = [
  { name: '開山', title: '初試之境', line: '剛進場。規則、器械、場地都還在熟悉。' },
  { name: '斷水', title: '初成之境', line: '打法成形了,輸贏開始由判斷決定,不再只是手速。' },
  { name: '飛花', title: '純熟之境', line: '手上有幾套穩定的答案,很少犯低級錯誤。' },
  { name: '無我', title: '歷戰之境', line: '打過夠多場,對手要做什麼,比他出手更早知道。' },
];

/** 一屆的六步。順序本身就是規則 —— 段位公布刻意排在抽籤之前。 */
const STEPS: ReadonlyArray<{ name: string; note: string; who: string }> = [
  { name: '報名', note: '填一個遊戲 ID 就算報名。', who: '選手' },
  { name: '評段', note: '御風羽逐人評定,四段:開山、斷水、飛花、無我。', who: '御風羽' },
  { name: '段位公布', note: '排在抽籤之前,有異議在這時候提。', who: '主辦' },
  { name: '抽籤', note: '單淘汰,人數不必是 2 的冪次,輪空直接進次輪。', who: '主辦' },
  { name: '選讓武', note: '每一輪依當下對手重算 BP,該場用完即作廢。', who: '低段位方' },
  { name: '開打', note: '裁判判定勝負,勝者晉級。', who: '裁判' },
];

export default function HomePage() {
  // 版權頁。它住在 <main> 外面,理由在 Landing 的 colophon prop 上 ——
  // 近景永遠釘在視窗底,而這一段永遠在文件底,兩個必定撞上。
  const colophon = (
    <footer className={styles.foot}>
      <div className={styles.footGrid}>
        <div className={styles.footBrand}>
          <p className={styles.wordmark}>百業試鋒</p>
          <p className={styles.footTag}>御風羽 段位評定</p>
        </div>
        <nav className={styles.footNav} aria-label="頁尾捷徑">
          <h2 className={styles.footHead}>這一頁</h2>
          <ul className={styles.footList}>
            <li>
              <a href="#chapter-01">讓武 BP</a>
            </li>
            <li>
              <a href="#chapter-02">四段</a>
            </li>
            <li>
              <a href="#chapter-03">賽程</a>
            </li>
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
        <span className={styles.mono}>BAIYE SHIFENG</span>
        <span>素材為生成素材,尚未定稿。</span>
      </p>
    </footer>
  );

  return (
    <Landing colophon={colophon}>
      {/* ────────────────────────────────────────────── 序 */}
      <section
        className={styles.hero}
        id="chapter-00"
        data-chapter-section="00"
        aria-labelledby="chapter-00-title"
      >
        <div className={styles.heroTop}>
          <p className={styles.eyebrow}>
            <span className={styles.dot} aria-hidden="true" />
            百業社群 · 內部 PVP 賽事
          </p>
          <WordReveal as="h1" className={styles.heroTitle} id="chapter-00-title" text="百業試鋒" />
          <Reveal as="p" className={styles.couplet}>
            段位定其差,BP 量其讓;
            <br />
            鋒芒雖受束,勝負仍由場上分曉。
          </Reveal>
        </div>

        {/* 直排的地名掛在右緣,像門柱上的那一行。橫排再寫一次會變成第二個標題。 */}
        <p className={styles.verse}>劍冢夜院</p>

        <div className={styles.heroFoot}>
          <p className={styles.cue} aria-hidden="true">
            <span>往下</span>
            <span className={styles.cueTrack}>
              <i />
            </span>
          </p>
          <HeroChapters />
        </div>
      </section>

      {/* ────────────────────────────────────────────── 壹 · 讓武 */}
      <section
        className={styles.sec}
        id="chapter-01"
        data-chapter-section="01"
        aria-labelledby="chapter-01-title"
      >
        <InkMark asset="ink-war-letter" />
        <header className={styles.secHead}>
          <p className={styles.k}>
            <b>章</b> 壹
          </p>
          <span className={styles.rule} aria-hidden="true" />
        </header>

        <div className={styles.spread}>
          <WordReveal as="h2" className={styles.h2} id="chapter-01-title" text="讓武 BP" />
          <div className={styles.copy}>
            <Reveal as="p" className={styles.lead}>
              兩個人實力差得遠,打起來就不好看 —— 強的一邊沒發揮,弱的一邊沒機會。 讓武 BP
              是拿來處理這件事的:段位差越大,低段位的一方拿到越多 BP,
              用它對高段位的一方施加正式的比賽限制。
            </Reveal>
            <Reveal as="blockquote" className={styles.quote}>
              BP 不保證弱者獲勝,只賦予後進要求強者以更困難方式取勝的權利。
            </Reveal>
            <Reveal as="p" className={styles.body}>
              <strong>讓武不是放水。</strong>受限的一方仍須全力求勝 —— 只是要用更難的方式贏。
              限制是公開的:封盤之後,雙方與觀眾都看得到這一場打的是什麼條件。
            </Reveal>
          </div>
        </div>

        <dl className={styles.facts}>
          {FACTS.map((f) => (
            <Reveal as="div" className={styles.fact} key={f.label}>
              <dt className={styles.factLabel}>{f.label}</dt>
              <dd className={styles.factValue}>{f.value}</dd>
            </Reveal>
          ))}
        </dl>
      </section>

      {/* ────────────────────────────────────────────── 貳 · 段位 */}
      <section
        className={styles.sec}
        id="chapter-02"
        data-chapter-section="02"
        aria-labelledby="chapter-02-title"
      >
        <header className={styles.secHead}>
          <p className={styles.k}>
            <b>章</b> 貳
          </p>
          <span className={styles.rule} aria-hidden="true" />
        </header>

        <div className={styles.spread}>
          <WordReveal as="h2" className={styles.h2} id="chapter-02-title" text="四段" />
          <div className={styles.copy}>
            <Reveal as="p" className={styles.lead}>
              段位是御風羽逐人評的,不是勝場算出來的。評完才有 BP 可算 ——
              兩個人差幾段,低的那一方就拿幾份。
            </Reveal>
          </div>
        </div>

        <ol className={styles.cards}>
          {RANKS.map((r, i) => (
            <Reveal as="li" className={styles.card} key={r.name}>
              <RankSigil level={i + 1} total={RANKS.length} name={r.name} title={r.title} />
              <p className={styles.cardLine}>{r.line}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ────────────────────────────────────────────── 參 · 賽程 */}
      <section
        className={styles.sec}
        id="chapter-03"
        data-chapter-section="03"
        aria-labelledby="chapter-03-title"
      >
        <InkMark asset="ink-schedule" side="end" />
        <header className={styles.secHead}>
          <p className={styles.k}>
            <b>章</b> 參
          </p>
          <span className={styles.rule} aria-hidden="true" />
        </header>

        <div className={styles.spread}>
          <WordReveal as="h2" className={styles.h2} id="chapter-03-title" text="一屆是怎麼跑的" />
          <div className={styles.copy}>
            <Reveal as="p" className={styles.lead}>
              六步,從報名到開打。每一步的位置都有理由,不能對調。
            </Reveal>
          </div>
        </div>

        <ol className={styles.steps}>
          {STEPS.map((s, i) => (
            <Reveal as="li" className={styles.step} key={s.name}>
              <span className={styles.stepNum} aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className={styles.stepName}>{s.name}</h3>
              <p className={styles.stepNote}>{s.note}</p>
              <span className={styles.stepWho}>{s.who}</span>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ────────────────────────────────────────────── 肆 · 赴約 */}
      <section
        className={styles.fin}
        id="chapter-04"
        data-chapter-section="04"
        aria-labelledby="chapter-04-title"
      >
        <p className={styles.eyebrow}>
          <span className={styles.dot} aria-hidden="true" />章 肆 · 本屆入口
        </p>
        <WordReveal as="h2" className={styles.finTitle} id="chapter-04-title" text="赴約" />
        <Reveal as="p" className={styles.finLine}>
          段位、籤位、讓武項目都在裡面。要打的人從這裡進去。
        </Reveal>

        {slug === '' ? (
          <p className={styles.closed}>本屆還沒開賽,入口關著。</p>
        ) : (
          <nav className={styles.ctas} aria-label="進入本屆賽事">
            <Link className={`${styles.cta} ${styles.ctaLead}`} href={`/t/${slug}`}>
              進入本屆賽事
            </Link>
            <Link className={styles.cta} href={`/t/${slug}/bracket`}>
              看對戰表
            </Link>
            <Link className={styles.cta} href={`/t/${slug}/rules`}>
              規則與讓武項目
            </Link>
          </nav>
        )}
      </section>
    </Landing>
  );
}
