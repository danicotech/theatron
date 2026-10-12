/**
 * 《論劍》的賽事內容 —— 整個站唯一的文案資料來源。
 *
 * 形狀**逐欄對齊** `design/lunjian/content.json`(同一個專案更早一版留下來的
 * 契約,`design/cinematic-media-kit/dist/assets/content.json` 也是同一份形狀)。
 * 對齊是刻意的:那一份定案時,這裡就是直接換值,不是重新對映欄位。
 *
 * 名稱、組別、日期、獎金、主辦、聯繫都還沒定案(見 notes/2026-09-13-論劍-素材缺口.md
 * 第六節),所以全部是 `{{PLACEHOLDER}}`。**不編造比賽事實。**
 *
 * 為什麼是 .ts 不是直接 import 那份 .json:佔位值必須跟真值走同一條路徑,
 * 而 JSON 給不出「這一欄是日期、那一欄是清單」的型別 —— 渲染端就得自己猜。
 */

/** 還沒定案的值。渲染端看到它就畫「待公布」,不是把大括號印出來。 */
export const PLACEHOLDER = '{{PLACEHOLDER}}';

export function isPlaceholder(value: string | null | undefined): boolean {
  return value === undefined || value === null || value.trim() === '' || value === PLACEHOLDER;
}

/** 待公布時畫的字。只有一個地方寫,不然七章會長出七種說法。 */
export const TBA = '待公布';

/** 顯示用的值:定案了就照原樣,沒定案就是「待公布」。 */
export function show(value: string | null | undefined): string {
  return isPlaceholder(value) ? TBA : (value as string);
}

/**
 * 內容契約。欄位名與 design/lunjian/content.json 一字不差。
 *
 * 四個日期是**四個平欄**而不是一個陣列,因為那份 JSON 就是這樣 ——
 * 它們是四件不同的事(開放報名 / 截止 / 初賽 / 決賽),不是同一種東西的四筆。
 * 第五章要的「一列日期」由 `SCHEDULE` 從這四欄推出來,不另外存一份。
 */
export interface TournamentContent {
  tournamentName: string;
  tagline: string;
  /** `YYYY-MM-DD`,或還沒定案時的 `{{PLACEHOLDER}}`。 */
  registrationOpen: string;
  registrationClose: string;
  qualifiersDate: string;
  finalsDate: string;
  organiser: string;
  contact: string;
  /** 內部代號。這一個**不是** placeholder —— 它是這次視覺的名字。 */
  workingTitle: string;
  divisions: readonly string[];
  rules: readonly string[];
  judges: readonly string[];
  prizes: readonly string[];
  partners: readonly string[];
  /** 報名網址。沒有就不給按鈕 —— 給一個會 404 的連結比不給更糟。 */
  registrationUrl: string | null;
}

export const CONTENT: TournamentContent = {
  tournamentName: PLACEHOLDER,
  tagline: PLACEHOLDER,
  registrationOpen: PLACEHOLDER,
  registrationClose: PLACEHOLDER,
  qualifiersDate: PLACEHOLDER,
  finalsDate: PLACEHOLDER,
  organiser: PLACEHOLDER,
  contact: PLACEHOLDER,
  workingTitle: '論劍',
  divisions: [PLACEHOLDER],
  rules: [PLACEHOLDER],
  judges: [PLACEHOLDER],
  prizes: [PLACEHOLDER],
  partners: [PLACEHOLDER],
  registrationUrl: null,
};

/** 第五章的一個節點:梅枝上的一朵花。 */
export interface ScheduleEntry {
  /** 對應 CONTENT 的哪一欄。開發時對得起來,不必猜。 */
  field: 'registrationOpen' | 'registrationClose' | 'qualifiersDate' | 'finalsDate';
  /** 這一天在做什麼。 */
  name: string;
  iso: string;
}

/**
 * 時程 —— 從四個平欄推出來的一列,不是第二份資料。
 *
 * 順序是先後,梅枝上的花就照這個順序長。名字寫在這裡而不是 content.json,
 * 因為它們是**這個站怎麼稱呼這四個日期**,不是主辦要填的東西。
 */
export const SCHEDULE: readonly ScheduleEntry[] = [
  { field: 'registrationOpen', name: '開放報名', iso: CONTENT.registrationOpen },
  { field: 'registrationClose', name: '報名截止', iso: CONTENT.registrationClose },
  { field: 'qualifiersDate', name: '初賽', iso: CONTENT.qualifiersDate },
  { field: 'finalsDate', name: '決賽', iso: CONTENT.finalsDate },
];
