import type { StopId } from './acts';

/**
 * 近景:釘在視窗底緣的 2D 去背素材。
 *
 * 為什麼是 2D:規格寫死「3D 場景與 2D 前景」,而這不只是省事 ——
 * 前景遮擋物離鏡頭最近,任何一點幾何或材質的粗糙都會被放到最大。
 * 一張真的去背照片在這個距離永遠贏過程序生成的幾何。
 *
 * 擺位由這份帳冊決定,尺寸由素材本身決定。兩件事分開,是因為同一件素材會在
 * 不同場次站不同邊(梅枝在木牆那一場從上角伸入、在賽程那一場橫貫畫面),
 * 而它的大小不該跟著變。
 *
 * 素材的分類依據見 notes/2026-09-14-劍塚-素材分類定案.md:凡是去背件都是前景,
 * 滿版板才是背景。規格要的十一件裡可用的是十件,缺的「破格窗」與「落瓦」
 * 用程序幾何補,不拿別的頂替。
 */
export interface ForegroundPiece {
  /** world.json 裡的素材 id。 */
  asset: string;
  /** 從哪一邊進場。 */
  from: 'left' | 'right' | 'up';
  /** 貼著哪一邊。 */
  side: 'left' | 'right' | 'centre';
  /** 會不會被風吹。吃的是與竹林、草同一支 windAt。 */
  sways?: boolean;
}

export interface StopStage {
  stop: StopId;
  pieces: readonly ForegroundPiece[];
}

export const STAGES: readonly StopStage[] = [
  // 前兩幕是布幕的事。布幕自己就是最前面那一層,再加近景只會擋住剪影。
  { stop: 'prologue', pieces: [] },
  { stop: 'challenge', pieces: [] },
  {
    stop: 'format',
    pieces: [
      { asset: 'fg-snow-bamboo', from: 'left', side: 'left', sways: true },
      { asset: 'fg-wood-railing', from: 'right', side: 'right' },
    ],
  },
  {
    stop: 'prize',
    pieces: [
      { asset: 'fg-war-table', from: 'up', side: 'centre' },
      { asset: 'fg-brazier', from: 'left', side: 'left' },
    ],
  },
  {
    stop: 'schedule',
    pieces: [{ asset: 'fg-snow-plum-branch', from: 'up', side: 'right', sways: true }],
  },
  {
    stop: 'signup',
    pieces: [
      { asset: 'fg-lantern', from: 'right', side: 'right' },
      { asset: 'fg-snow-bamboo', from: 'left', side: 'left', sways: true },
    ],
  },
];

export function stageFor(id: StopId): StopStage | undefined {
  return STAGES.find((s) => s.stop === id);
}
