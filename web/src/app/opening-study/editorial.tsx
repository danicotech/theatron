import styles from './study.module.css';
import { WireCover } from './wireframe';

const PERSON = '/lunjian/art/manga-veteran-layer.webp';
const SWORD = '/lunjian/art/manga-sword-layer.webp';

export function EditorialCover({ id }: { id: 'F' | 'G' | 'H' | 'I' | 'J' }) {
  if (id === 'I') return <WireCover />;
  return (
    <div className={`${styles.cover} ${styles.editorial}`} data-cover data-editorial>
      <header className={styles.edRunning} data-intro-copy>
        <span>夜鴉閣</span>
        <span>百業試鋒 ／ 入境篇</span>
      </header>
      {id === 'F' && (
        <>
          <div className={styles.edBigType} data-ed-type>
            試鋒
          </div>
          <img className={styles.edPerson} data-ed-person src={PERSON} alt="" draggable={false} />
          <span className={styles.edSpine} data-ed-detail>
            不問來處，各試其鋒。
          </span>
          <div className={styles.edContactSheet}>
            <figure className={styles.edFace} data-ed-detail data-portal-anchor>
              <img src={PERSON} alt="" draggable={false} />
              <figcaption>01 ／ 凝神</figcaption>
            </figure>
            <figure className={styles.edSword} data-ed-detail>
              <img src={SWORD} alt="" draggable={false} />
              <figcaption>02 ／ 出鞘</figcaption>
            </figure>
            <p data-ed-detail>
              一場相逢。
              <br />
              各自成章。
            </p>
          </div>
          <span className={styles.edIssue} data-ed-detail>
            BAIYE
            <br />
            SHIFENG
          </span>
        </>
      )}
      {id === 'G' && (
        <>
          <strong className={styles.edCutTitle} data-ed-type>
            百業
            <br />
            <span>試鋒</span>
          </strong>
          <img
            className={styles.edCutPerson}
            data-ed-person
            src={PERSON}
            alt=""
            draggable={false}
          />
          <div className={styles.edColorCut} data-ed-cut data-portal-anchor>
            <img src={PERSON} alt="" draggable={false} />
            <i />
          </div>
          <span className={styles.edCutVertical} data-ed-detail>
            同場，不同鋒芒。
          </span>
          <div className={styles.edCutNote} data-ed-detail>
            <span>夜鴉閣 ／ 武誌</span>
            <p>
              不因段位拒絕任何人，
              <br />
              也不要求任何人假裝變弱。
            </p>
          </div>
          <i className={styles.edCross} data-ed-detail>
            ✳
          </i>
        </>
      )}
      {id === 'H' && (
        <>
          <img
            className={styles.edFocusBase}
            data-ed-person
            src={PERSON}
            alt=""
            draggable={false}
          />
          <strong className={styles.edFocusTitle} data-ed-type>
            凝<span>視</span>
          </strong>
          <div className={styles.edFocus} data-ed-focus data-portal-anchor>
            <div className={styles.edFocusWindow}>
              <img src={PERSON} alt="" draggable={false} />
            </div>
            <i />
            <i />
            <i />
            <i />
          </div>
          <p className={styles.edFocusNote} data-ed-detail>
            在交鋒之前
            <br />
            看見自己
          </p>
          <div className={styles.edFocusFooter} data-ed-detail>
            <b>FOCUS</b>
            <span>
              百業試鋒
              <br />
              夜鴉閣
            </span>
          </div>
        </>
      )}
      {id === 'J' && (
        <>
          <div className={styles.montageBackdrop} data-ed-person>
            <img src={PERSON} alt="" draggable={false} />
          </div>
          <figure
            className={`${styles.montageFrame} ${styles.montageMain}`}
            data-montage-main
            data-portal-anchor
          >
            <img src={PERSON} alt="" draggable={false} />
            <figcaption>神 ／ PORTRAIT</figcaption>
          </figure>
          <figure className={`${styles.montageFrame} ${styles.montageEye}`} data-montage-detail>
            <img src={PERSON} alt="" draggable={false} />
            <figcaption>目 ／ GAZE</figcaption>
          </figure>
          <figure className={`${styles.montageFrame} ${styles.montageFull}`} data-montage-detail>
            <img src={PERSON} alt="" draggable={false} />
            <figcaption>形 ／ FIGURE</figcaption>
          </figure>
          <figure className={`${styles.montageFrame} ${styles.montageSword}`} data-montage-detail>
            <img src={SWORD} alt="" draggable={false} />
            <figcaption>鋒 ／ DETAIL</figcaption>
          </figure>
          <strong className={styles.montageTitle} data-ed-type>
            一人
            <br />
            <span>千面</span>
          </strong>
          <span className={styles.montageMark} data-ed-detail>
            百業試鋒 ／ 夜鴉閣
          </span>
        </>
      )}
      <footer className={styles.edFolio} data-ed-detail>
        <span>YAGE ／ THE OPENING</span>
        <span>{{ F: '01', G: '02', H: '03', I: '04', J: '05' }[id]}</span>
      </footer>
    </div>
  );
}
