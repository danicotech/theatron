/**
 * 讓武 BP 制度 —— 首頁要講的那一套規則。
 *
 * # 這裡放什麼、不放什麼
 *
 * 放的是**制度**:段位有幾階、差一階給多少 BP、讓武分幾類、每類的點數區間。
 * 這些是賽制的設計,跨屆不變,而且首頁必須在沒有後端的情況下也讀得完
 * (首頁是公告站,不是應用程式)。
 *
 * **不放**三十個讓武項目的逐項內容。那份的權威位置是 `hestia` 的
 * `activity.handicap_items` seed,首頁再抄一份就會有兩個地方要維護,
 * 而且遲早會有一邊漏改。要看完整清單的人走 `/t/<slug>/rules`,
 * 那一頁是從 API 取的,永遠跟裁判手上的一致。
 *
 * # 為什麼制度可以寫死
 *
 * 「每差一段 8 BP」是這套玩法的核心參數,它寫在 `tournaments.config` 裡可調,
 * 但公告站講的是「這場比賽是怎麼設計的」,不是「本屆的參數是多少」。
 * 真的改了參數,改這一份與 seed 一起改 —— 那是一次定案,不是兩份資料在漂。
 */

export interface Rank {
  /** 1 最低。段位只存數字,名稱與意境是它的呈現。 */
  level: 1 | 2 | 3 | 4;
  name: string;
  title: string;
}

/** 四階,由低至高。BP 的差距就是從這個梯子上量出來的。 */
export const RANKS: readonly Rank[] = [
  { level: 1, name: '開山', title: '初試之境' },
  { level: 2, name: '斷水', title: '初成之境' },
  { level: 3, name: '飛花', title: '純熟之境' },
  { level: 4, name: '無我', title: '歷戰之境' },
];

/** 每差一段,低段位者得到的 BP。高段位者永不獲得反向補償。 */
export const BP_PER_GAP = 8;

/** 段位差 → BP。同段是 0,而且只有低段的那一邊拿得到。 */
export function bpForGap(gap: number): number {
  return gap > 0 ? gap * BP_PER_GAP : 0;
}

export interface HandicapCategory {
  key: string;
  name: string;
  /** 這一類在做什麼。一句話,不是清單。 */
  what: string;
  /** 項目數。逐項內容的權威位置是 hestia 的 seed,不在這裡。 */
  count: number;
  /** 點數區間 [最低, 最高]。 */
  cost: readonly [number, number];
  /** 一個有代表性的例子,讓人知道這類大概長什麼樣。 */
  example: string;
}

export const HANDICAP_CATEGORIES: readonly HandicapCategory[] = [
  {
    key: 'weapon',
    name: '武器限制',
    what: '限制對手能帶什麼上場',
    count: 5,
    cost: [2, 20],
    example: '指定對手武學',
  },
  {
    key: 'skill',
    name: '技能限制',
    what: '封掉對手的招',
    count: 7,
    cost: [3, 24],
    example: '禁用兩種技能',
  },
  {
    key: 'defense',
    name: '防禦與位移',
    what: '讓對手不能閃、不能擋、不能跑',
    count: 6,
    cost: [2, 20],
    example: '禁用移動鍵',
  },
  {
    key: 'poison',
    name: '下毒',
    what: '動對手的操作與資源',
    count: 4,
    cost: [10, 24],
    example: '打亂上下左右鍵',
  },
  {
    key: 'victory',
    name: '勝利條件',
    what: '改寫這一場怎麼算贏',
    count: 5,
    cost: [10, 24],
    example: '撐過 90 秒即獲勝',
  },
  {
    key: 'rule',
    name: '規則限制',
    what: '加上場外的約束',
    count: 7,
    cost: [1, 17],
    example: '對手未攻擊時必須待在角落',
  },
];

/** 六大類的項目總數。寫成推導而不是一個數字 —— 加一類時不會忘記改。 */
export const HANDICAP_TOTAL = HANDICAP_CATEGORIES.reduce((n, c) => n + c.count, 0);

/**
 * 這套制度的一句話。
 *
 * 它在規格、首頁、規則頁都會出現,所以只寫一次。
 * 「讓武不是放水」這件事必須說出來 —— 受限方仍須全力求勝,
 * 不講清楚的話整個設計會被讀成同情弱者。
 */
export const CREED = 'BP 不保證弱者獲勝,只賦予後進要求強者以更困難方式取勝的權利。';
