import styles from './sharp-home-scene.module.css';

/** The portal uses the same sharp assets and framing as the actual 2D home. */
export function SharpHomeScene() {
  return (
    <div className={styles.scene} data-sharp-home-scene aria-hidden="true">
      <img className={styles.gate} src="/lunjian/art/bg/scene-gate.webp" alt="" draggable={false} />
      <div className={styles.shade} />
      <img className={styles.bamboo} src="/lunjian/art/fg-bamboo.webp" alt="" draggable={false} />
      <img
        className={styles.plum}
        src="/lunjian/art/fg-plum-branch-v3.webp"
        alt=""
        draggable={false}
      />
      <img className={styles.pine} src="/lunjian/art/fg-snow-pine.webp" alt="" draggable={false} />
      <img
        className={styles.blossom}
        src="/lunjian/art/fg-snow-plum.webp"
        alt=""
        draggable={false}
      />
    </div>
  );
}
