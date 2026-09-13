import manifest from '../../../public/world/world.json';

/**
 * 世界素材的清冊。
 *
 * 只認 public/world/world.json:路徑、尺寸、有沒有 alpha 都由它說了算。
 * 元件不自己寫 width/height —— 一換圖就對不上,而對不上的代價是版面跳動。
 * id 打錯字在這裡就會炸,不會等到瀏覽器去 404。
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
 * 章節帳冊列的前景件數比 `design/` 實際交出來的多(素材缺口第三節,`fg-war-table`
 * 就是其中一件)。帳冊是規格、不是庫存,所以它列了還沒有的東西是對的 ——
 * 缺的那一件**不放**,也不拿別的頂替(chapters.ts 自己這樣寫)。
 * 會炸的 `worldAsset` 在這裡是錯的工具:少一件近景不該讓整頁白掉。
 */
export function findWorldAsset(id: string): WorldAsset | undefined {
  return byId.get(id);
}
