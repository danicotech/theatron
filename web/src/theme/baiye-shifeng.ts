import { parseEventTheme, type EventTheme } from '@theatron/ui';

import raw from './baiye-shifeng.json';

/**
 * 《百業試鋒》的活動主題。
 *
 * 色值在 baiye-shifeng.json:主題是資料(theming.md),日後搬進 tournaments.theme
 * 時就是這一份 JSON 原樣進 DB;前端先把它當部署設定帶著。第 1 層的 hex 只能出現在
 * 主題資料裡,所以是 .json 而不是 .ts —— check-tokens 掃的是程式碼,不是資料。
 *
 * 色值取自 kage 的世界(references/kage-optimise):頁黑是墨、文字是骨白、
 * 「正在發生」是朱紅、錢是舊金。語意色的職責不動 —— 金仍然只代表錢,朱紅仍然只代表
 * 正在發生與危險。顯示字體換成 Noto Serif TC(狂草標題與告示紙是這個世界的字);
 * 內文與數字字體照規範不動。全直角:告示紙與賠率表都沒有圓角。
 */
export const baiyeShifengTheme: EventTheme = parseEventTheme(raw);
