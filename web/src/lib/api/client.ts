// 平台 API(hestia)的 client。
//
// 型別與 service 描述全部來自 gen/ —— 那是 `pnpm gen:api` 從 hestia/proto 生出來的。
// 這個檔案只做兩件事:設定 transport、把 service 綁成具名 client。
// 不在這裡宣告任何 request / response 的形狀(專案鐵則 6)。

import { createClient, type Client } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';

import { AdminEconomyService } from './gen/hestia/platform/v1/admin_economy_pb';
import { AuthService } from './gen/hestia/platform/v1/auth_pb';
import { DailyService } from './gen/hestia/platform/v1/daily_pb';
import { MeService } from './gen/hestia/platform/v1/me_pb';
import { ShopService } from './gen/hestia/platform/v1/shop_pb';

/**
 * 預設走同源 —— 瀏覽器打 Next 的 route handler(app/rpc/[...path]),
 * 由它轉給 hestia。這樣 cookie 是同源的,而且 hestia 不必對外開放。
 *
 * 前綴必須與那支 route handler 的路徑一致。不能用根目錄:Connect 的路徑是
 * `/<套件>.<服務>/<方法>`,掛在根目錄要一支 catch-all,會把頁面路由一起吃掉。
 */
const baseUrl = process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? '/api';

export const platformTransport = createConnectTransport({
  baseUrl,
  // 登入流程把 OAuth state 綁在 HttpOnly cookie 上(擋 login CSRF / session fixation)。
  // 少了這一行,CompleteDiscordLogin 永遠回 permission_denied。
  // 來源:hestia/proto/README.md「前端契約」。
  fetch: (input, init) => fetch(input, { ...init, credentials: 'include' }),
});

export const platformApi: {
  auth: Client<typeof AuthService>;
  me: Client<typeof MeService>;
  daily: Client<typeof DailyService>;
  shop: Client<typeof ShopService>;
  adminEconomy: Client<typeof AdminEconomyService>;
} = {
  auth: createClient(AuthService, platformTransport),
  me: createClient(MeService, platformTransport),
  daily: createClient(DailyService, platformTransport),
  shop: createClient(ShopService, platformTransport),
  adminEconomy: createClient(AdminEconomyService, platformTransport),
};
