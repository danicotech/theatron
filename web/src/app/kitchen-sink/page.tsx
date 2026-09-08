import { parseEventTheme } from '@theatron/ui';
import type { Metadata } from 'next';

import { KitchenSink } from './KitchenSink';
import themesJson from './themes.json';

export const metadata: Metadata = {
  title: 'kitchen sink · theatron',
};

// 主題是資料,不是程式碼 —— 所以連驗收用的主題也放 JSON,
// 跟平台之後從 tournaments.theme 回傳的東西同一個形狀。
const themes = themesJson.map(parseEventTheme);

export default function KitchenSinkPage() {
  return <KitchenSink themes={themes} />;
}
