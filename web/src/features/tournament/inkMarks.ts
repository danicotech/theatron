import { inkTitleProps } from '../../lib/world';

/**
 * 題字。賽事這一側用到的六幅毛筆字。
 *
 * 這裡只放**語意**:哪一幅字唸的是什麼。位址與長寬比由 `lib/world` 從素材清冊
 * 查出來 —— 那一份是全站共用的,不該有第二個查表。
 *
 * 為什麼「唸什麼」不放進清冊:清冊記的是檔案的事實(在哪、多大)。
 * 「ink-night-crow 唸夜鴉閣」是這個世界的知識,而同一幅字在別的地方可能
 * 只是裝飾、根本不該被唸出來。清冊不知道那件事,所以不猜。
 */
const LETTERING = {
  'ink-war-letter': '戰帖',
  'ink-rules': '賽制',
  'ink-schedule': '賽程',
  'ink-rewards': '獎賞',
  'ink-signup': '報名',
  'ink-night-crow': '夜鴉閣',
} as const;

export type InkMarkId = keyof typeof LETTERING;

/** 打錯字在這裡就會炸,不會等到瀏覽器去 404 —— id 是聯集型別,拼錯過不了型別檢查。 */
export function inkMark(id: InkMarkId) {
  return inkTitleProps(id, LETTERING[id]);
}
