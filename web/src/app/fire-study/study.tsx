'use client';
import { useEffect, useRef, useState } from 'react';
import {
  createFireStudy,
  FIRE_STYLES,
  type FireStudyController,
  type FireStyle,
} from '../../features/chrome/fireStudyRenderer';
import styles from './study.module.css';

function Sample({
  variant,
  register,
  selected,
  choose,
}: {
  variant: FireStyle;
  register: (id: string, value: FireStudyController | null) => void;
  selected: boolean;
  choose: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<FireStudyController | null>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const lifetime = new AbortController();
    if (!canvas.current) return;
    void createFireStudy(canvas.current, variant, setProgress, lifetime.signal)
      .then((instance) => {
        if (cancelled) {
          instance.dispose();
          return;
        }
        controller.current = instance;
        register(variant.id, instance);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      lifetime.abort();
      controller.current?.dispose();
      controller.current = null;
      register(variant.id, null);
    };
  }, [variant, register]);
  return (
    <article className={styles.sample} id={`variant-${variant.id}`} data-selected={selected}>
      <div className={styles.sampleTitle}>
        <h2>
          <span>{variant.id}</span>
          {variant.title}
        </h2>
        <button data-ink-wave="off" aria-pressed={selected} onClick={choose}>
          {selected ? '已選這款' : '選這款'}
        </button>
      </div>
      <p>{variant.detail}</p>
      <button
        className={styles.stage}
        data-ink-wave="off"
        disabled={!ready}
        aria-label={`點燃 ${variant.id} ${variant.title}`}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          controller.current?.play(
            event.detail ? (event.clientX - rect.left) / rect.width : 0.5,
            event.detail ? (event.clientY - rect.top) / rect.height : 0.67,
          );
        }}
      >
        <span className={styles.reveal}>
          百業試鋒<small>夜鴉閣</small>
        </span>
        <canvas ref={canvas} aria-hidden="true" />
        {progress === 0 && (
          <span className={styles.prompt}>
            {error ? '無法啟用繪圖，請重新載入' : ready ? '點畫面任一處起火' : '準備試映…'}
          </span>
        )}
      </button>
      <div className={styles.localControls}>
        <button data-ink-wave="off" disabled={!ready} onClick={() => controller.current?.play()}>
          重播 {variant.id}
        </button>
        <button data-ink-wave="off" disabled={!ready} onClick={() => controller.current?.pause()}>
          暫停
        </button>
        <button data-ink-wave="off" disabled={!ready} onClick={() => controller.current?.resume()}>
          繼續
        </button>
        <label>
          進度
          <input
            aria-label={`${variant.id} 燃燒進度`}
            type="range"
            min="0"
            max="1"
            step=".001"
            value={progress}
            disabled={!ready}
            onInput={(e) => controller.current?.seek(Number(e.currentTarget.value))}
          />
        </label>
      </div>
    </article>
  );
}

export default function FireStudy() {
  const engines = useRef(new Map<string, FireStudyController>());
  const [chosen, setChosen] = useState<string | null>(null);
  const [rate, setRate] = useState('1');
  const [held, setHeld] = useState(false);
  const register = useRef((id: string, value: FireStudyController | null) => {
    if (value) engines.current.set(id, value);
    else engines.current.delete(id);
  }).current;
  return (
    <main id="main" className={styles.study}>
      <header>
        <p className={styles.eyebrow}>夜鴉閣 ／ 燃燒試映</p>
        <h1>讓火焰自己說話。</h1>
        <p>四款火舌與煙灰，點畫面任一處起火。可以慢放、暫停，並拖曳進度比較。</p>
      </header>
      <div className={styles.toolbar}>
        <button data-ink-wave="off" onClick={() => engines.current.forEach((e) => e.play())}>
          一起點燃 ↗
        </button>
        <button data-ink-wave="off" onClick={() => engines.current.forEach((e) => e.pause())}>
          全部暫停
        </button>
        <button data-ink-wave="off" onClick={() => engines.current.forEach((e) => e.resume())}>
          全部繼續
        </button>
        <label>
          速度{' '}
          <select
            value={rate}
            onChange={(e) => {
              setRate(e.target.value);
              engines.current.forEach((v) => v.speed(Number(e.target.value)));
            }}
          >
            <option value=".5">0.5× 慢放</option>
            <option value="1">1× 正常</option>
            <option value="1.5">1.5× 加速</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={held}
            onChange={(e) => {
              setHeld(e.target.checked);
              engines.current.forEach((v) => v.hold(e.target.checked));
            }}
          />
          停在半燃，觀察火舌
        </label>
        <button data-ink-wave="off" onClick={() => engines.current.forEach((e) => e.reset())}>
          全部復原
        </button>
      </div>
      <div className={styles.selection} role="status">
        {chosen
          ? `目前偏好 ${chosen} · ${FIRE_STYLES.find((v) => v.id === chosen)?.title}，也可以告訴我想混合哪兩款。`
          : '先選你喜歡的火焰形態；這頁的選擇不會變更正式開場。'}
      </div>
      <div className={styles.grid}>
        {FIRE_STYLES.map((variant) => (
          <Sample
            key={variant.id}
            variant={variant}
            register={register}
            selected={chosen === variant.id}
            choose={() => setChosen(variant.id)}
          />
        ))}
      </div>
      <footer>
        <p>沒有自動播放。若使用減少動態設定，可以直接拖曳進度觀看靜態畫面。</p>
        <p>
          參考{' '}
          <a
            href="https://www.pexels.com/video/close-up-video-of-a-paper-burning-10229380/"
            target="_blank"
            rel="noreferrer"
          >
            紙張燃燒實拍
          </a>{' '}
          與{' '}
          <a
            href="https://threejs.org/examples/webgpu_volume_fire.html"
            target="_blank"
            rel="noreferrer"
          >
            Three.js 體積火焰
          </a>{' '}
          的流動特徵。此處是即時視覺近似。
        </p>
      </footer>
    </main>
  );
}
