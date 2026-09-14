/**
 * 《劍塚》的三幕帳冊。
 *
 * 取代先前的七章平鋪。差別不在數量,在**結構**:七章是七段各自捲過去的內容,
 * 三幕是三個被釘住的舞台 —— 捲動推進幕內進度,進度走到定點時畫面定格,
 * 卡片浮上,讀完再往下捲。
 *
 * 分工是硬的:
 *
 *  · **3D 與影像只負責氣氛。** 所有比賽資訊都是疊在上層的語意化 HTML,
 *    關掉 JS、關掉 WebGL、開啟減少動態,六張卡一字不少。
 *  · **定格不等於靜止。** 定格時相機停,但雪、旗、粒子、燈火繼續動。
 *  · **一切都是進度的函式。** 沒有東西是「被播出來的」,所以往回捲、重新整理、
 *    直接跳錨點,得到的畫面與從頭捲下來完全一樣。
 *
 * 色溫是一條弧線:暖 → 撕裂 → 冷。第一幕整個畫面就是那塊被背光照亮的布幕,
 * 那盞燈就是規格說的「唯一暖點」;旗被劃破後月光湧入;第三幕走出去才是冷月夜景。
 * 暖是封閉的戲棚,冷是外面的真世界 —— 旗落下就是從看戲變成入局。
 */

export type ActId = 'i' | 'ii' | 'iii';

/** 定格點的識別子,同時也是錨點與導覽的 id。 */
export type StopId = 'prologue' | 'challenge' | 'format' | 'prize' | 'schedule' | 'signup';

export const STOP_IDS: readonly StopId[] = [
  'prologue',
  'challenge',
  'format',
  'prize',
  'schedule',
  'signup',
];

/**
 * 一個定格點。
 *
 * `at` 是它在**幕內**的進度(0…1),不是全站進度 —— 幕是舞台,進度是舞台上的時間。
 * `hold` 是定格平台佔多少 vh:那段捲動距離裡進度鎖住不動,卡片浮上並保持。
 * 80vh 大約是滑鼠滾輪三到四下,讀得完一張卡又不會久到像頁面當掉。
 */
export interface Stop {
  id: StopId;
  /** 幕內進度(0…1)。 */
  at: number;
  /** 定格平台的長度(vh)。手機上會縮短,見 HOLD_MOBILE。 */
  hold: number;
  /** 題字素材的 id,沒有對應手跡的就沒有。 */
  mark?: { asset: string; text: string };
  /** 卡片上方的小字。 */
  kicker: string;
  /** 右上角的編號。等寬、全大寫。 */
  index: string;
  /** 訪客從這一張卡要帶走的那一件事 —— 每一張只有一件。 */
  remember: string;
}

export interface Act {
  id: ActId;
  /** section 的 id,也是 #錨點。 */
  anchor: string;
  /** 幕名,一個字。 */
  name: string;
  /** 幕的副題。 */
  subtitle: string;
  /** 這一幕的場是什麼。 */
  scene: string;
  /** 幕內進度 0→1 之間發生的事。 */
  action: string;
  /** 幕的色溫。決定 3D 那一層走暖還是冷。 */
  temperature: 'warm' | 'tearing' | 'cold';
  /** 這一幕總共佔多少 vh(含定格平台)。 */
  span: number;
  stops: readonly Stop[];
}

/** 定格平台在手機上的長度(vh)。拇指滑一次約 70vh,60 讓人滑一次剛好讀完。 */
export const HOLD_MOBILE = 60;

export const ACTS: readonly Act[] = [
  {
    id: 'i',
    anchor: 'act-i',
    name: '影',
    subtitle: '旗後鬥劍',
    scene: '背光的布幕。月與遠山雪霧在最後,對劍剪影在布後,殘旗在布前',
    action: '兩人對峙、三次交鋒、後撤。分鏡切換,格內只有雪、旗、髮帶、燈火在動',
    temperature: 'warm',
    span: 360,
    stops: [
      {
        id: 'prologue',
        at: 0.85,
        hold: 80,
        kicker: '序',
        index: 'PROLOGUE / 000',
        remember: '比賽名稱',
      },
    ],
  },
  {
    id: 'ii',
    anchor: 'act-ii',
    name: '破',
    subtitle: '噴墨與劃破',
    scene: '承接第一幕的機位,不換鏡',
    action: '朱紅噴上旗面、劍尖劃開裂口、月光從裂口湧入、旗落下,枯梅接住最後一滴',
    temperature: 'tearing',
    span: 360,
    stops: [
      {
        id: 'challenge',
        at: 0.65,
        hold: 80,
        mark: { asset: 'ink-war-letter', text: '戰帖' },
        kicker: '戰帖',
        index: 'THE INVITATION / 001',
        remember: '這是什麼比賽',
      },
    ],
  },
  {
    id: 'iii',
    anchor: 'act-iii',
    name: '界',
    subtitle: '3D 場景與 2D 前景',
    scene: '旗落下後露出的整座荒館。相機穿過四個場次',
    action: '牌樓、大廳、木牆、木門。每個場次一個定格點',
    temperature: 'cold',
    span: 920,
    stops: [
      {
        id: 'format',
        at: 0.16,
        hold: 80,
        mark: { asset: 'ink-rules', text: '賽制' },
        kicker: '牌樓',
        index: 'THE FORMAT / 002',
        remember: '段位、BP、讓武',
      },
      {
        id: 'prize',
        at: 0.41,
        hold: 80,
        mark: { asset: 'ink-rewards', text: '獎賞' },
        kicker: '大廳',
        index: 'THE REWARDS / 003',
        remember: '獎金與獎品',
      },
      {
        id: 'schedule',
        at: 0.66,
        hold: 80,
        mark: { asset: 'ink-schedule', text: '賽程' },
        kicker: '木牆',
        index: 'THE ROAD / 004',
        remember: '報名、初賽、決賽日期',
      },
      {
        id: 'signup',
        at: 0.91,
        hold: 80,
        mark: { asset: 'ink-signup', text: '報名' },
        kicker: '木門',
        index: 'THE GATE / 005',
        remember: '報名方式與截止日',
      },
    ],
  },
];

/** 六個定格點依序攤平。導覽、錨點、閱讀進度都用這一份。 */
export const STOPS: readonly (Stop & { act: ActId })[] = ACTS.flatMap((a) =>
  a.stops.map((s) => ({ ...s, act: a.id })),
);

export function actOf(id: ActId): Act {
  const found = ACTS.find((a) => a.id === id);
  if (found === undefined) throw new Error(`幕帳冊沒有這一幕:${id}`);
  return found;
}

export function stopOf(id: StopId): Stop & { act: ActId } {
  const found = STOPS.find((s) => s.id === id);
  if (found === undefined) throw new Error(`幕帳冊沒有這個定格點:${id}`);
  return found;
}

/**
 * 幕內進度 → 分鏡格。第一幕專用。
 *
 * 格與格之間**不插值**:剪影是一張靜態去背圖,連續動畫會逼它做轉身換姿勢這種
 * 做不到的事,一插值就看得出在拉扯一張平面圖。漫畫本來就是用靜止的格說動作。
 * 而且「現在是第幾格」是純函式,快滑與反滑都不會有動畫追不上的問題。
 */
export interface ComicFrame {
  /** 格的序號,從 0 起算。 */
  index: number;
  /** 幕內進度的下界(含)。 */
  from: number;
  /** 左件的水平位移,畫布寬度的比例。正 = 往右。 */
  leftDx: number;
  rightDx: number;
  /** 鏡頭在畫布上的取景:中心的 y(0 = 上緣)與寬度比例(1 = 全景)。 */
  camY: number;
  camWidth: number;
  /** 這一格在說什麼。給無障礙用,也給自己看。 */
  caption: string;
}

export const COMIC_FRAMES: readonly ComicFrame[] = [
  {
    index: 0,
    from: 0.0,
    leftDx: -0.055,
    rightDx: 0.055,
    camY: 0.5,
    camWidth: 1.0,
    caption: '對峙',
  },
  { index: 1, from: 0.35, leftDx: 0, rightDx: 0, camY: 0.5, camWidth: 1.0, caption: '第一次交鋒' },
  {
    index: 2,
    from: 0.47,
    leftDx: 0.005,
    rightDx: -0.005,
    camY: 0.34,
    camWidth: 0.62,
    caption: '第二次交鋒',
  },
  {
    index: 3,
    from: 0.59,
    leftDx: 0.015,
    rightDx: -0.015,
    camY: 0.2,
    camWidth: 0.3,
    caption: '第三次交鋒',
  },
  {
    index: 4,
    from: 0.7,
    leftDx: -0.07,
    rightDx: 0.07,
    camY: 0.52,
    camWidth: 1.04,
    caption: '後撤',
  },
];

export function frameAt(progress: number): ComicFrame {
  let found = COMIC_FRAMES[0]!;
  for (const f of COMIC_FRAMES) {
    if (progress >= f.from) found = f;
  }
  return found;
}

/**
 * 幕內進度 → 相機在整條路徑上走到哪。
 *
 * 第三幕有四個場次,所以它佔的鏡位是前兩幕的四倍。三幕依序發生,而且每一幕的
 * 進度在它之前是 0、之後是 1,所以直接相加就是一條單調遞增的 0…6。
 *
 * 住在帳冊裡而不是殼裡:環境層要讀它,殼也要讀它,而殼 import 環境層 ——
 * 放在殼裡兩邊就會互相 import。
 */
export const WORLD_MAX = 6;

export function worldProgress(p: Record<ActId, number>): number {
  return p.i + p.ii + p.iii * 4;
}

/**
 * 定格點的錨點該掛在哪個捲動位置。
 *
 * # 為什麼需要算
 *
 * 卡片住在釘住的舞台裡,所以它的 DOM 位置永遠是那一幕的開頭 ——
 * 把 `id` 掛在卡片上,`#stop-signup` 會跳到第三幕的頭,而不是報名那一張紙浮上來
 * 的地方。錨點必須是一個**放在正確捲動位置**的零高度元素。
 *
 * # 為什麼回傳的是一條算式而不是一個數字
 *
 * 平台長度在手機上不一樣(`HOLD_MOBILE`),而平台不推進進度 ——
 * 所以平台一短,推進段就變長,每一個錨點的位置都跟著變。位置不是
 * 「固定值 + 幾個平台」,是 hold 的**一次函式**:
 *
 * ```
 * advance  = (span − 一個視窗) − n·hold
 * offset_k = at_k · advance + (k + NUDGE)·hold
 *          = at_k·(span − 一個視窗) + (k + NUDGE − at_k·n)·hold
 * ```
 *
 * `NUDGE` 讓錨點指向平台的四分之一處而不是第一個像素。錨點指的是
 * 「卡片站定的那一刻」—— 停在第一個像素上,湊整、捲動的次像素誤差、
 * 以及卡片 900ms 的淡入,三個加起來就會讓人跳過去卻看到一張還沒亮的卡。
 *
 * 所以回傳兩個係數,交給 CSS 的 `calc()` 去乘 `--hold`。用 JS 量視窗寬度再算一次
 * 會多一份斷點定義,而那一份遲早跟 CSS 的漂開。
 *
 * 「減一個視窗」這一項與 `stateAt()` 的 `act.height - viewportH` 是同一件事:
 * 最後那一屏是舞台自己佔著的,捲不動。兩邊一起改。
 */
export interface AnchorOffset {
  id: StopId;
  /** 與 hold 無關的那一段(vh)。 */
  baseVh: number;
  /** 要乘上 `--hold` 的係數。可以是負的。 */
  holdFactor: number;
}

/** 錨點往平台裡挪多少(平台長度的比例)。 */
const NUDGE = 0.25;

export function anchorOffsets(act: Act): AnchorOffset[] {
  const n = act.stops.length;
  const travelVh = act.span - 100;
  return [...act.stops]
    .sort((x, y) => x.at - y.at)
    .map((stop, k) => ({
      id: stop.id,
      baseVh: stop.at * travelVh,
      holdFactor: k + NUDGE - stop.at * n,
    }));
}
