'use client';

import { useRef, type ReactNode } from 'react';

import { SCENE } from './chapters';
import { ChapterRail } from './ChapterRail';
import { ForegroundStage } from './ForegroundStage';
import styles from './Landing.module.css';
import { WorldScene } from './WorldScene';
import { useActiveChapter } from './useActiveChapter';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { useReveals } from './useReveals';

export interface LandingProps {
  /** 章節本體。內容留在 page.tsx —— 那些句子是使用者寫的,不該住在殼裡。 */
  children: ReactNode;
  /**
   * 版權頁。它是唯一站在近景**前面**的東西,所以不能待在 children 裡:
   * <main> 整棵樹被封在 z-index 1,裡面的元素再怎麼排也蓋不過近景。
   * 而版權頁永遠在文件最底,近景也永遠釘在視窗底 —— 兩個一定會撞上,
   * 撞上時該讓路的是布景。走出山門之後,頁面就該結束了。
   */
  colophon: ReactNode;
}

/**
 * 首頁的殼:三層固定圖層 + 一份會捲的文件。
 *
 * 由外往內是場景(0)、文件(1)、近景(3)、章節軌道(45);再上去是別人的
 * 導覽列(50)與底片(55/60)。整個章節體驗的狀態只有一個 —— 現在是哪一章 ——
 * 由 useActiveChapter 從 section 的露出比例算出來,其餘全部是它的函數。
 *
 * 內容是 children:殼是客戶端元件(要觀察器與 rAF),章節本文是伺服器端算的,
 * 所以關掉 JS 仍然是一頁讀得完的東西,只是沒有場景、沒有出場動態。
 */
export function Landing({ children, colophon }: LandingProps) {
  const doc = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const active = useActiveChapter(doc);

  useReveals(doc, reduced);

  return (
    <>
      <WorldScene plates={SCENE} active={active} reduced={reduced} doc={doc} />
      <main className={styles.doc} id="main" ref={doc}>
        {children}
      </main>
      <ForegroundStage active={active} reduced={reduced} />
      <div className={styles.colophon}>{colophon}</div>
      <ChapterRail active={active} />
    </>
  );
}
