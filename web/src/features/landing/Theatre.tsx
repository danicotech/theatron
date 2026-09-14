'use client';

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';

import { ACTS, anchorOffsets, worldProgress, type ActId, type StopId } from './acts';
import styles from './Theatre.module.css';
import { ForegroundStage } from './ForegroundStage';
import { InkFilters } from './InkFilters';
import { InkWipe } from './InkWipe';
import { Reticle } from './Reticle';
import { StopRail } from './StopRail';
import { useActProgress } from './useActProgress';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { WorldScene } from './WorldScene';

/**
 * 三幕的殼 —— 觀看的地方。
 *
 * 檔名不叫 Acts:帳冊已經叫 `acts.ts`,而 Windows 的檔案系統不分大小寫,
 * 兩個只差大小寫的檔名在那裡是同一個檔。
 *
 * 由外往內是環境(0)、幕(1)、定格卡(3);再上去是導覽列與閱讀進度。
 *
 * # 狀態只有兩個,而且都是捲動位置的函式
 *
 *  · **幕內進度**(連續)—— 相機、布幕、粒子每一幀都要讀,所以存在 ref 裡。
 *    放進 React state 會讓整棵樹每幀重繪。
 *  · **停在哪個定格點**(離散)—— 整頁只變六次,而 DOM 要跟著它換,所以是 state。
 *
 * 兩個都不是「播到哪裡」。往回捲、重新整理、直接跳錨點,得到的畫面與從頭捲下來
 * 完全一樣 —— 沒有東西需要被保留,因為沒有東西是被播出來的。
 *
 * # 內容是 children
 *
 * 殼是客戶端元件(要捲動監聽與 rAF),六張卡的文字是伺服器端算的。
 * 所以關掉 JS 仍然是一頁讀得完的東西,只是沒有布景、沒有定格。
 */
/**
 * 「現在停在哪個定格點」。
 *
 * 用 context 而不是 props 往下傳:卡片的**內容**是伺服器元件算的
 * (六張卡的字加起來不小),而定格狀態只有殼知道。context 讓卡片的殼是
 * client、內容仍然是 server —— props 往下傳會逼整條路徑都變成 client。
 */
const HeldContext = createContext<StopId | null>(null);

export function useHeld(): StopId | null {
  return useContext(HeldContext);
}

export interface TheatreProps {
  /** 每一幕的舞台內容(定格卡)。鍵是幕的 id。 */
  stages: Partial<Record<ActId, ReactNode>>;
  /** 幕與幕之間、以及最後的靜態文件內容。 */
  children?: ReactNode;
  colophon: ReactNode;
  /** 定格點變化時通知外層,讓導覽軌道跟著亮。 */
  onHeld?: ((held: StopId | null) => void) | undefined;
}

export function Theatre({ stages, children, colophon, onHeld }: TheatreProps) {
  const sections = useRef<Map<ActId, HTMLElement>>(new Map());
  const reduced = usePrefersReducedMotion();
  const { state, held } = useActProgress(sections);

  // 環境層每幀讀一個數字。這裡把三幕的進度攤成那一個數字,
  // 而不是讓環境層自己認識「幕」—— 布景不需要知道敘事結構。
  const world = useRef(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      world.current = worldProgress(state.current.progress);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  useEffect(() => {
    onHeld?.(held);
  }, [held, onHeld]);

  const bind = useCallback((id: ActId) => {
    return (el: HTMLElement | null) => {
      if (el === null) sections.current.delete(id);
      else sections.current.set(id, el);
    };
  }, []);

  return (
    <HeldContext value={held}>
      {/* 濾鏡定義。整頁只掛一份,墨暈轉場、印章、海報共用。 */}
      <InkFilters />
      <WorldScene progress={world} held={held} reduced={reduced} />

      <main className={styles.doc} id="main">
        {ACTS.map((act) => (
          <section
            key={act.id}
            ref={bind(act.id)}
            id={act.anchor}
            className={styles.act}
            data-act={act.id}
            data-temperature={act.temperature}
            style={{ ['--span' as string]: `${act.span}vh` }}
            aria-label={`第${act.id === 'i' ? '一' : act.id === 'ii' ? '二' : '三'}幕 ${act.name} · ${act.subtitle}`}
          >
            {/* 錨點是零高度的標記,放在「這一張卡浮上來」的那個捲動位置。
                不能掛在卡片上 —— 卡片住在釘住的舞台裡,它的 DOM 位置永遠是幕的開頭。 */}
            {anchorOffsets(act).map((o) => (
              <span
                key={o.id}
                id={`stop-${o.id}`}
                className={styles.anchor}
                style={{
                  ['--at' as string]: `calc(${o.baseVh}vh + ${o.holdFactor} * var(--hold))`,
                }}
              />
            ))}
            {/* 舞台釘在視窗上。幕有多高,它就被釘多久。
                自己帶舞台的幕(序幕)不包 —— 再包一層 sticky 會把它的舞台裁掉。 */}
            {act.ownStage === true ? (
              stages[act.id]
            ) : (
              <div className={styles.stage}>{stages[act.id]}</div>
            )}
          </section>
        ))}
        {children}
      </main>

      {/* 幕與幕之間用墨暈交接,與第二幕的血墨是同一套語言。 */}
      <InkWipe progress={world} reduced={reduced} />
      <ForegroundStage held={held} reduced={reduced} />
      <div className={styles.colophon}>{colophon}</div>
      <StopRail held={held} />
      <Reticle />
    </HeldContext>
  );
}
