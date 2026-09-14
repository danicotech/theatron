'use client';

import { InkTitle, PaperCard, SealStamp, type PaperCardProps } from '@theatron/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { useHeld } from './Theatre';
import type { Stop } from './acts';
import styles from './StopCard.module.css';
import { worldAsset } from './world';

/**
 * 定格點上浮起來的那張紙。
 *
 * # 它為什麼不是一直在那裡
 *
 * 幕是舞台,卡片是「鏡頭停下來的時候,有人把一張告示遞到你面前」。
 * 一直掛著的話,整頁就只是一份加了背景動畫的傳單 —— 定格才是這個設計裡
 * 唯一一個「請你現在讀」的訊號。
 *
 * # 絕不遮住畫面主體
 *
 * 規格寫死:卡片不能壓在旗的裂口、劍、月上面。所以卡片永遠偏在畫面的三分之一側,
 * 而且最寬 38vw —— 六張輪流靠左靠右(錯位排布),不是每張都置中。
 * 手機上沒有「側邊」可言,改成從畫面底部浮上來的單欄。
 *
 * # 它對輔助科技永遠是可讀的
 *
 * 只有視覺上被藏起來。六張卡裝著這一頁的全部比賽資訊,而任何時刻只有一張
 * 是定格的 —— 用 `aria-hidden` 藏起其餘五張,螢幕閱讀器使用者就什麼都讀不到了。
 *
 * # 進場是一次,不是每次捲過去都重來
 *
 * 讀到一半往回捲一點點又捲回來,卡片不該重新淡入一次 —— 那會讓人以為
 * 自己弄丟了什麼。所以進場動畫只在第一次定格時放,之後只有顯示與隱藏。
 */
export interface StopCardProps {
  stop: Stop;
  /** 卡片偏在哪一側。錯位排布由頁面決定,不是卡片自己猜。 */
  side: 'left' | 'right' | 'centre';
  /** 紙上的大標。 */
  title: ReactNode;
  subtitle?: string | undefined;
  rows?: PaperCardProps['rows'];
  note?: ReactNode | undefined;
  action?: ReactNode | undefined;
  /** 印面上的字。沒有就不蓋印 —— 不是每一張告示都用印。 */
  seal?: string | undefined;
  children?: ReactNode | undefined;
}

export function StopCard({
  stop,
  side,
  title,
  subtitle,
  rows,
  note,
  action,
  seal,
  children,
}: StopCardProps) {
  const held = useHeld() === stop.id;

  // 進場只放一次。`useRef` 而不是 state:它只會從 false 變 true 一次,
  // 而且變的時候不需要重繪 —— 重繪是 held 帶來的。
  const seen = useRef(false);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (held && !seen.current) {
      seen.current = true;
      setEntered(true);
    }
  }, [held]);

  const mark = stop.mark;

  return (
    <div
      className={[
        styles.slot,
        styles[side],
        held ? styles.held : '',
        entered ? styles.seen : '',
      ].join(' ')}
      // 刻意**不**用 inert / aria-hidden。
      //
      // 六張卡在任何時刻只有一張是定格的,所以初次渲染時六張全部「沒定格」——
      // 把它們都標成隱藏,等於螢幕閱讀器使用者一個字都讀不到,而這一頁的
      // 全部比賽資訊就在那六張卡上。
      //
      // 改成只藏視覺:opacity 0 的內容仍然會被朗讀,而 pointer-events: none
      // 擋掉滑鼠誤點。鍵盤走進來時 :focus-within 會把卡片顯示出來,
      // 所以「看得見的才點得到」與「讀得到全部內容」兩件事同時成立。
    >
      <PaperCard
        kicker={
          mark === undefined ? (
            stop.kicker
          ) : (
            <span className={styles.kicker}>
              <InkTitle {...inkProps(mark)} on="paper" />
              <span className={styles.kickerText}>{stop.kicker}</span>
            </span>
          )
        }
        index={stop.index}
        title={title}
        subtitle={subtitle}
        headingLevel={2}
        rows={rows}
        note={note}
        action={action}
        tilt={side === 'left' ? 'left' : side === 'right' ? 'right' : 'none'}
        stamp={seal === undefined ? undefined : <SealStamp text={seal} />}
      >
        {children}
      </PaperCard>
    </div>
  );
}

/**
 * 題字素材 id → `InkTitle` 的 props。
 *
 * `packages/ui` 不知道素材清冊長什麼樣,也不該知道 —— 它只收一個能放進
 * `url()` 的位址與長寬比。把 id 換成位址是這一層的事。
 */
function inkProps(mark: NonNullable<Stop['mark']>) {
  const a = worldAsset(mark.asset);
  return { src: a.file, text: mark.text, ratio: a.width / a.height } as const;
}
