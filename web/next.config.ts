import type { NextConfig } from 'next';

/**
 * 開發環境把 /api/* 轉給 hestia。
 *
 * 正式環境**不會**用到這段:cloudflared 的 ingress 已經把
 * `arena.gengflow.com/api/*` 指向 hestia、其餘指向 theatron,
 * 所以 /api 的請求根本不會進到 Next。路由的權威在那份 ingress,
 * 這裡只是在本機補出同一個形狀 —— 開發機上 Next 與 hestia 是兩個 port,
 * 而 session cookie 是 HttpOnly + SameSite,跨來源送不出去。
 *
 * 少了這段,本機會出現「登入看起來成功,但每支 RPC 都當作沒登入」。
 */
function devRewrites() {
  const hestia = process.env.HESTIA_URL;
  if (hestia === undefined || hestia === '') return [];
  return [{ source: '/api/:path*', destination: `${hestia}/api/:path*` }];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // packages/ui 直接出 TypeScript 原始碼與 CSS Module,沒有建置步驟。
  // 少一層 build 就少一個「元件庫改了但沒重新 build」的失敗模式。
  transpilePackages: ['@theatron/ui'],
  rewrites: () => Promise.resolve(devRewrites()),
};

export default nextConfig;
