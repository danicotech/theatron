'use client';

import { useEffect, useMemo, useState } from 'react';

import styles from './BracketTree.module.css';

/**
 * 晉級樹。
 *
 * 這是設計規範四個簽名元素之一,也是規範自己標為「最難的一個」。三件事:
 *
 *  1. **手機是分輪檢視,不是縮小的完整樹。** 16 人的樹約 1000×700,塞進 375px
 *     只有三種結果:看不清、要一直捏放大、或字小到看不見。把設計問題丟給
 *     使用者不算解法。
 *  2. **連接線在分出勝負後點亮。** 亮起來的那條就是晉級路徑,冠軍路徑因此是
 *     一條貫穿的線 —— 不需要圖例,掃一眼就看得出誰走到底。
 *  3. **進行中會脈動。** 那是「現在正在發生」,與「贏」「錢」分屬不同顏色職責。
 *
 * 這個套件不知道賽事規則:輪次名稱、誰晉級、哪些人輪空,全部由呼叫端算好傳進來。
 */

/** 一場比賽裡的一個位置。空著(還沒打完上一輪)時傳 undefined。 */
export interface BracketSeat {
  /** 顯示名稱。 */
  name: string;
  /** 段位徽記要的資料;不給就不顯示。 */
  rank?: { level: number; total: number; name: string } | undefined;
  /** 這一位是本場勝者。 */
  won?: boolean | undefined;
  /** 輪空直接晉級,不是打贏的。 */
  bye?: boolean | undefined;
}

/** 一場比賽的呈現狀態。刻意是**呈現**詞彙,不是賽事狀態機的名字。 */
export type BracketMatchState = 'upcoming' | 'live' | 'done';

export interface BracketMatchView {
  id: string;
  state: BracketMatchState;
  top?: BracketSeat | undefined;
  bottom?: BracketSeat | undefined;
  /** 在這條晉級路徑上(冠軍路徑會因此連成一條)。 */
  onWinnerPath?: boolean | undefined;
  /**
   * 季軍戰不在晉級樹上:與決賽同一欄、沒有連出去的線、標「季軍戰」。
   * 預設 'bracket'。
   */
  kind?: 'bracket' | 'third_place' | undefined;
  /** 多回合制的勝場數(上 : 下)。不給就不顯示 —— 單場定勝負沒有比分。 */
  score?: { top: number; bottom: number } | undefined;
  /** 進行中的回合編號;只在 state = 'live' 時有意義。 */
  liveRound?: number | undefined;
  /** 點進去看細節;不給就不可點。 */
  href?: string | undefined;
}

export interface BracketRoundView {
  /** 輪次編號,1 起算。 */
  round: number;
  /** 「八強」「準決賽」「決賽」—— 由呼叫端給,這裡不推導。 */
  label: string;
  matches: BracketMatchView[];
}

export interface BracketTreeProps {
  rounds: BracketRoundView[];
  /**
   * 手機分輪檢視預設落在哪一輪。
   * 規範要求「有事情正在發生的那一輪」,而不是第 1 輪 —— 由呼叫端決定,
   * 因為「正在發生」是賽事規則。
   */
  defaultRound?: number | undefined;
  /** 每一場要怎麼稱呼(給螢幕閱讀器);預設「第 N 場」。 */
  matchLabel?: (m: BracketMatchView, index: number) => string;
}

export function BracketTree({ rounds, defaultRound, matchLabel }: BracketTreeProps) {
  const firstRound = rounds[0]?.round ?? 1;
  const [active, setActive] = useState(defaultRound ?? firstRound);

  // 呼叫端算出的「正在進行的那一輪」可能晚一步到(資料是非同步的)。
  useEffect(() => {
    if (defaultRound !== undefined) setActive(defaultRound);
  }, [defaultRound]);

  const activeRound = useMemo(
    () => rounds.find((r) => r.round === active) ?? rounds[0],
    [rounds, active],
  );

  if (rounds.length === 0) {
    return null;
  }

  return (
    <div className={styles.bracket}>
      {/* 手機:輪次切換器。桌機隱藏 —— 那裡看得到整棵樹。 */}
      <div className={styles.switcher} role="tablist" aria-label="輪次">
        {rounds.map((r) => (
          <button
            key={r.round}
            type="button"
            role="tab"
            aria-selected={r.round === active}
            className={[styles.chip, r.round === active ? styles.chipOn : ''].join(' ')}
            onClick={() => {
              setActive(r.round);
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className={styles.columns}>
        {rounds.map((r) => (
          <section
            key={r.round}
            className={[styles.column, r.round === activeRound?.round ? styles.columnOn : ''].join(
              ' ',
            )}
            aria-label={r.label}
          >
            <h3 className={styles.roundLabel}>{r.label}</h3>
            <ol className={styles.matches}>
              {r.matches.map((m, i) => (
                <li key={m.id} className={styles.slot}>
                  <MatchNode
                    match={m}
                    label={matchLabel?.(m, i) ?? `第 ${i + 1} 場`}
                    last={r.round === rounds[rounds.length - 1]?.round}
                  />
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

function MatchNode({
  match,
  label,
  last,
}: {
  match: BracketMatchView;
  label: string;
  last: boolean;
}) {
  const third = match.kind === 'third_place';
  const classes = [
    styles.node,
    styles[match.state],
    match.onWinnerPath === true ? styles.lit : '',
    // 季軍戰的勝者不晉級,所以沒有連出去的線 —— 與決賽同樣是這一欄的終點。
    last || third ? styles.finalNode : '',
    third ? styles.thirdPlace : '',
  ].join(' ');

  const body = (
    <>
      {third ? <span className={styles.kindTag}>季軍戰</span> : null}
      <Seat seat={match.top} score={match.score?.top} />
      <Seat seat={match.bottom} score={match.score?.bottom} />
      {match.state === 'live' ? (
        <span className={styles.liveMark}>
          <span className={styles.liveDot} aria-hidden="true" />
          {match.liveRound === undefined ? null : (
            <span className={styles.liveRound}>第 {match.liveRound} 回合</span>
          )}
        </span>
      ) : null}
    </>
  );

  if (match.href === undefined) {
    return (
      // group 而不是裸 div:aria-label 只有在元素有角色時才合法,
      // 而這個節點確實是「一組東西」(兩個位置 + 狀態)。
      <div className={classes} role="group" aria-label={label}>
        {body}
      </div>
    );
  }
  return (
    <a className={[classes, styles.clickable].join(' ')} href={match.href} aria-label={label}>
      {body}
    </a>
  );
}

/** 段位刻度。抽成一個函式是為了讓 rank 的 narrowing 留在一個地方。 */
function SeatRank({ rank }: { rank: BracketSeat['rank'] }) {
  if (rank === undefined) return null;
  return (
    <span role="img" aria-label={`段位 ${rank.name}`}>
      <span className={styles.marks} aria-hidden="true">
        {Array.from({ length: rank.total }, (_, i) => (
          <span key={i} className={i < rank.level ? styles.on : styles.off} />
        ))}
      </span>
    </span>
  );
}

/** 空位不是錯誤,是「上一輪還沒打完」。寫出來比留白好 —— 留白看起來像壞了。 */
function Seat({ seat, score }: { seat: BracketSeat | undefined; score?: number | undefined }) {
  if (seat === undefined) {
    return (
      <span className={[styles.seat, styles.empty].join(' ')}>
        <span className={styles.name}>待定</span>
      </span>
    );
  }
  return (
    <span className={[styles.seat, seat.won === true ? styles.won : ''].join(' ')}>
      <span className={styles.name}>{seat.name}</span>
      <SeatRank rank={seat.rank} />
      {seat.bye === true ? <span className={styles.bye}>輪空</span> : null}
      {/* 勝場數是記分板的數字:mono + tabular,跳動時不左右晃(硬規則 2)。 */}
      {score === undefined ? null : (
        <span className={styles.score} aria-label={`勝 ${score} 回合`}>
          {score}
        </span>
      )}
    </span>
  );
}
