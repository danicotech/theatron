'use client';

import { usePathname } from 'next/navigation';

import { Atmosphere } from './Atmosphere';
import { SiteNav } from './SiteNav';

/**
 * theatron 自己的頁首與氛圍層 —— 自帶頁首的那幾頁以外的每一頁。
 *
 * 首頁（`app/lunjianMarkup.ts`）與備戰方案（`app/loadout/loadoutMarkup.ts`）
 * 都是從 lab 生成的**整頁**版面，各自帶著品牌字、工具列與狀態列。
 * 再疊一層 theatron 的導覽列就是兩套頁首打架：同一個位置兩條橫線、
 * 兩組品牌字、tab 兩次才進得了內容 —— 而且上面那條會**蓋住底下那排按鈕**，
 * 備戰方案的「匯出 JSON」就是這樣點不到的。
 *
 * 判斷放在客戶端而不是拆 route group：拆 group 要動到 /t、/judge、/login
 * 四個 layout 的檔案位置，改動面比這一個檔案大得多，而換到的只是同一件事。
 */
const OWN_CHROME = new Set(['/', '/home', '/loadout', '/sportsbook']);

export function SiteChrome() {
  const path = usePathname();
  if (OWN_CHROME.has(path)) return null;
  return (
    <>
      <SiteNav />
      <Atmosphere />
    </>
  );
}
