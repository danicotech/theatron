'use client';
/* Pre-generated artwork is shared across layers; no scene engine is loaded. */

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { openingTimeline, OPENINGS, type OpeningId } from './motion';
import styles from './study.module.css';
import { EditorialCover } from './editorial';
import { WireScene, WirePortalOutline } from './wireframe';

const GATE = '/lunjian/art/bg/scene-gate.webp';
function Cover({ id }: { id: OpeningId }) {
  if (id === 'F' || id === 'G' || id === 'H' || id === 'I' || id === 'J')
    return <EditorialCover id={id} />;
  if (id === 'A')
    return (
      <div className={styles.cover} data-cover>
        <div className={styles.mistBase} data-mist-base />
        <div className={styles.mistTop} data-mist-top />
        <div className={styles.mistBottom} data-mist-bottom />
      </div>
    );
  if (id === 'B')
    return (
      <div className={styles.cover} data-cover>
        <div className={styles.paperLeft} data-paper-left>
          <span>山門之外</span>
        </div>
        <div className={styles.paperRight} data-paper-right>
          <span>江湖之中</span>
        </div>
      </div>
    );
  if (id === 'C')
    return (
      <div className={`${styles.cover} ${styles.negative}`} data-cover data-negative>
        <img src={GATE} alt="" draggable={false} />
        <div className={styles.negativeTint} />
      </div>
    );
  if (id === 'D')
    return (
      <div className={`${styles.cover} ${styles.refraction}`} data-cover data-refracted-scene>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={styles.refractionPane}
            data-refraction
            style={{ left: `${(i * 100) / 3}%` }}
          >
            <img src={GATE} alt="" draggable={false} style={{ left: `${-i * 100}%` }} />
          </div>
        ))}
        <div className={styles.refractionVeil} data-refraction-veil />
        <i className={styles.seamOne} data-refraction-seam />
        <i className={styles.seamTwo} data-refraction-seam />
      </div>
    );
  return (
    <div className={`${styles.cover} ${styles.inkSheet}`} data-cover data-ink-sheet>
      <i className={styles.redLine} data-red-line />
    </div>
  );
}

export default function OpeningStudy() {
  const [id, setId] = useState<OpeningId>('I');
  const [stageSize, setStageSize] = useState(0);
  const [favorite, setFavorite] = useState<OpeningId | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [speed, setSpeed] = useState(1);
  const stage = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const slider = useRef<HTMLInputElement>(null);
  const percent = useRef<HTMLOutputElement>(null);
  const speedRef = useRef(1);
  const autoplay = useRef(false);
  const variant = OPENINGS.find((item) => item.id === id)!;
  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    let width = root.clientWidth,
      height = root.clientHeight;
    const observer = new ResizeObserver(() => {
      if (root.clientWidth === width && root.clientHeight === height) return;
      width = root.clientWidth;
      height = root.clientHeight;
      setStageSize((value) => value + 1);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const requested = location.hash.slice(1).toUpperCase();
    if (OPENINGS.some((item) => item.id === requested)) setId(requested as OpeningId);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const syncReduced = () => setReduced(media.matches);
    syncReduced();
    media.addEventListener('change', syncReduced);
    return () => media.removeEventListener('change', syncReduced);
  }, []);
  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    let disposed = false;
    setReady(false);
    setPlaying(false);
    let tl: gsap.core.Timeline;
    const context = gsap.context(() => {
      tl = openingTimeline(
        root,
        id,
        reduced,
        () => {
          const value = Math.round(tl.progress() * 100);
          if (slider.current) slider.current.value = String(value);
          if (percent.current) percent.current.textContent = `${value}%`;
        },
        () => {
          root.dataset.phase = 'complete';
          setPlaying(false);
        },
      );
      timeline.current = tl;
      tl.timeScale(speedRef.current);
    }, root);
    root.dataset.phase = 'ready';
    if (slider.current) slider.current.value = '0';
    if (percent.current) percent.current.textContent = '0%';
    void Promise.allSettled(
      [...root.querySelectorAll('img')].map((image) => image.decode?.()),
    ).then(() => {
      if (disposed) return;
      setReady(true);
      if (autoplay.current) {
        autoplay.current = false;
        root.dataset.phase = 'playing';
        setPlaying(true);
        tl.restart();
      }
    });
    const pause = () => {
      if (document.hidden) {
        tl.pause();
        setPlaying(false);
      }
    };
    document.addEventListener('visibilitychange', pause);
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          tl.pause();
          setPlaying(false);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(root);
    return () => {
      disposed = true;
      observer.disconnect();
      context.revert();
      timeline.current = null;
      document.removeEventListener('visibilitychange', pause);
    };
  }, [id, reduced, stageSize]);
  const play = () => {
    if (!ready) return;
    setPlaying(true);
    if (stage.current) stage.current.dataset.phase = 'playing';
    timeline.current?.restart();
  };
  const choose = (next: OpeningId) => {
    if (next === id) {
      play();
      return;
    }
    autoplay.current = true;
    setId(next);
    history.replaceState(null, '', `${location.pathname}${location.search}#${next}`);
  };
  return (
    <main className={styles.study}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>夜鴉閣 ／ 2D 過場試映</p>
          <h1>入境之前</h1>
        </div>
        <p>
          從一張主圖，編成江湖刊首。
          <br />I 已貼入獨立背景、透明人物與前景，可檢查黑白對視和完整轉場。
        </p>
      </header>
      <div className={styles.workbench}>
        <section className={styles.player} aria-label="過場預覽">
          <div className={styles.stage} data-variant={id} ref={stage}>
            <div className={styles.destination} aria-hidden="true">
              {id === 'I' ? (
                <WireScene />
              ) : (
                <>
                  <img className={styles.gate} src={GATE} alt="" draggable={false} />
                  <div className={styles.sceneShade} />
                </>
              )}
              <div className={styles.homeCopy} data-home-copy>
                <small>夜 鴉 閣</small>
                <strong>百業試鋒</strong>
                <div>
                  <span>了解賽制 ↗</span>
                  <span>提筆報名 ↗</span>
                </div>
              </div>
            </div>
            <div key={id} aria-hidden="true">
              <Cover id={id} />
              {!['F', 'G', 'H', 'I', 'J'].includes(id) && (
                <div className={styles.introCopy} data-intro-copy>
                  {id === 'E' ? (
                    <span className={styles.seal} data-seal>
                      入
                    </span>
                  ) : (
                    <span className={styles.moon} />
                  )}
                  <p>
                    赴一場
                    <br />
                    月下之約
                  </p>
                  <small>夜鴉閣 · 百業試鋒</small>
                </div>
              )}
              {id !== 'I' && (
                <span className={styles.enterPrompt} data-enter-prompt>
                  點擊入境 <span>↗</span>
                </span>
              )}
              <div className={styles.portal} data-portal>
                <div className={styles.portalImage} data-portal-image>
                  {id === 'I' ? (
                    <WireScene />
                  ) : (
                    <>
                      <img className={styles.gate} src={GATE} alt="" draggable={false} />
                      <div className={styles.sceneShade} />
                    </>
                  )}
                </div>
              </div>
              {id === 'I' && <WirePortalOutline />}
            </div>
            <button
              className={styles.hit}
              data-ink-wave="off"
              disabled={!ready}
              onClick={play}
              aria-label={`播放 ${id} ${variant.name}`}
            />
            <span className={styles.previewLabel}>
              {ready ? `${id} ／ ${variant.name}` : '準備畫面…'}
            </span>
          </div>
          <div className={styles.transport}>
            <button data-ink-wave="off" onClick={play} disabled={!ready}>
              重播 ↻
            </button>
            <button
              data-ink-wave="off"
              disabled={!ready}
              onClick={() => {
                if (playing) {
                  timeline.current?.pause();
                  setPlaying(false);
                } else {
                  if (timeline.current?.progress() === 1) play();
                  else {
                    timeline.current?.resume();
                    setPlaying(true);
                  }
                }
              }}
            >
              {playing ? '暫停' : '繼續'}
            </button>
            <label>
              速度
              <select
                value={speed}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setSpeed(value);
                  speedRef.current = value;
                  timeline.current?.timeScale(value);
                }}
              >
                <option value={0.5}>慢放 0.5×</option>
                <option value={1}>正常 1×</option>
                <option value={1.5}>快速 1.5×</option>
              </select>
            </label>
            <span className={styles.duration}>{variant.duration.toFixed(1)} 秒</span>
          </div>
          <label className={styles.progress}>
            進度
            <input
              ref={slider}
              type="range"
              min="0"
              max="100"
              defaultValue="0"
              disabled={!ready}
              aria-label="過場進度"
              onInput={(event) => {
                const value = event.currentTarget.value;
                timeline.current?.progress(Number(value) / 100).pause();
                if (percent.current) percent.current.textContent = `${value}%`;
                setPlaying(false);
              }}
            />
            <output ref={percent} aria-live="off">
              0%
            </output>
          </label>
          <div className={styles.caption}>
            <div>
              <h2>{variant.name}</h2>
              <p>{variant.summary}</p>
            </div>
            <button
              data-ink-wave="off"
              aria-pressed={favorite === id}
              onClick={() => setFavorite(id)}
            >
              {favorite === id ? '已暫選這款' : '暫選這款'} <span>↗</span>
            </button>
          </div>
          <p className={styles.preference} role="status">
            {favorite
              ? `暫選 ${favorite} · ${OPENINGS.find((item) => item.id === favorite)!.name}。正式開場尚未更換。`
              : '先試看，再決定；也可以挑兩款混合。'}
          </p>
        </section>
        <aside className={styles.options} aria-label="十款過場">
          <div className={styles.choiceList}>
            {OPENINGS.map((item) => (
              <button
                key={item.id}
                data-ink-wave="off"
                aria-pressed={id === item.id}
                onClick={() => choose(item.id)}
                className={styles.option}
              >
                <span className={styles.optionCode}>{item.id}</span>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.mood}</small>
                </span>
                <span className={styles.optionArrow}>↗</span>
              </button>
            ))}
          </div>
          <div className={styles.rationale}>
            <p className={styles.eyebrow}>這款的設計考量</p>
            <dl>
              <dt>色彩關係</dt>
              <dd>{variant.color}</dd>
              <dt>視線與空間</dt>
              <dd>{variant.eye}</dd>
            </dl>
            <p>{variant.intent}</p>
          </div>
        </aside>
      </div>
      <footer className={styles.footer}>
        <p>
          本頁只比較 2D 候選過場。「點擊入境」取代點燃文案；3D 仍保留立體布幕與燃燒。
          {reduced && '目前依裝置偏好使用淡入淡出。'}
        </p>
        <details>
          <summary>設計參考與使用方式</summary>
          <p>
            情緒描述是本次設計方向，不是對所有人的心理效果保證。色彩的感受會受到情境與文化影響；參考{' '}
            <a
              href="https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2015.00368/full"
              target="_blank"
              rel="noreferrer"
            >
              Elliot 的色彩心理學回顧
            </a>
            。錯視方向參考{' '}
            <a href="https://www.moma.org/collection/terms/op-art" target="_blank" rel="noreferrer">
              MoMA 的 Op art 館藏
            </a>
            ，以低強度錯位處理，不使用閃爍。
          </p>
          <p>
            F～J 將你提供的封面參考轉為人物、局部裁切與大字編排，另參考{' '}
            <a
              href="https://www.dazeddigital.com/fashion/article/65725/1/from-drew-starkey-to-central-cee-this-was-2024-in-dazed-covers"
              target="_blank"
              rel="noreferrer"
            >
              Dazed 封面系列
            </a>
            的圖文層次，以及{' '}
            <a
              href="https://www.jdnco.com/project/surface-magazine/"
              target="_blank"
              rel="noreferrer"
            >
              Surface 刊頭設計
            </a>
            的裁字與比例。I
            使用本次分層生成的背景、人物與前景，其餘試映沿用本站武俠素材，沒有使用雜誌攝影作品。
          </p>
          <p>選擇只留在此頁。可以直接回覆 A～J，或指定喜歡的片段組合。</p>
        </details>
      </footer>
    </main>
  );
}
