import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { discordLoginHref, safeReturnPath } from '../../features/member/returnPath';

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
 * 以共用回程規則保留報名、注單或管理目的頁，授權後由 /auth/continue
 * 恢復會員身分。OAuth 失敗改回登入頁顯示錯誤，避免再次自動授權的迴圈。
 */
export function GET(req: NextRequest): never {
  const query = req.nextUrl.searchParams;
  const next = safeReturnPath(query.get('next') ?? query.get('redirect'));
  if (query.has('login_error')) {
    const slug = process.env.NEXT_PUBLIC_TOURNAMENT_SLUG;
    const params = new URLSearchParams({ login_error: 'oauth_failed' });
    if (next) params.set('next', next);
    redirect(slug ? `/t/${encodeURIComponent(slug)}/login?${params}` : '/judge/login');
  }
  redirect(discordLoginHref(next));
}
