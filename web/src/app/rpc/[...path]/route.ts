// ConnectRPC 的同源代理:瀏覽器打這裡,這裡轉給 hestia。
//
// # 為什麼要這一層
//
// 專案鐵則 2:只有 hestia 有 DB 憑證,它不該對外開放。瀏覽器直接打 hestia
// 還會讓 cookie 變成跨站 —— 登入用的 session cookie 是 HttpOnly + SameSite,
// 跨站送不出去,結果是「登入看起來成功,但每一支 RPC 都當作沒登入」。
//
// 所以路徑是:瀏覽器 → Next(同源,cookie 自然帶上)→ hestia(容器內網)。
// HESTIA_URL 沒有 NEXT_PUBLIC_ 前綴是刻意的:它只能在伺服器端讀得到,
// 不會被打包進送給瀏覽器的 JS。
//
// # 為什麼掛在 /rpc 而不是根目錄
//
// Connect 的路徑是 `/<套件>.<服務>/<方法>`,掛在根目錄就要一支 catch-all,
// 那會把所有頁面路由一起吃掉。前綴在 client 那側設定(lib/api/client.ts),
// 兩邊必須一致。
//
// # 串流
//
// WatchService 是 server streaming,回應的 body 必須原樣串過去、不可先收完
// 再轉發 —— 收完才轉的話「即時戰況」會變成「比賽結束後一次全到」。
// 下面直接把 upstream 的 body 交給 Response,不碰它。

import { NextResponse, type NextRequest } from 'next/server';

/** 串流不能靜態化,也不能被快取。 */
export const dynamic = 'force-dynamic';

const upstream = process.env.HESTIA_URL ?? 'http://localhost:8088';
const basePath = process.env.HESTIA_BASE_PATH ?? '/api';

/**
 * 逐跳標頭(hop-by-hop)不能轉發:它們描述的是「這一段連線」,
 * 不是訊息本身。轉發 connection / keep-alive 會讓 undici 直接拒絕請求。
 *
 * content-length 也要拿掉:body 轉發後長度可能改變(壓縮、chunked),
 * 留著舊的長度會讓 upstream 讀到截斷的 body。
 */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'host',
]);

function forwardHeaders(src: Headers): Headers {
  const out = new Headers();
  src.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      out.set(key, value);
    }
  });
  return out;
}

async function proxy(req: NextRequest, path: string[]): Promise<Response> {
  // path 直接來自網址。`..` 會讓它指到 hestia 上別的端點,所以逐段擋掉。
  if (path.some((seg) => seg === '' || seg === '.' || seg === '..' || seg.includes('/'))) {
    return NextResponse.json({ code: 'invalid_argument', message: '路徑不合法' }, { status: 400 });
  }
  const target = `${upstream}${basePath}/${path.join('/')}${req.nextUrl.search}`;

  let res: Response;
  try {
    res = await fetch(target, {
      method: req.method,
      headers: forwardHeaders(req.headers),
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
      // 送 ReadableStream 當 body 時 fetch 規格要求宣告 duplex。
      ...(req.method === 'GET' || req.method === 'HEAD' ? {} : { duplex: 'half' }),
      redirect: 'manual',
      cache: 'no-store',
    } as RequestInit);
  } catch {
    // upstream 連不上。回 Connect 認得的形狀,而不是 Next 的 HTML 錯誤頁 ——
    // 否則 client 會拿到一段 HTML 去 JSON.parse,錯誤訊息完全看不出成因。
    return NextResponse.json({ code: 'unavailable', message: '連不上賽事伺服器' }, { status: 503 });
  }

  // 回應標頭要原樣帶回:Connect 的錯誤成因放在 Hestia-Error-Reason,
  // 登入的 session 放在 Set-Cookie,兩者都在標頭裡。
  const headers = forwardHeaders(res.headers);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params;
  return proxy(req, path);
}

/** Connect 允許對唯讀方法用 GET(帶 query 的那種)。 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params;
  return proxy(req, path);
}
