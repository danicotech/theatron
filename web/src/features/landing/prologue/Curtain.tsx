'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

import { Blossom } from '../Plum';
import { StaticPoster } from '../StaticPoster';
import type { UiState } from '../uiState';
import { useDragScrub } from '../useDragScrub';
import styles from './Curtain.module.css';
import { prologueState, STAGE_CAPTIONS, type PrologueStageId } from './stages';

/**
 * 布幕 —— 第一、二幕共用的那一塊被背光照亮的布。
 *
 * # 為什麼它不住在某一幕裡
 *
 * 規格寫死第二幕「承接第一幕的機位,**不換鏡**」:噴墨、劃破、旗落是同一個
 * 鏡頭裡繼續發生的事。但釘住的舞台只能釘在自己的 section 裡 —— 一旦第一幕的
 * section 捲過去,它的 sticky 就鬆開,布幕消失,露出已經走遠的 3D 相機。
 * (那正是先前捲到第二幕會看到一張桌子浮在黑裡的原因。)
 *
 * 所以布幕跟 3D 世界一樣是**環境層**:整塊固定在視窗上,由外面餵進來的一個
 * 進度數字決定演到哪。它不是一幕,它是那兩幕共用的那塊布。
 *
 * # 它沒有一個字
 *
 * 序幕的標題與對句是**內容**,住在 `<main>` 裡的第一幕。這一層整塊 aria-hidden ——
 * 3D 是看得到讀不到的,所以那一段戲用一行說明自己說出正在發生什麼,
 * 而那一行也不是資訊,是替代文字。
 */
export interface CurtainProps {
  /** 第一、二幕合起來的進度 0…1。旗在 1 的時候已經落下。 */
  progress: RefObject<number>;
  /** 還在布幕這兩幕裡嗎。離開之後整層卸掉 —— 看不見的 3D 沒有畫的理由。 */
  active: boolean;
  reduced: boolean;
}

/** 畫布的 DPR 上限。滿版又有一整塊 fragment,1.5 已經是這台機器願意付的極限。 */
const DPR_CAP = 1.5;

export function Curtain({ progress, active, reduced }: CurtainProps) {
  const stage = useRef<HTMLDivElement>(null);
  const visual = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  // 在畫面上拖曳 = 刮這一段。它捲頁面,不自己記一份進度(見 useDragScrub)。
  useDragScrub(visual, !reduced && active);

  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [painted, setPainted] = useState(false);
  const [act, setAct] = useState<PrologueStageId>('duel');
  const [failed, setFailed] = useState(false);

  const wantsGl = !reduced && webgl === true && !failed && active;

  /**
   * 元件自己的狀態機(uiState.ts 的七個)。
   *
   * loading 期間**不是空白**:靜態海報已經在畫面上。3D 亮起來只是把海報換掉,
   * 不是「內容終於到了」。
   */
  const state: UiState = failed
    ? 'error'
    : reduced || webgl === false
      ? 'done'
      : webgl === null || !painted
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
        const scene = createPrologueScene({
          canvas: el,
          reduced,
          width: Math.max(1, Math.round(rect.width)),
          height: Math.max(1, Math.round(rect.height)),
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
          if (document.visibilityState === 'hidden') return;
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

    if (reduced) {
      // 不想看到動的人:整段戲直接停在終點 —— 梅全開。
      for (const [k, v] of [
        ['--p', '1'],
        ['--tear', '1'],
        ['--bleed', '1'],
        ['--fall', '1'],
        ['--bloom', '1'],
      ] as const) {
        host.style.setProperty(k, v);
      }
      setAct('fall');
      return;
    }

    let raf = 0;
    let lastStage = -1;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (document.visibilityState === 'hidden') return;
      const s = prologueState(progress.current);
      host.style.setProperty('--p', s.p.toFixed(4));
      host.style.setProperty('--tear', s.tear.toFixed(4));
      host.style.setProperty('--bleed', s.bleed.toFixed(4));
      host.style.setProperty('--fall', s.fall.toFixed(4));
      host.style.setProperty('--bloom', s.blossom.toFixed(4));
      host.style.setProperty('--shudder', s.shudder.toFixed(4));
      if (s.stageIndex !== lastStage) {
        lastStage = s.stageIndex;
        setAct(s.stage);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, progress]);

  if (!active) return null;

  return (
    <div className={styles.layer} aria-hidden="true">
      <div className={styles.stage} ref={stage} data-state={state} data-act={act}>
        {/* 可以拖著刮的那一塊。 */}
        <div className={styles.visual} ref={visual}>
          {/* 世界亮起來之前海報頂著,亮了之後它讓位。任何一刻都不會是一塊黑。 */}
          {(!wantsGl || !painted) && <StaticPoster />}
          {wantsGl && (
            <canvas
              ref={canvas}
              className={[styles.canvas, painted ? styles.lit : ''].join(' ')}
              data-testid="prologue-canvas"
            />
          )}
        </div>

        {/* 枯梅接住最後一滴,梅開。 */}
        <div className={styles.plum}>
          <Blossom className={styles.bud} />
        </div>

        {/* 3D 是看得到讀不到的,所以這一段戲要自己說出正在發生什麼。
            不用 aria-live —— 刮過去會連唸四次,那是噪音不是資訊。 */}
        <p className={styles.caption}>
          <span className={styles.mark} />
          {STAGE_CAPTIONS[act]}
        </p>
      </div>
    </div>
  );
}
