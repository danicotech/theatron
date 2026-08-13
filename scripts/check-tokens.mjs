/**
 * theatron 的 custom lint。
 *
 * 這裡擋的三件事都不是風格潔癖,是三個功能的前提:
 *
 *   一次性 hex     → 只要有一個元件寫死 #241A30,它在新主題下就是一塊突兀的補丁,
 *                     「換主題不用重新部署」這個功能就死了。
 *   引用第 1 層     → 同上。第 1 層是主題會抽換的那一層,元件只能認語意 slot。
 *   ui 碰資料       → packages/ui 一旦知道 API 長什麼樣,它就綁死在這一場活動上。
 *
 * ESLint 管不到 CSS 字串裡的顏色,所以用這支腳本。
 * 規範本身見 .claude/skills/tournament-design-system/tokens.md。
 */

import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));

/** 第 1 層原始色階的名字。改色票的話這裡也要跟著改。 */
const RAW_SCALES = ['plum', 'amber', 'mint', 'rose'];

/** 各家 AI 設計的預設字體落點。出現代表沒有人做過選擇。 */
const BANNED_FONTS = [
  'Inter',
  'Geist',
  'DM Sans',
  'Roboto',
  'Space Grotesk',
  'Poppins',
  'Montserrat',
  'Instrument Serif',
  'Fraunces',
  'Playfair Display',
];

const RULES = [
  {
    name: '一次性 hex',
    pattern: /#[0-9a-fA-F]{3,8}\b/,
    // 第 1 層本來就該寫 hex,那是它的工作
    exempt: (file) => file.startsWith('packages/ui/src/tokens/'),
    why: '顏色只能來自語意 slot(--surface-*、--text-*、--accent-*、--state-*)。要新顏色先問人。',
  },
  {
    name: '引用第 1 層色階',
    pattern: new RegExp(`var\\(\\s*--(${RAW_SCALES.join('|')})-`),
    exempt: (file) => file.startsWith('packages/ui/src/tokens/'),
    why: '第 1 層是主題抽換的那一層。元件只能碰第 2 層,不然換主題會破版。',
  },
  {
    name: '禁用字體',
    pattern: new RegExp(`['"\`](${BANNED_FONTS.join('|')})['"\`]`, 'i'),
    exempt: () => false,
    why: '字體只有三個角色:--font-display / --font-body / --font-mono,不新增。',
  },
  {
    name: 'ui 層碰資料',
    pattern: /\bfetch\s*\(|\buseSWR\b|\buseQuery\b|from\s+['"].*\/(api|lib\/api)['"]/,
    exempt: (file) => !file.startsWith('packages/ui/'),
    why: 'packages/ui 只收 props。它一旦知道 API 長什麼樣,就綁死在這一場活動上了。',
  },
];

const patterns = ['packages/*/src/**/*.{ts,tsx,css}', 'web/src/**/*.{ts,tsx,css}'];
const files = patterns.flatMap((p) => globSync(p, { cwd: root }));
const violations = [];

for (const file of files) {
  const normalized = file.replaceAll('\\', '/');
  const lines = readFileSync(join(root, file), 'utf8').split('\n');
  lines.forEach((line, i) => {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    for (const rule of RULES) {
      if (rule.exempt(normalized)) continue;
      if (rule.pattern.test(line)) {
        violations.push({ file: normalized, line: i + 1, rule, text: trimmed });
      }
    }
  });
}

if (violations.length === 0) {
  console.log(`custom lint: 掃了 ${files.length} 個檔案,沒有違規`);
  process.exit(0);
}

console.error(`\ncustom lint 發現 ${violations.length} 處違規:\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  [${v.rule.name}]`);
  console.error(`    ${v.text}`);
  console.error(`    → ${v.rule.why}\n`);
}
console.error('先讀 .claude/skills/tournament-design-system/tokens.md,再決定要怎麼改。\n');
process.exit(1);
