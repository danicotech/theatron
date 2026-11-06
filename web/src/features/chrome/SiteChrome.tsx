'use client';

import { useEffect } from 'react';
import { mountNavigation } from './navigationRuntime';
import { usePathname } from 'next/navigation';

import { mountHelpHints } from './helpHints';
import { Atmosphere } from './Atmosphere';
import { SiteNav } from './SiteNav';
import { mountInkWave } from './inkWave';

/** 原論劍與首頁在生成標記中掛載同一導覽；工具頁保留工具列並預留主導覽高度。 */
const OWN_CHROME = new Set(['/', '/home']);

export function SiteChrome() {
  const path = usePathname();
  useEffect(() => mountInkWave(), [path]);
  useEffect(() => mountHelpHints(), [path]);
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('header[data-site-nav]');
    return header ? mountNavigation(header) : undefined;
  }, [path]);
  if (OWN_CHROME.has(path)) return null;
  return (
    <div
      data-site-chrome
      data-page-nav-offset={path === '/loadout' || path === '/sportsbook' ? 'true' : undefined}
    >
      <SiteNav />
      {path !== '/loadout' && path !== '/sportsbook' ? <Atmosphere /> : null}
    </div>
  );
}
