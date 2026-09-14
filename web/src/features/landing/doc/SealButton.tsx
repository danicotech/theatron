'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { SealStamp } from '@theatron/ui';

import { inkVars } from '../ink';
import { acceptsActivation, type UiState } from '../uiState';
import styles from './SealButton.module.css';

/**
 * 第六章〈啟門〉的印章按鈕:按下去紅墨暈開,再沉入紙面。
 *
 * # 狀態機(uiState.ts 的七個,這裡走得到五個)
 *
 * ```
 *   idle ⇄ hover ──按下──▶ activating ──蓋完──▶ active
 *                              ▲                   │
 *                              └──── 再按一次 ─────┘
 * ```
 *
 * * **activating 期間連按:忽略。** 蓋印是一個完整的動作,中途接手會看到印章
 *   跳回半空再蓋一次 —— 那讀起來是壞掉,不是「反應快」。所以連按不排隊、
 *   不中斷、不重啟,直接丟掉。(章節轉場的規矩相反:那邊以最後一次輸入為準,
 *   因為那是「我要去哪裡」,而這是「我做了一個動作」。)
 * * **active 之後再按可以重蓋**(製作契約:Completed 可重播),但底下的面板
 *   已經開了就維持開著 —— 重播的是動作,不是結果。
 * * **loading / error 走不到**,因為這顆按鈕不等任何東西、也沒有會失敗的事。
 *   兩個狀態的樣子與規則仍然定義在 uiState.ts,哪天接上真的報名 API 就有家。
 *
 * # 為什麼是 button 而不是 a
 *
 * 它要展開的東西就在同一頁、同一段裡,那是狀態不是位置。報名網址真的有了的時候
 * 那是另一個元素(一個真的 `<a>`),不是把這顆按鈕變成連結 —— 連結要能右鍵、
 * 能新分頁,一顆會播動畫的按鈕給不了那些。
 *
 * # 沒有 JS 的時候
 *
 * 面板預設是展開的,按鈕只是一顆看得到的印。收起來的起手式綁在
 * `scripting: enabled` 上,理由與 WordReveal 那一條相同:藏東西的前提是
 * 「等一下有人會把它揭開」。
 */

/** 蓋下去到沉入紙面要多久。與 CSS 的 transition 對齊。 */
const STAMP_MS = 760;

export interface SealButtonProps {
  /** 印面上的字。 */
  text: string;
  /** 按鈕的無障礙名稱 —— 印面的字是圖,不是名字。 */
  label: string;
  /** 被它展開的那一塊。 */
  children: ReactNode;
}

export function SealButton({ text, label, children }: SealButtonProps) {
  const [state, setState] = useState<UiState>('idle');
  const [opened, setOpened] = useState(false);
  const timer = useRef(0);
  const panelId = useId();

  // 元件被收掉時把計時器一起收掉,不然它會對著已經卸載的元件 setState。
  useEffect(() => () => clearTimeout(timer.current), []);

  const press = useCallback(() => {
    setState((current) => {
      // activating 期間的點擊直接丟掉 —— 不排隊、不重啟。
      if (current === 'activating') return current;
      if (!acceptsActivation(current) && current !== 'active' && current !== 'done') return current;
      clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setState('active');
        setOpened(true);
      }, STAMP_MS);
      return 'activating';
    });
  }, []);

  // hover / focus 只在 idle 與 active 之間切,絕不會把 activating 打斷 ——
  // 蓋印蓋到一半滑鼠移開,印章不該彈回去。
  const soften = useCallback((next: 'hover' | 'idle') => {
    setState((current) => (current === 'idle' || current === 'hover' ? next : current));
  }, []);

  return (
    <div className={styles.gate}>
      <button
        type="button"
        className={styles.seal}
        data-state={state}
        data-testid="seal-button"
        aria-expanded={opened}
        aria-controls={panelId}
        onClick={press}
        onPointerEnter={() => soften('hover')}
        onPointerLeave={() => soften('idle')}
        onFocus={() => soften('hover')}
        onBlur={() => soften('idle')}
      >
        {/* 墨暈那一層。它是印章按下去的那一下,所以由同一份 ink.ts 畫,
            跟章節轉場與序幕的血墨是同一種墨。 */}
        <span
          className={styles.bloom}
          style={inkVars(state === 'activating' || state === 'active' ? 1 : 0, {
            spread: 190,
            edge: 8,
            origin: 'seal',
          })}
          aria-hidden="true"
        />
        <span className={styles.face} aria-hidden="true">
          <SealStamp text={text} />
        </span>
        <span className={styles.label}>{label}</span>
      </button>

      <div className={styles.panel} id={panelId} data-open={opened ? '' : undefined}>
        <div className={styles.panelInner}>{children}</div>
      </div>
    </div>
  );
}
