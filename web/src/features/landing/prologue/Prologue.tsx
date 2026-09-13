'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Blossom } from '../Plum';
import { StaticPoster } from '../StaticPoster';
import type { UiState } from '../uiState';
import { usePrefersReducedMotion } from '../usePrefersReducedMotion';
import { useDragScrub } from '../useDragScrub';
import { useScrubProgress } from '../useScrubProgress';
import styles from './Prologue.module.css';
import { prologueState, STAGE_CAPTIONS, type PrologueStageId } from './stages';

/**
 * 第一章〈殘旗〉—— 被捲動刮過去的四段戲。
 *
 * 三件事決定了它長成這樣:
 *
 *  1. **規格要的十二段影片不存在**(notes/2026-09-13-劍塚-素材缺口.md)。所以布幕、
 *     裂口、血墨、梅開全部是 3D 與 shader。這不是降規格 —— 影片刮不回去,而這個刮得回去。
 *  2. **狀態只有一個數字。** 章節做得比一屏高,裡面釘一個 100svh 的舞台,進度就是
 *     「捲過去多少 / 可捲距離」。往回捲不是倒帶,是同一個純函式吃到比較小的數字。
 *  3. **3D 不承載資訊。** 標題、副標、那四句說明全部是這一層的語意化 HTML;
 *     畫布只是背景。關掉 WebGL、或不想看到動的人,看到的是同一份字加一張靜態海報。
 *
 * 每格更新的東西全部寫成 CSS 變數直接掛在 DOM 上,不經過 React:一行標題
 * 每秒重繪六十次是沒有必要的,而 `--rv-scrub` 這種數字 CSS 自己算得完。
 * 會觸發重繪的只有「現在是第幾段」——那是離散的,一整段戲只變三次。
 */

export interface PrologueProps {
  /** 標題與副標。由伺服器元件傳進來,所以關掉 JS 一樣讀得到。 */
  children: ReactNode;
  /** 這一章由誰命名 —— 傳給 section 的 aria-labelledby。 */
  titleId: string;
}

/** 畫布的 DPR 上限。序幕滿版又有一整塊 fragment,1.5 已經是這台機器願意付的極限。 */
const DPR_CAP = 1.5;

export function Prologue({ children, titleId }: PrologueProps) {
  // 偏好自己讀:呼叫端是伺服器元件,它讀不到瀏覽器的偏好。
  const reduced = usePrefersReducedMotion();
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const visual = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { progress, inView, measured } = useScrubProgress(section);

  // 在畫面上拖曳 = 刮這一段。它捲頁面,不自己記一份進度(見 useDragScrub)。
  useDragScrub(visual, !reduced);

  // 「舞台在不在畫面上」放進 ref 給兩個 rAF 迴圈讀。
  // 用 state 的話每次捲進捲出都會重建整個 3D 場 —— 那比多畫幾格貴得多。
  const onScreen = useRef(false);
  useEffect(() => {
    onScreen.current = inView;
  }, [inView]);

  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [painted, setPainted] = useState(false);
  const [act, setAct] = useState<PrologueStageId>('duel');
  const [failed, setFailed] = useState(false);

  const wantsGl = !reduced && webgl === true && !failed;

  /**
   * 元件自己的狀態機(uiState.ts 的七個)。
   *
   * loading 期間**不是空白**:靜態海報已經在畫面上,而且它帶著全部的字。
   * 3D 亮起來只是把海報換掉,不是「內容終於到了」。
   */
  const state: UiState = failed
    ? 'error'
    : reduced || webgl === false
      ? 'done'
      : webgl === null || !measured || !painted
        ? 'loading'
        : 'active';

  useEffect(() => {
    if (reduced) {
      setWebgl(false);
      return;
    }
    let alive = true;
    // webgl 探測單獨一個模組,而且它不 import three —— 它是決定「要不要載 three」
    // 的那個判斷,自己把 three 拉進來就沒有東西可以省了。
    void import('../../world3d/webgl').then(({ hasWebGL }) => {
      if (alive) setWebgl(hasWebGL());
    });
    return () => {
      alive = false;
    };
  }, [reduced]);

  // ── 3D 場。只有在真的要用的時候才把 three 載進來。
  useEffect(() => {
    if (!wantsGl) return;
    const el = canvas.current;
    const host = stage.current;
    if (el === null || host === null) return;

    let alive = true;
    let stop: (() => void) | undefined;

    void import('./prologueScene')
      .then(({ createPrologueScene }) => {
        if (!alive) return;
        const rect = host.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));

        const scene = createPrologueScene({
          canvas: el,
          reduced,
          width,
          height,
          pixelRatio: Math.min(window.devicePixelRatio || 1, DPR_CAP),
        });

        let raf = 0;
        let last = performance.now();
        let first = true;

        const onResize = () => {
          const r = host.getBoundingClientRect();
          scene.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)));
        };
        const onVisibility = () => {
          // 切回來時 now − last 可能是好幾秒。不重設的話袖擺的阻尼會一次跳到終點。
          last = performance.now();
        };

        const loop = () => {
          raf = requestAnimationFrame(loop);
          const now = performance.now();
          const dt = Math.min((now - last) / 1000, 1 / 20);
          last = now;
          // 分頁在背景、或舞台捲出畫面,就不畫。看不見的東西沒有畫的理由,而且省電。
          if (document.visibilityState === 'hidden' || !onScreen.current) return;
          scene.setProgress(progress.current);
          // 時鐘用 performance.now 而不是累加 dt:環境層的竹林也是用它推風場的,
          // 兩邊對同一個時鐘才會吹同一陣風。累加會漂,漂了就各吹各的。
          scene.frame(dt, now / 1000);
          if (first) {
            first = false;
            setPainted(true);
          }
        };

        raf = requestAnimationFrame(loop);
        window.addEventListener('resize', onResize);
        document.addEventListener('visibilitychange', onVisibility);

        stop = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener('resize', onResize);
          document.removeEventListener('visibilitychange', onVisibility);
          scene.dispose();
        };
      })
      .catch(() => {
        // 載不進來或建不起場就退回海報。一塊黑畫布比沒有 3D 糟得多。
        if (alive) setFailed(true);
      });

    return () => {
      alive = false;
      stop?.();
      setPainted(false);
    };
  }, [wantsGl, reduced, progress]);

  // ── DOM 那一層的每格更新。只寫 CSS 變數,不重繪 React 樹。
  useEffect(() => {
    const host = stage.current;
    if (host === null) return;
    const title = host.querySelector<HTMLElement>('[data-rv-scrub]');

    if (reduced) {
      // 不想看到動的人:整段戲直接停在終點 —— 字全部在、梅全開。
      host.style.setProperty('--p', '1');
      host.style.setProperty('--tear', '1');
      host.style.setProperty('--bleed', '1');
      host.style.setProperty('--fall', '1');
      host.style.setProperty('--bloom', '1');
      title?.style.setProperty('--rv-scrub', '1');
      setAct('fall');
      return;
    }

    let raf = 0;
    let lastStage = -1;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (document.visibilityState === 'hidden' || !onScreen.current) return;
      const s = prologueState(progress.current);
      host.style.setProperty('--p', s.p.toFixed(4));
      host.style.setProperty('--tear', s.tear.toFixed(4));
      host.style.setProperty('--bleed', s.bleed.toFixed(4));
      host.style.setProperty('--fall', s.fall.toFixed(4));
      host.style.setProperty('--bloom', s.blossom.toFixed(4));
      host.style.setProperty('--shudder', s.shudder.toFixed(4));
      title?.style.setProperty('--rv-scrub', s.title.toFixed(4));
      if (s.stageIndex !== lastStage) {
        lastStage = s.stageIndex;
        setAct(s.stage);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, progress]);

  return (
    <section
      className={styles.chapter}
      id="chapter-01"
      data-chapter-section="01"
      aria-labelledby={titleId}
      ref={section}
    >
      <div className={styles.stage} ref={stage} data-state={state} data-act={act}>
        {/* 可以拖著刮的那一塊。只有畫面,沒有字 —— 掛在整段上會吃掉文字選取。 */}
        <div className={styles.visual} ref={visual}>
          {/* 世界亮起來之前海報頂著,亮了之後它讓位。任何一刻都不會是一塊黑。 */}
          {(!wantsGl || !painted) && <StaticPoster />}
          {wantsGl && (
            <canvas
              ref={canvas}
              className={[styles.canvas, painted ? styles.lit : ''].join(' ')}
              aria-hidden="true"
              data-testid="prologue-canvas"
            />
          )}
        </div>

        <div className={styles.type}>{children}</div>

        {/* 枯梅接住最後一滴,梅開。它在前景、在字的外側,所以不會壓到任何一行。 */}
        <div className={styles.plum} aria-hidden="true">
          <Blossom className={styles.bud} />
        </div>

        {/* 3D 是看得到讀不到的,所以這一段戲要自己說出正在發生什麼。
            不用 aria-live —— 刮過去會連唸四次,那是噪音不是資訊。 */}
        <p className={styles.caption}>
          <span className={styles.mark} aria-hidden="true" />
          {STAGE_CAPTIONS[act]}
        </p>
      </div>
    </section>
  );
}
