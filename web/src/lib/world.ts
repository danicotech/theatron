import manifest from '../../public/world/world.json';

/**
 * 世界素材的清冊 —— 全站唯一的查表。
 *
 * 只認 `public/world/world.json`:路徑、尺寸、有沒有 alpha 都由它說了算。
 * 元件不自己寫 width/height —— 一換圖就對不上,而對不上的代價是版面跳動。
 *
 * 為什麼在 `lib/` 而不是某個 feature 裡:首頁與賽事系統都要查同一份清冊。
 * 先前兩邊各有一份查表(`features/landing/world.ts` 與
 * `features/tournament/inkMarks.ts`),而那是同一個概念的兩個家。
 * 語意的部分(哪一件是近景、哪一幅字唸什麼)仍然留在各自的 feature ——
 * 這一層只回答「這個 id 的檔案在哪、多大」。
 */
export interface WorldAsset {
  id: string;
  file: string;
  width: number;
  height: number;
  alpha: boolean;
}

const byId = new Map<string, WorldAsset>(manifest.assets.map((a) => [a.id, a]));

/** 一定要有的素材。打錯字在這裡就會炸,不會等到瀏覽器去 404。 */
export function worldAsset(id: string): WorldAsset {
  const asset = byId.get(id);
  if (asset === undefined) throw new Error(`world.json 沒有這個素材:${id}`);
  return asset;
}

/**
 * 可能還沒有的素材。
 *
 * 近景帳冊列的件數比 `design/` 實際交出來的多。帳冊是規格、不是庫存,
 * 所以它列了還沒有的東西是對的 —— 缺的那一件**不放**,也不拿別的頂替
 * (`features/landing/foreground.ts` 自己這樣寫)。
 * 會炸的 `worldAsset` 在這裡是錯的工具:少一件近景不該讓整頁白掉。
 */
export function findWorldAsset(id: string): WorldAsset | undefined {
  return byId.get(id);
}

/**
 * 題字素材 → `InkTitle` 要的三個值。
 *
 * `packages/ui` 不知道清冊長什麼樣,也不該知道 —— 它只收一個能放進 `url()`
 * 的位址與長寬比。把 id 換成那些值是這一層的事。
 *
 * `text` 由呼叫端給:同一幅字在不同地方唸的可能不一樣(章節題字唸的是它寫的字,
 * 而某些地方它只是裝飾)。清冊不知道那件事,所以不猜。
 */
export function inkTitleProps(
  id: string,
  text: string,
): { src: string; text: string; ratio: number } {
  const a = worldAsset(id);
  return { src: a.file, text, ratio: a.width / a.height };
}
