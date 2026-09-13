/**
 * 首頁的章節帳冊(kage 的 scene ledger)。
 *
 * 誰在哪一章、背景換哪張圖、近景站哪幾件,全部是資料,不散在 CSS 與元件裡。
 * 第二場活動要換世界時改這一份;3D 場景接手時 SceneLayer 換掉,這份契約不動。
 */
export type ChapterId = '00' | '01' | '02' | '03' | '04';

export interface Chapter {
  id: ChapterId;
  /** section 的 id,也是 #錨點。 */
  anchor: string;
  /** 章節以「壹貳參肆」計(vernacular.md);序章沒有數字。 */
  mark: string;
  label: string;
  /** 章節目錄裡的一句話。 */
  line: string;
}

export const CHAPTERS: readonly Chapter[] = [
  { id: '00', anchor: 'chapter-00', mark: '序', label: '序', line: '百業社群的內部 PVP 賽事。' },
  { id: '01', anchor: 'chapter-01', mark: '壹', label: '讓武', line: '段位差越大,BP 越多。' },
  { id: '02', anchor: 'chapter-02', mark: '貳', label: '段位', line: '開山、斷水、飛花、無我。' },
  { id: '03', anchor: 'chapter-03', mark: '參', label: '賽程', line: '從報名到開打的六步。' },
  { id: '04', anchor: 'chapter-04', mark: '肆', label: '赴約', line: '本屆的入口在這裡。' },
];

/** 大氣層的角色決定它怎麼動:月亮不動、雪與花瓣飄、劍光只亮一次。 */
export type FxRole = 'moon' | 'snow' | 'petals' | 'glint';

export interface ScenePlate {
  chapter: ChapterId;
  /** 背景圖的素材 id。兩章共用同一張時不會交叉淡出,只是留著。 */
  plate: string;
  fx?: ReadonlyArray<{ asset: string; role: FxRole }>;
}

/**
 * 背景:夜院 → 崖上木堂 → 雪場 → 春秋小築 → 回到夜院。
 * 結尾回到開場那座院子是刻意的:走一圈,門就在起點。
 */
export const SCENE: readonly ScenePlate[] = [
  { chapter: '00', plate: 'bg-night-crow-courtyard', fx: [{ asset: 'fx-moon', role: 'moon' }] },
  { chapter: '01', plate: 'bg-cliff-timber-hall' },
  { chapter: '02', plate: 'bg-snow-arena', fx: [{ asset: 'fx-snow-near', role: 'snow' }] },
  {
    chapter: '03',
    plate: 'bg-spring-autumn-lodge',
    fx: [{ asset: 'fx-plum-petals', role: 'petals' }],
  },
  {
    chapter: '04',
    plate: 'bg-night-crow-courtyard',
    fx: [{ asset: 'fx-blade-glint', role: 'glint' }],
  },
];

export interface StagePiece {
  asset: string;
  /** 對應 ForegroundStage.module.css 裡的擺位 class。 */
  slot: string;
  /** 從哪一邊進場。每件都從底緣量起,只差左右。 */
  enter: 'left' | 'right' | 'up';
}

/**
 * 近景:每章站在鏡頭與文字之間的去背素材。
 * 旗幟的布往旗竿的另一側飄,所以白旗站左、黑旗站右,布都往中間吹。
 */
export const STAGES: Readonly<Record<ChapterId, readonly StagePiece[]>> = {
  '00': [
    { asset: 'fg-lantern', slot: 'lantern', enter: 'left' },
    { asset: 'fg-snow-plum-branch', slot: 'plum', enter: 'right' },
  ],
  '01': [
    { asset: 'fg-brazier', slot: 'brazier', enter: 'left' },
    { asset: 'fg-wood-railing', slot: 'railing', enter: 'right' },
  ],
  '02': [{ asset: 'fg-snow-bamboo', slot: 'bamboo', enter: 'left' }],
  '03': [
    { asset: 'fg-white-banner', slot: 'bannerWhite', enter: 'left' },
    { asset: 'fg-black-banner', slot: 'bannerBlack', enter: 'right' },
  ],
  '04': [{ asset: 'arch-arena-gate', slot: 'gate', enter: 'up' }],
};

export function chapterAfter(id: ChapterId): ChapterId | undefined {
  const i = CHAPTERS.findIndex((c) => c.id === id);
  return CHAPTERS[i + 1]?.id;
}
