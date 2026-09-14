'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

import { ACTS, HOLD_MOBILE, type ActId, type StopId } from './acts';

/**
 * 幕內進度與定格。
 *
 * # 定格是映射曲線上的平台,不是 scroll-jack
 *
 * 每一幕是一段很高的 section,裡面釘著一個滿版舞台。捲動位置經過一條
 * **分段線性**的曲線變成幕內進度:大部分區段是斜的(捲動推進進度),
 * 定格點那幾段是平的(進度鎖住,卡片浮上)。
 *
 * 為什麼不劫持捲動:劫持之後使用者的滾輪、觸控慣性、鍵盤 PageDown、
 * 搜尋結果跳錨點、瀏覽器還原捲動位置全部要自己重做一次,而且每一項都會比
 * 原生差。平台的作法把這些全部留給瀏覽器 —— 頁面仍然只是一份很長的文件。
 *
 * # 它是位置的純函式,不是播放器
 *
 * `stateAt()` 只吃捲動位置與版面尺寸。所以往回捲、重新整理、直接跳錨點、
 * 快滑、慢滑,得到的畫面完全一樣;沒有任何東西需要「被保留」,因為沒有東西
 * 是被播出來的。規格要求的「快速捲動與反向捲動皆不得跳幀」是這個形狀的結果,
 * 不是另外做的功能。
 */
export interface StopLayout {
  id: StopId;
  /** 幕內進度(0…1)。 */
  at: number;
  /** 定格平台佔多少像素。 */
  hold: number;
}

export interface ActLayout {
  id: ActId;
  /** section 頂端在文件中的位置。 */
  top: number;
  /** section 的總高。 */
  height: number;
  stops: readonly StopLayout[];
}

export interface ActState {
  /** 每一幕的幕內進度 0…1。 */
  progress: Record<ActId, number>;
  /** 現在停在哪個定格點;沒停在任何一個就是 null。 */
  held: StopId | null;
  /** 定格平台走了多少(0…1)。卡片用它浮上與淡出。 */
  holdT: number;
}

const EMPTY: ActState = {
  progress: { i: 0, ii: 0, iii: 0 },
  held: null,
  holdT: 0,
};

/**
 * 捲動位置 → 幕內進度 + 定格。
 *
 * 純函式,所以這一段數學在 jsdom 裡驗得完,不必開瀏覽器。
 */
export function stateAt(
  scrollY: number,
  viewportH: number,
  layout: readonly ActLayout[],
): ActState {
  const progress: Record<ActId, number> = { i: 0, ii: 0, iii: 0 };
  let held: StopId | null = null;
  let holdT = 0;

  for (const act of layout) {
    // 舞台是釘住的,所以「幕走了多少」是 section 頂端捲過視窗頂端的距離,
    // 而可捲的距離是 section 高減掉一個視窗高(最後一個視窗高是舞台自己佔的)。
    const travel = Math.max(1, act.height - viewportH);
    const scrolled = clamp(scrollY - act.top, 0, travel);

    // 平台吃掉的捲動距離不推進進度,剩下的才推進。
    const holdTotal = act.stops.reduce((n, s) => n + s.hold, 0);
    const advance = Math.max(1, travel - holdTotal);

    const stops = [...act.stops].sort((a, b) => a.at - b.at);
    let cursor = 0; // 已走過的捲動距離
    let from = 0; // 已走過的進度
    let p = 1;

    for (const stop of stops) {
      const segment = (stop.at - from) * advance;
      if (scrolled < cursor + segment) {
        p = from + ((scrolled - cursor) / Math.max(1, segment)) * (stop.at - from);
        break;
      }
      cursor += segment;
      if (scrolled < cursor + stop.hold) {
        // 在平台上:進度鎖在定格點,卡片依平台走了多少浮上。
        p = stop.at;
        held = stop.id;
        holdT = (scrolled - cursor) / Math.max(1, stop.hold);
        break;
      }
      cursor += stop.hold;
      from = stop.at;
      p = 1;
    }

    if (held === null && p === 1 && stops.length > 0) {
      const last = stops[stops.length - 1]!;
      const tail = (1 - last.at) * advance;
      if (scrolled < cursor + tail) {
        p = last.at + ((scrolled - cursor) / Math.max(1, tail)) * (1 - last.at);
      }
    }

    progress[act.id] = clamp(p, 0, 1);
  }

  return { progress, held, holdT };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** 幕的高度(vh)→ 像素。手機上定格平台縮短,其餘比例不變。 */
export function measure(
  sections: ReadonlyMap<ActId, HTMLElement>,
  viewportH: number,
  narrow: boolean,
): ActLayout[] {
  return ACTS.flatMap((act) => {
    const el = sections.get(act.id);
    if (el === undefined) return [];
    return [
      {
        id: act.id,
        top: el.offsetTop,
        height: el.offsetHeight,
        stops: act.stops.map((s) => ({
          id: s.id,
          at: s.at,
          hold: ((narrow ? HOLD_MOBILE : s.hold) / 100) * viewportH,
        })),
      },
    ];
  });
}

export interface UseActProgress {
  /** 每幀讀的那一份。相機、布幕、粒子吃這個 —— 它每一幀都在變,不能是 state。 */
  state: RefObject<ActState>;
  /** 現在停在哪一個定格點。這個一輪只變六次,所以是 state,DOM 跟著它換。 */
  held: StopId | null;
}

/**
 * 把三幕的 section 量出來,並在捲動時更新。
 *
 * `state` 是 ref 而不是 state:它每一幀都在變,放進 React state 會讓整棵樹
 * 每幀重繪。`held` 反過來 —— 整頁只變六次,而 DOM 要跟著它換,所以是 state。
 */
export function useActProgress(sections: RefObject<Map<ActId, HTMLElement>>): UseActProgress {
  const state = useRef<ActState>(EMPTY);
  const [held, setHeld] = useState<StopId | null>(null);

  useEffect(() => {
    let layout: ActLayout[] = [];
    let raf = 0;

    const remeasure = () => {
      const map = sections.current;
      if (map === null) return;
      layout = measure(map, window.innerHeight, window.innerWidth <= 600);
      read();
    };

    const read = () => {
      const next = stateAt(window.scrollY, window.innerHeight, layout);
      state.current = next;
      setHeld((prev) => (prev === next.held ? prev : next.held));
    };

    const onScroll = () => {
      if (raf !== 0) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        read();
      });
    };

    remeasure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', remeasure);

    // 版面高度會因為字體載入、圖片載入而變。ResizeObserver 是唯一可靠的訊號,
    // 但 jsdom 沒有它 —— 測試環境缺一個瀏覽器 API 不該讓整個掛載炸掉。
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(remeasure);
      const map = sections.current;
      if (map !== null) for (const el of map.values()) ro.observe(el);
    }

    return () => {
      if (raf !== 0) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', remeasure);
      ro?.disconnect();
    };
  }, [sections]);

  return { state, held };
}
