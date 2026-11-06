import { parseEventTheme, type EventTheme } from '@theatron/ui';

import raw from './lunjian.json';

/** DOM 色彩以 lunjian.json 為唯一來源；角色與使用規則見 docs/COLOR_SYSTEM.md。 */
export const lunjianTheme: EventTheme = parseEventTheme(raw);

/** 活動專屬語意 slot；保留通用 EventTheme 契約，元件不直接引用色值。 */
const EXTRA_SLOTS: readonly string[] = [
  'accent-info',
  'accent-action-primary',
  'accent-action-hover',
  'text-on-action',
  'accent-secondary',
  'accent-contrast',
  'accent-status-money',
  'state-status-live',
  'state-status-win',
  'text-equipment-muted',
  'state-equipment-win',
  'accent-equipment-blue',
  'accent-equipment-purple',
  'surface-scene-glass',
  'surface-scene-scrim',
  'surface-modal-scrim',
  'text-on-scene',
  'text-on-scene-muted',
  'accent-brand',
  'accent-brand-on-paper',
  'accent-brand-on-dark',
  'text-arena',
  'text-arena-muted',
  'border-arena',
  'surface-wood',
  'accent-blade',
  'accent-fire-char',
  'accent-fire-flame',
  'accent-fire-core',
  'accent-fire-soot',
  'accent-fire-smoke',
  'accent-fire-ash',
  'accent-bamboo',
  // 紙面。`semantic.css` 已經用中性階的兩端給了預設(任何主題都成立),
  // 這裡只是把它調成宣紙的暖白與墨的黑 —— 冷月白當紙會讓告示讀起來像塑膠。
  'surface-paper',
  'text-on-paper',
  'text-on-notice',
  'surface-notice',
  // 陣營辨識與勝敗狀態獨立。
  'accent-side-red',
  'accent-side-blue',
  // 共用淺色介面：油紙底、紙白卡片、深墨文字與朱紅操作色。
  'surface-auth-canvas',
  'surface-auth-paper',
  'surface-auth-field',
  'surface-dialogue',
  'text-auth-ink',
  'text-auth-muted',
  'border-auth',
  'accent-auth-action',
  'state-auth-ready',
];

/** 主題最終會變成注入頁面的 CSS,所以值進 <style> 之前要擋得住 `}` 跳出宣告區塊。 */
const SAFE = /^[A-Za-z0-9\s#%(),.'\-_]+$/;

export function lunjianExtraCss(): string {
  const extras = (raw as { extras: Record<string, string> }).extras;
  const declarations = EXTRA_SLOTS.map((slot) => {
    const value = (extras[slot] ?? '').trim();
    if (value === '' || !SAFE.test(value)) {
      throw new Error(`主題欄位 extras.${slot} 含有不能注入 CSS 的值`);
    }
    return `--${slot}:${value}`;
  });
  const dark = Object.entries(raw.darkExtras)
    .map(([slot, value]) => {
      if (!SAFE.test(value)) throw new Error('Invalid dark theme value');
      return '--' + slot + ':' + value;
    })
    .join(';');
  return (
    '[data-theme="' +
    lunjianTheme.id +
    '"]{' +
    declarations.join(';') +
    '}html[data-theme][data-color-mode="dark"]{' +
    dark +
    '}'
  );
}
