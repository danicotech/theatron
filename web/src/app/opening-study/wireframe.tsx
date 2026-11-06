import styles from './wireframe.module.css';
import { SharpHomeScene } from '../../features/chrome/SharpHomeScene';

const ART = '/opening-art/v1';
const PEOPLE = '/opening-art/v2';

/** All three registered copies share the same transparent source and geometry. */
function PersonGuide() {
  return (
    <div className={styles.person} data-wire-person>
      <img
        src={`${PEOPLE}/hero-left.webp`}
        alt=""
        draggable={false}
        data-person-art
        width={960}
        height={1200}
      />
    </div>
  );
}
function BackgroundGuide({ published = false }: { published?: boolean }) {
  return (
    <div className={styles.background} data-wire-background>
      <img
        src={published ? '/lunjian/art/bg/scene-gate.webp' : `${ART}/background.webp`}
        alt=""
        draggable={false}
        width={1440}
        height={810}
      />
    </div>
  );
}
function ForegroundArt() {
  return (
    <img
      className={styles.foreground}
      data-foreground-art
      src={`${ART}/foreground.webp`}
      alt=""
      draggable={false}
      width={960}
      height={540}
    />
  );
}
/** The frame is behind the head; only its lower lip sits in front of the body. */
function PortraitGuide({
  second = false,
  published = false,
}: {
  second?: boolean;
  published?: boolean;
}) {
  return (
    <figure className={second ? styles.secondPortrait : undefined} data-wire-detail>
      <div className={styles.portraitBack} data-portrait-frame>
        <i className={styles.darkFrame} data-frame-ink />
        <i className={styles.lightFrame} data-frame-paper />
      </div>
      <div className={styles.portraitCrop}>
        <div className={styles.portraitPerson} data-portrait-person>
          <img
            className={styles.portraitRest}
            src={`${PEOPLE}/${second ? 'portrait-white' : 'portrait-a'}.webp`}
            alt=""
            draggable={false}
            width={320}
            height={480}
          />
          {published && (
            <img
              className={styles.portraitArmed}
              data-portrait-armed
              src={`${PEOPLE}/${second ? 'portrait-white-armed-v2' : 'portrait-a-armed-v1'}.webp`}
              alt=""
              draggable={false}
              decoding="async"
              fetchPriority="low"
              width={1024}
              height={1536}
            />
          )}
        </div>
      </div>
      <div className={styles.portraitLip} data-portrait-lip />
      {published ? (
        <a
          className={styles.portraitLink}
          href={second ? '/#register' : '/#rules'}
          data-cover-link
          data-ink-wave="off"
        >
          <span>{second ? '報名' : '規則說明'}</span>
        </a>
      ) : (
        <figcaption>{second ? '白' : '黑'}</figcaption>
      )}
    </figure>
  );
}

/** Separate one-pixel edges retain their weight while the window expands. */
export function WirePortalOutline() {
  return (
    <div className={styles.portalOutline} data-portal-outline aria-hidden="true">
      {[0, 1].map((tone) => (
        <div key={tone} data-outline-tone={tone}>
          {['top', 'right', 'bottom', 'left'].map((edge) => (
            <i key={edge} data-outline-edge={edge} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function WireCover({ published = false }: { published?: boolean }) {
  return (
    <div
      className={styles.cover}
      data-cover
      data-editorial
      data-wire-cover
      data-published={published || undefined}
    >
      <div className={styles.base} data-layer="0">
        <BackgroundGuide published={published} />
      </div>
      <div className={styles.grayPerson} data-layer="10">
        <PersonGuide />
      </div>
      <div className={styles.colorFrame} data-layer="20" data-portal-anchor data-wire-color>
        <div className={styles.registeredScene} data-registered-scene>
          <BackgroundGuide published={published} />
          <PersonGuide />
        </div>
      </div>
      <div className={styles.frameEdge} data-layer="30" data-wire-main-edge>
        <i className={styles.darkFrame} data-frame-ink />
        <i className={styles.lightFrame} data-frame-paper />
      </div>
      <div className={styles.sleeveBreakout} data-layer="35" data-wire-breakout>
        <PersonGuide />
      </div>
      <div className={styles.foregroundLayer} data-layer="36">
        <ForegroundArt />
      </div>
      {published && (
        <a
          className={styles.frameLink}
          href="/home?intro=0&stage=2d"
          data-cover-link
          data-cover-home
          data-frame-entry
          data-ink-wave="off"
          aria-label="開啟人物畫框，前往首頁"
        />
      )}
      <strong className={styles.spine} data-layer="40" data-ed-type>
        {published ? (
          <a
            href="/home?intro=0&stage=2d"
            data-cover-link
            data-cover-home
            aria-label="百業試鋒 · 前往首頁"
          >
            BAIYE SHIFENG
          </a>
        ) : (
          'MAKIMA'
        )}
      </strong>
      <div className={styles.details} data-layer="50" data-wire-details>
        <PortraitGuide published={published} />
        <PortraitGuide second published={published} />
      </div>
      <div className={styles.footer} data-layer="60" data-intro-copy>
        {published ? (
          <strong className={styles.headline}>百業試鋒</strong>
        ) : (
          <strong className={styles.headline}>
            CONTROL
            <br />
            DEVIL
          </strong>
        )}
        <div
          className={styles.microcopy}
          aria-label={published ? '夜鴉閣 · 百業試鋒' : '原圖小字無法辨識，僅保留排版位置'}
        >
          {published ? (
            <>
              <p>
                不問段位，以武會友。
                <br />
                讓武補差，同場試鋒。
              </p>
            </>
          ) : (
            <>
              <i />
              <i />
              <i />
              <i />
              <i />
              <span>小字區 · 待確認</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function WireScene() {
  return (
    <div className={styles.scene} data-wire-scene>
      <SharpHomeScene />
    </div>
  );
}
