import Link from 'next/link';

import styles from './page.module.css';

/**
 * 首頁。
 *
 * 引號裡的句子是使用者自己寫的,**不要改寫也不要「潤飾」** ——
 * 它們是這個賽事的語氣來源。其餘段落是結構性說明,可以改。
 *
 * 當屆賽事的代號由 NEXT_PUBLIC_TOURNAMENT_SLUG 指定。theatron 是逐活動的前端
 * (見 CLAUDE.md 的四 repo 表),所以「現在是哪一屆」是部署設定,不是查詢。
 * 沒設定時不顯示入口 —— 給一個會 404 的按鈕比不給更糟。
 */
const slug = process.env.NEXT_PUBLIC_TOURNAMENT_SLUG ?? '';

export default function HomePage() {
  return (
    <main className={styles.home}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>百業社群 · 內部 PVP 賽事</p>
        <h1 className={styles.title}>百業試鋒</h1>
        <p className={styles.couplet}>
          段位定其差,BP 量其讓;
          <br />
          鋒芒雖受束,勝負仍由場上分曉。
        </p>
      </section>

      <section className={styles.block} aria-labelledby="what">
        <h2 className={styles.h2} id="what">
          讓武 BP
        </h2>
        <p className={styles.body}>
          兩個人實力差得遠,打起來就不好看 —— 強的一邊沒發揮,弱的一邊沒機會。 讓武 BP
          是拿來處理這件事的:段位差越大,低段位的一方拿到越多 BP,
          用它對高段位的一方施加正式的比賽限制。
        </p>
        <blockquote className={styles.quote}>
          BP 不保證弱者獲勝,只賦予後進要求強者以更困難方式取勝的權利。
        </blockquote>
        <p className={styles.body}>
          <strong>讓武不是放水。</strong>受限的一方仍須全力求勝 —— 只是要用更難的方式贏。
          限制是公開的:封盤之後,雙方與觀眾都看得到這一場打的是什麼條件。
        </p>
      </section>

      <section className={styles.block} aria-labelledby="how">
        <h2 className={styles.h2} id="how">
          一屆是怎麼跑的
        </h2>
        {/* 這是真的序列,所以編號帶資訊 —— 順序本身就是規則
            (段位公布刻意排在抽籤之前)。 */}
        <ol className={styles.steps}>
          <li>
            <span className={styles.stepName}>報名</span>
            <span className={styles.stepNote}>填一個遊戲ID 就算報名。</span>
          </li>
          <li>
            <span className={styles.stepName}>評段</span>
            <span className={styles.stepNote}>御風羽逐人評定,四段:開山、斷水、飛花、無我。</span>
          </li>
          <li>
            <span className={styles.stepName}>段位公布</span>
            <span className={styles.stepNote}>排在抽籤之前,有異議在這時候提。</span>
          </li>
          <li>
            <span className={styles.stepName}>抽籤</span>
            <span className={styles.stepNote}>單淘汰,人數不必是 2 的冪次,輪空直接進次輪。</span>
          </li>
          <li>
            <span className={styles.stepName}>選讓武</span>
            <span className={styles.stepNote}>每一輪依當下對手重算 BP,該場用完即作廢。</span>
          </li>
          <li>
            <span className={styles.stepName}>開打</span>
            <span className={styles.stepNote}>裁判判定勝負,勝者晉級。</span>
          </li>
        </ol>
      </section>

      {slug === '' ? null : (
        <section className={styles.enter} aria-label="進入本屆賽事">
          <Link className={styles.primary} href={`/t/${slug}`}>
            進入本屆賽事
          </Link>
          <Link className={styles.secondary} href={`/t/${slug}/rules`}>
            規則與讓武項目
          </Link>
        </section>
      )}
    </main>
  );
}
