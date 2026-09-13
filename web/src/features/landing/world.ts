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

export function worldAsset(id: string): WorldAsset {
  const asset = byId.get(id);
  if (asset === undefined) throw new Error(`world.json 沒有這個素材:${id}`);
  return asset;
}
