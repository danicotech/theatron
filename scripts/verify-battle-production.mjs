// Production smoke test for the battle chapters: live routes, static art, real API state,
// no participant leak while unpublished, navigation on desktop and phone.
// Usage: node scripts/verify-battle-production.mjs [baseUrl] [outputDir]
import { chromium } from 'file:///C:/Users/daniel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const base = (process.argv[2] || 'http://127.0.0.1:3042').replace(/\/$/, '');
const output = process.argv[3]
  ? pathToFileURL(process.argv[3].replace(/[\\/]?$/, '/'))
  : new URL('../docs/battle-verification/production/', import.meta.url);
await mkdir(output, { recursive: true });
const results = [],
  errors = [],
  failed = new Set();
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
};
const shot = (page, name) =>
  page.screenshot({
    path: new URL(name + '.png', output).pathname.replace(/^\/(\w:)/, '$1'),
    fullPage: true,
  });
const status = async (path) => {
  const r = await fetch(base + path, { redirect: 'manual' });
  return r.status;
};
for (const path of [
  '/',
  '/?intro=0&stage=2d',
  '/lunjian/battle-view.js',
  '/lunjian/battle-model.js',
  '/lunjian/battle-art.css',
  '/battle-preview/assets/battle-mountain-candidate.webp',
  '/battle-preview/assets/battle-produced/a-paper-desktop-v1.webp',
  '/battle-preview/assets/champion-reference-v2/i-moon-ink-v2.webp',
  '/battle-preview/assets/raven.webp',
]) {
  const code = await status(path);
  check(`GET ${path}`, code === 200, String(code));
}
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => {
  if (r.status() >= 500) failed.add(r.status() + ' ' + r.url());
});
let bracket = null;
page.on('response', async (r) => {
  if (r.url().includes('GetBracket')) {
    try {
      bracket = await r.json();
    } catch {
      bracket = { unreadable: true };
    }
  }
});
await page.goto(`${base}/?intro=0&stage=2d#schedule`, {
  waitUntil: 'domcontentloaded',
  timeout: 120000,
});
await page.waitForFunction(() => !!window.__LUNJIAN, null, { timeout: 60000 });
await page.waitForTimeout(5000);
check('no 5xx responses on first visit', failed.size === 0, [...failed].join(', '));
check('no page errors', errors.length === 0, errors.join(' | '));
check(
  'site navigation wears the raven, timber frame and lantern',
  await page.evaluate(
    () =>
      !!document.querySelector('header[data-site-nav] .battle-nav-frame') &&
      getComputedStyle(document.querySelector('.battle-nav-raven')).backgroundImage.includes(
        'raven',
      ),
  ),
);
const state = await page.evaluate(() => {
  const host = document.querySelector('#bracket-host');
  const root = host?.querySelector('.battle-art-host')?.shadowRoot;
  return {
    battle: !!host?.classList.contains('battle-live') && !!root?.querySelector('.battle-scene'),
    // The full legacy tree stays underneath for the manager's seat editor.
    hasTree: !!host?.querySelector(
      'details.battle-results .tournament-tree, details.battle-results .tt-viewport, details.battle-results .tt-canvas',
    ),
    text: root?.textContent.replace(/\s+/g, ' ').slice(0, 160),
    // Shadow scene plus the light-DOM table and status line, in full, for the unpublished leak check.
    fullText: `${root?.textContent ?? ''} ${host?.textContent ?? ''}`,
  };
});
check(
  'approved A/B battle schedule is mounted, with the full bracket kept underneath',
  state.battle && state.hasTree,
  JSON.stringify({ ...state, fullText: undefined }),
);
const published = bracket && bracket.bracketPublished === true;
check(
  'bracket API answered',
  !!bracket,
  bracket ? (published ? 'published' : 'unpublished') : 'no GetBracket response captured',
);
if (bracket && !published) {
  const names = (bracket.players || []).map((p) => p.displayName).filter(Boolean);
  check(
    'no participant names on the page while unpublished',
    names.length === 0 || !names.some((n) => state.fullText.includes(n)),
    `${names.length} names in API`,
  );
}
await shot(page, 'schedule-desktop');
await page.evaluate(() => {
  location.hash = 'duel';
});
await page.waitForFunction(
  () =>
    document.querySelector('.chapter[data-on]')?.id === 'duel' &&
    !document.body.hasAttribute('data-cut'),
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
check(
  'duel chapter shows the silhouette arena with both figures (C–H battle art switched off)',
  await page.evaluate(() => {
    const vis = (el) =>
      !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';
    const sec = document.querySelector('#duel');
    return (
      !sec.classList.contains('battle-art-ready') &&
      !sec.querySelector('#battle-duel-host .battle-art-host') &&
      vis(sec.querySelector('.arena-composition')) &&
      sec.querySelectorAll('.duelist').length === 2
    );
  }),
);
await shot(page, 'duel-desktop');
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(800);
check(
  'phone has no horizontal overflow',
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
);
await page.click('header[data-site-nav] .lj-nav__toggle');
await page.waitForTimeout(500);
check(
  'phone navigation drawer opens',
  await page.evaluate(() => document.querySelector('#site-navigation-drawer')?.open === true),
);
await shot(page, 'phone-drawer');
await page.click('#site-navigation-drawer [data-nav-close]');
await page.evaluate(() => {
  location.hash = 'schedule';
});
await page.waitForTimeout(1500);
await shot(page, 'schedule-phone');
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__LUNJIAN, null, { timeout: 60000 });
await page.waitForTimeout(3000);
check(
  'reload keeps the page healthy',
  errors.length === 0 && failed.size === 0,
  [...failed].join(', ') + errors.join(' | '),
);
await writeFile(
  new URL('results.json', output),
  JSON.stringify(
    { base, at: new Date().toISOString(), results, errors, failed: [...failed] },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).map((r) => r.name),
  }),
);
if (results.some((r) => !r.ok)) process.exitCode = 1;
await browser.close();
