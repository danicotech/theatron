'use client';

import { Code, ConnectError } from '@connectrpc/connect';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { activityApi } from '../../lib/api/activity';
import type {
  HandicapItem,
  Match,
  MatchHandicaps,
  Player,
  Tournament,
  Violation,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';
import { MatchStatus } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import type { GetMyBudgetResponse } from '../../lib/api/gen/hestia/activity/v1/handicap_pb';
import { usePolling } from '../../lib/api/poll';

import { BpMeter } from './BpMeter';
import { HANDICAP_CATEGORIES } from './categories';
import { ItemCard } from './ItemCard';
import { SelectionList } from './SelectionList';
import { clock } from './time';
import { ViolationList } from './ViolationList';

import styles from './HandicapShop.module.css';

/**
 * 本場讓武 —— 低段位方在開賽前花 BP 的地方。
 *
 * 三種人會打開這一頁,畫面完全不同:
 *   持有 BP 的一方  → 商店:餘額計、讓武單、項目列表。
 *   被讓的一方      → 只看得到「對手有多少 BP」;封盤後才看得到買了什麼。
 *   同段對決        → 本場沒有讓武,說一句就好。
 *
 * 誰是誰由 GetMatchHandicaps 的 constrained_player_public_id 決定,不由段位推:
 * 段位差的規則在伺服器,前端多算一次只會在規則改動時算出第二個答案。
 *
 * 讓武全貌與我的預算一起輪詢(5 秒):開盤、封盤都是裁判在另一台機器上按的,
 * 選手手上的畫面要自己跟上。項目總表一屆不變,只讀一次。
 */

export interface HandicapShopProps {
  slug: string;
}

type Me =
  | { kind: 'loading' }
  | { kind: 'anonymous' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; player: Player; tournament: Tournament; match: Match | undefined };

interface Snapshot {
  handicaps: MatchHandicaps;
  /** 只有可能持有 BP 的一方才問;被讓的一方沒有預算可查。 */
  budget: GetMyBudgetResponse | undefined;
  /** 我在本場的違規紀錄。任一方都可能違規(雙方適用的項目買方自己也算)。 */
  violations: Violation[];
}

const POLL_MS = 5000;

export function HandicapShop({ slug }: HandicapShopProps) {
  const [me, setMe] = useState<Me>({ kind: 'loading' });
  const [items, setItems] = useState<HandicapItem[]>([]);
  const [itemsError, setItemsError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await activityApi.signup.getMyPlayer({});
        if (res.player === undefined || res.tournament === undefined) {
          setMe({ kind: 'anonymous' });
          return;
        }
        setMe({
          kind: 'ready',
          player: res.player,
          tournament: res.tournament,
          match: res.currentMatch,
        });
      } catch (err) {
        const ce = ConnectError.from(err);
        setMe(
          ce.code === Code.Unauthenticated
            ? { kind: 'anonymous' }
            : { kind: 'error', message: ce.message },
        );
      }
    })();
  }, []);

  useEffect(() => {
    void activityApi.handicap
      .listItems({ tournamentSlug: slug })
      .then((r) => {
        setItems(r.items);
      })
      .catch((err: unknown) => {
        setItemsError(ConnectError.from(err).message);
      });
  }, [slug]);

  const matchId = me.kind === 'ready' ? (me.match?.publicId ?? '') : '';
  const myId = me.kind === 'ready' ? me.player.publicId : '';

  const load = useCallback(async (): Promise<Snapshot | null> => {
    if (matchId === '') return null;
    const [res, mine] = await Promise.all([
      activityApi.handicap.getMatchHandicaps({ matchPublicId: matchId }),
      activityApi.handicap.listMyViolations({ matchPublicId: matchId }),
    ]);
    const handicaps = res.handicaps;
    if (handicaps === undefined) return null;
    const constrained = handicaps.constrainedPlayerPublicId === myId;
    // 對手還沒確定(PENDING)時預算還不存在,問了只會拿到錯誤。
    const budget =
      constrained || handicaps.status === MatchStatus.PENDING
        ? undefined
        : await activityApi.handicap.getMyBudget({ matchPublicId: matchId });
    return { handicaps, budget, violations: mine.violations };
  }, [matchId, myId]);

  const polled = usePolling(load, POLL_MS);
  const { reload } = polled;

  // Select 的回應帶了買完後的預算,但這裡不用它:讓武單與餘額計都讀同一份輪詢快照,
  // 兩處才不會在同一瞬間顯示不同的餘額。
  const add = useCallback(
    async (item: HandicapItem, targetNote: string) => {
      await activityApi.handicap.select({
        matchPublicId: matchId,
        itemPublicId: item.publicId,
        targetNote,
      });
      await reload();
    },
    [matchId, reload],
  );

  const voidOne = useCallback(
    async (selectionPublicId: string) => {
      await activityApi.handicap.voidSelection({ selectionPublicId });
      await reload();
    },
    [reload],
  );

  if (me.kind === 'loading') {
    return <p className={styles.muted}>讀取中…</p>;
  }

  if (me.kind === 'anonymous') {
    return (
      <div className={styles.wall}>
        <p className={styles.wallLine}>你還沒進站。讓武要用你自己的身分買。</p>
        <div className={styles.links}>
          <Link className={styles.link} href={`/t/${slug}/login`}>
            用遊戲ID 進站
          </Link>
        </div>
      </div>
    );
  }

  if (me.kind === 'error') {
    return (
      <p className={styles.error} role="alert">
        {me.message}
      </p>
    );
  }

  const { match, player, tournament } = me;

  if (match === undefined) {
    return (
      <div className={styles.wall}>
        <p className={styles.wallLine}>還沒有排定的場次。排定之後,這一頁才有東西可以買。</p>
        <div className={styles.links}>
          <Link className={styles.link} href={`/t/${slug}/me`}>
            我的報名
          </Link>
          <Link className={styles.link} href={`/t/${slug}/rules`}>
            規則與讓武項目
          </Link>
        </div>
      </div>
    );
  }

  const snap = polled.data;
  const matchLabel = `第 ${String(match.round)} 輪第 ${String(match.slot + 1)} 場`;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>本場讓武</p>
        <h1 className={styles.title}>{matchLabel}</h1>
        <div className={styles.links}>
          <Link className={styles.link} href={`/t/${slug}/m/${match.publicId}`}>
            這一場
          </Link>
          <Link className={styles.link} href={`/t/${slug}/rules`}>
            規則與讓武項目
          </Link>
        </div>
      </header>

      {polled.error === null ? null : (
        <p className={styles.error} role="alert">
          {polled.error}
        </p>
      )}

      {snap === null ? (
        polled.error === null ? (
          <p className={styles.muted}>讀取中…</p>
        ) : null
      ) : (
        <>
          <Body
            snap={snap}
            player={player}
            tournament={tournament}
            matchLabel={matchLabel}
            items={items}
            itemsError={itemsError}
            onAdd={add}
            onVoid={voidOne}
          />
          <ViolationList violations={snap.violations} />
        </>
      )}
    </div>
  );
}

function Body({
  snap,
  player,
  tournament,
  matchLabel,
  items,
  itemsError,
  onAdd,
  onVoid,
}: {
  snap: Snapshot;
  player: Player;
  tournament: Tournament;
  matchLabel: string;
  items: HandicapItem[];
  itemsError: string | null;
  onAdd: (item: HandicapItem, targetNote: string) => Promise<void>;
  onVoid: (selectionPublicId: string) => Promise<void>;
}) {
  const { handicaps, budget } = snap;
  const locked = handicaps.lockedAt !== undefined || handicaps.status >= MatchStatus.LOCKED;
  const constrained = handicaps.constrainedPlayerPublicId === player.publicId;
  const holderBudget = handicaps.budget;

  if (constrained) {
    return (
      <>
        <p className={styles.lede}>
          本場你是被讓的一方。
          {holderBudget === undefined
            ? ''
            : `對手手上有 ${holderBudget.budget.toString()} BP 可以對你施加限制。`}
          {locked ? '' : '對手買了什麼,封盤後才公開。'}
        </p>
        <StatusLine locked={locked} lockedAt={handicaps.lockedAt} />
        {locked ? (
          <SelectionList
            label={`對手的讓武單 · ${matchLabel}`}
            selections={handicaps.selections}
            canVoid={false}
            emptyCopy="對手沒有買任何項目。"
          />
        ) : null}
      </>
    );
  }

  if (handicaps.status === MatchStatus.PENDING) {
    return <p className={styles.lede}>對手還沒確定。等上一場打完,這一頁才會有預算。</p>;
  }

  if (holderBudget === undefined || holderBudget.budget === 0n) {
    return <p className={styles.lede}>同段對決,本場沒有讓武。開賽前把設定準備好就行。</p>;
  }

  const editable = budget?.editable === true && !locked;
  const reason = budget?.lockedReason ?? '';
  const quantities = new Map<string, number>();
  for (const s of handicaps.selections) {
    quantities.set(s.itemPublicId, (quantities.get(s.itemPublicId) ?? 0) + 1);
  }
  const groups = HANDICAP_CATEGORIES.map((c) => ({
    ...c,
    items: items.filter((i) => i.category === c.key).sort((a, b) => a.sortOrder - b.sortOrder),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <div className={styles.sticky}>
        <BpMeter budget={holderBudget} perGap={tournament.bpPerRankGap} />
        {locked || groups.length === 0 ? null : (
          <nav className={styles.chips} aria-label="讓武分類">
            <ul className={styles.chipList}>
              {groups.map((g) => (
                <li key={g.key}>
                  <a className={styles.chip} href={`#hc-${g.anchor}`}>
                    {g.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>

      <StatusLine locked={locked} lockedAt={handicaps.lockedAt} shop={{ editable, reason }} />

      <SelectionList
        label={`讓武單 · ${matchLabel}`}
        selections={handicaps.selections}
        canVoid={editable}
        onVoid={editable ? onVoid : undefined}
        emptyCopy={editable ? '還沒買任何項目。從下面的列表挑。' : '還沒買任何項目。開盤後才能買。'}
      />

      {locked ? null : (
        <section className={styles.catalogue} aria-label="讓武項目">
          <p className={styles.hint}>
            BP 夠就能買,同一項可以重複買。由隨機決定的項目,系統在封盤那一刻抽選,
            結果封盤後才會出現在讓武單上。
          </p>
          {itemsError === null ? null : (
            <p className={styles.error} role="alert">
              {itemsError}
            </p>
          )}
          {groups.map((g) => (
            <div key={g.key} className={styles.group}>
              <h2 className={styles.h2} id={`hc-${g.anchor}`}>
                {g.label}
              </h2>
              <ul className={styles.items}>
                {g.items.map((item) => (
                  <ItemCard
                    key={item.publicId}
                    item={item}
                    quantity={quantities.get(item.publicId) ?? 0}
                    remaining={holderBudget.remaining}
                    editable={editable}
                    onAdd={onAdd}
                  />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

/**
 * 狀態橫幅。商店關著的時候要用整條橫幅說,不是只把按鈕變灰(responsive.md)。
 *
 * `shop` 只有持有 BP 的一方才有:被讓的一方只在乎封了沒,開沒開與他無關。
 * 沒開盤的理由用伺服器給的 locked_reason —— 沒開盤、不歸我、已封盤的措辭
 * 只該有一個家。
 */
function StatusLine({
  locked,
  lockedAt,
  shop,
}: {
  locked: boolean;
  lockedAt: MatchHandicaps['lockedAt'];
  shop?: { editable: boolean; reason: string };
}) {
  if (locked) {
    const at = lockedAt === undefined ? '' : ` ${clock(lockedAt)}`;
    return (
      <p className={styles.status}>
        <span className={styles.statusKey}>已封盤{at}</span>
        內容已公開給雙方與觀眾,不能再改。
      </p>
    );
  }
  if (shop === undefined) return null;
  if (shop.editable) {
    return (
      <p className={styles.statusOpen}>
        <span className={styles.liveDot} aria-hidden="true" />
        <span className={styles.statusKey}>開盤中</span>
        封盤前都能買、能退。
      </p>
    );
  }
  return (
    <p className={styles.statusClosed}>
      <span className={styles.statusKey}>還沒開盤</span>
      {shop.reason === '' ? '等御風羽公告。' : shop.reason}
    </p>
  );
}
