import { redirect } from 'next/navigation';

/**
 * 賽事底下的備戰方案 → 導到 `/loadout`。
 *
 * 為什麼是導過去而不是在這裡也擺一份：配置器沒有後端，方案存在瀏覽器裡，
 * 跟哪一場賽事無關。同一份東西掛兩個網址會讓人以為「賽事底下這份」
 * 跟報名資料有連動 —— 那件事還沒做。等它真的會存進報名，再把這裡改成真的頁面。
 */
export default function Page() {
  redirect('/loadout');
}
