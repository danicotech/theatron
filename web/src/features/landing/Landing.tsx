'use client';

import { useRef, type ReactNode } from 'react';

import { ChapterRail } from './ChapterRail';
import { ForegroundStage } from './ForegroundStage';
import { InkFilters } from './InkFilters';
import { InkWipe } from './InkWipe';
import styles from './Landing.module.css';
import { Reticle } from './Reticle';
import { useActiveChapter } from './useActiveChapter';
import { useChapterProgress } from './useChapterProgress';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { useReveals } from './useReveals';
import { WorldScene } from './WorldScene';

export interface LandingProps {
  /** 七章本體。內容留在 page.tsx —— 那些句子是內容,不該住在殼裡。 */
  children: ReactNode;
  /**
   * 落款。它是唯一站在近景**前面**的東西,所以不能待在 children 裡:
   * <main> 整棵樹被封在 z-index 1,裡面的元素再怎麼排也蓋不過近景。
   * 而落款永遠在文件最底,近景也永遠釘在視窗底 —— 兩個一定會撞上,
   * 撞上時該讓路的是布景。走出木門之後,頁面就該結束了。
   */
  colophon: ReactNode;
}

/**
 * 首頁的殼:幾層固定圖層 + 一份會捲的文件。
 *
 * 由外往內是環境(0)、文件(1)、墨暈轉場(2)、近景(3);再上去是別人的
 * 導覽列(50)、準心(52)與底片(55/60)。
 *
 * 狀態只有兩個,而且都是捲動位置的函式:
 *   - **現在是哪一章**(離散)—— 近景與章節軌道要的答案,用觀察器最省。
 *   - **連續進度**(0…6)—— 相機與墨暈轉場要的答案,存在 ref 裡每格讀。
 * 兩個都不是「播到哪裡」,所以往回捲、重新整理、直接跳錨點,得到的畫面
 * 與從頭捲下來完全一樣。「回到前一章保留進度」就是這件事的結果,不是另外
 * 做的功能 —— 沒有東西需要被保留,因為沒有東西是被播出來的。
 *
 * 內容是 children:殼是客戶端元件(要觀察器與 rAF),章節本文是伺服器端算的,
 * 所以關掉 JS 仍然是一頁讀得完的東西,只是沒有布景、沒有出場動態。
 */
export function Landing({ children, colophon }: LandingProps) {
  const doc = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const active = useActiveChapter(doc);
  const progress = useChapterProgress(doc);

  useReveals(doc, reduced);

  return (
    <>
      {/* 濾鏡定義。整頁只掛一份,墨暈轉場、印章、海報共用。 */}
      <InkFilters />
      <WorldScene progress={progress} active={active} reduced={reduced} />
      <main className={styles.doc} id="main" ref={doc}>
        {children}
      </main>
      <InkWipe progress={progress} reduced={reduced} />
      <ForegroundStage active={active} reduced={reduced} />
      <div className={styles.colophon}>{colophon}</div>
      <ChapterRail active={active} />
      <Reticle />
    </>
  );
}
