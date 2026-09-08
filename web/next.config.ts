import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // packages/ui 直接出 TypeScript 原始碼與 CSS Module,沒有建置步驟。
  // 少一層 build 就少一個「元件庫改了但沒重新 build」的失敗模式。
  transpilePackages: ['@theatron/ui'],
};

export default nextConfig;
