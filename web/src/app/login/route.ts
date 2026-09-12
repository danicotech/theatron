import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';

/**
 * `/login` —— 從 Discord 點進來的登入入口。
 *
 * stentor 的 `/bind` 指令發出去的連結就是 `{WEB_BASE_URL}/login`:Discord bot
 * 沒辦法代使用者走 OAuth(state 綁在瀏覽器的 HttpOnly cookie 上,bot 代開的
 * 連結沒有那份 cookie),所以它只能給連結。
 *
 * 這條路原本由 hestia 的 loginshim.go 暫代 —— 那時前端還不存在。現在由這裡
 * 接手,**網址沒變**,所以已經發出去的連結不會壞。任何時刻只有一個實作。
 *
 * 查詢字串原封不動帶過去(`?redirect=…` 要留著)。**不在這裡驗 redirect**:
 * 伺服器端的 CleanRedirect 已經驗了,在這裡再寫一份規則,兩份遲早不一致 ——
 * 而不一致的那一份會是 open redirect 的破口。
 */
export function GET(req: NextRequest): never {
  const qs = req.nextUrl.search;
  redirect(`/api/auth/discord/start${qs}`);
}
