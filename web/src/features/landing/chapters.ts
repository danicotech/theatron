/**
 * 《劍塚》的章節帳冊。
 *
 * 七章對應五幕。誰在哪一章、鏡頭走到哪、3D 場上發生什麼、前景站哪幾件,
 * 全部是資料,不散在 CSS 與元件裡。要加一章或換一個世界,改這一份。
 *
 * 分工是硬的:**3D 只負責環境,不承載資訊**。捲軸、紅印、梅枝時程、報名印章
 * 全部是語意化 HTML 疊在畫布上 —— 沒有 WebGL 的人仍然讀得到全部比賽資訊。
 */

export type ChapterId = '01' | '02' | '03' | '04' | '05' | '06' | '07';

/** 五幕。章節歸幕,幕決定敘事的節奏,不決定畫面。 */
export type Act = '序幕' | '戰帖' | '賽制' | '承' | '啟';

export interface Chapter {
  id: ChapterId;
  /** section 的 id,也是 #錨點。 */
  anchor: string;
  /** 章名,兩個字,直排。 */
  name: string;
  act: Act;
  /** 場景:鏡頭看到的地方。 */
  scene: string;
  /** 這一章發生的事。 */
  action: string;
  /** 訪客要記住的那一件事 —— 每一章只有一件。 */
  remember: string;
}

export const CHAPTERS: readonly Chapter[] = [
  {
    id: '01',
    anchor: 'chapter-01',
    name: '殘旗',
    act: '序幕',
    scene: '武館前庭,殘旗掛在朽樑上,月在旗後',
    action: '旗後兩道身影對劍;劍鋒劃破旗面;血墨從裂口滲出;最後一滴落在枯梅上,梅開',
    remember: '比賽名稱',
  },
  {
    id: '02',
    anchor: 'chapter-02',
    name: '歸寂',
    act: '戰帖',
    scene: '傾斜牌樓,前方兩把劍插在地上',
    action: '人已離去,竹影掃過石階',
    remember: '這是什麼比賽',
  },
  {
    id: '03',
    anchor: 'chapter-03',
    name: '破頂',
    act: '賽制',
    scene: '大廳內,屋頂破洞,斷腿木桌',
    action: '一卷舊捲軸在桌面展開,竹影掃過紙面',
    remember: '組別、規則、評審',
  },
  {
    id: '04',
    anchor: 'chapter-04',
    name: '朱印',
    act: '承',
    scene: '剝漆木牆,梅枝從上角伸入',
    action: '紅印逐一蓋上木牆',
    remember: '獎金與獎品',
  },
  {
    id: '05',
    anchor: 'chapter-05',
    name: '花信',
    act: '承',
    scene: '橫貫畫面的梅枝',
    action: '每個日期是一朵花,到期綻放',
    remember: '報名、初賽、決賽日期',
  },
  {
    id: '06',
    anchor: 'chapter-06',
    name: '啟門',
    act: '啟',
    scene: '雙開木門微啟,月光從內照出',
    action: '印章按鈕:按下後紅墨暈開再沉入紙面',
    remember: '報名方式與截止日',
  },
  {
    id: '07',
    anchor: 'chapter-07',
    name: '落款',
    act: '啟',
    scene: '屋脊上兩道並肩背影望月',
    action: '風、髮絲、袖',
    remember: '主辦、合作、聯繫',
  },
];

export const CHAPTER_IDS: readonly ChapterId[] = CHAPTERS.map((c) => c.id);

export function chapterAfter(id: ChapterId): ChapterId | undefined {
  const i = CHAPTER_IDS.indexOf(id);
  return i < 0 ? undefined : CHAPTER_IDS[i + 1];
}

/**
 * 前景:釘在視窗底緣的 2D 去背素材。
 *
 * 規格要的十一件裡,`design/` 現在只有一部分 —— 缺的列在
 * notes/2026-09-13-劍塚-素材缺口.md,沒有的就不放,不拿別的頂替。
 */
export interface ForegroundPiece {
  /** world.json 裡的素材 id。 */
  asset: string;
  /** 從哪一邊進場。 */
  from: 'left' | 'right' | 'up';
  /** 貼著哪一邊。 */
  side: 'left' | 'right' | 'centre';
  /** 會不會被風吹。 */
  sways?: boolean;
}

export interface ChapterStage {
  chapter: ChapterId;
  pieces: readonly ForegroundPiece[];
}

export const STAGES: readonly ChapterStage[] = [
  {
    chapter: '01',
    pieces: [
      { asset: 'fg-snow-plum-branch', from: 'right', side: 'right', sways: true },
      { asset: 'fg-lantern', from: 'left', side: 'left' },
    ],
  },
  {
    chapter: '02',
    pieces: [
      { asset: 'fg-snow-bamboo', from: 'left', side: 'left', sways: true },
      { asset: 'fg-wood-railing', from: 'right', side: 'right' },
    ],
  },
  {
    chapter: '03',
    pieces: [{ asset: 'fg-war-table', from: 'up', side: 'centre' }],
  },
  {
    chapter: '04',
    pieces: [{ asset: 'fg-snow-plum-branch', from: 'up', side: 'right', sways: true }],
  },
  {
    chapter: '05',
    pieces: [{ asset: 'fg-snow-plum-branch', from: 'left', side: 'centre', sways: true }],
  },
  {
    chapter: '06',
    pieces: [{ asset: 'fg-lantern', from: 'right', side: 'right' }],
  },
  {
    chapter: '07',
    pieces: [
      { asset: 'fg-snow-bamboo', from: 'left', side: 'left', sways: true },
      { asset: 'fg-black-banner', from: 'right', side: 'right', sways: true },
    ],
  },
];

export function stageFor(id: ChapterId): ChapterStage | undefined {
  return STAGES.find((s) => s.chapter === id);
}
