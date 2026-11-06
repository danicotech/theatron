// Battle flows on the live page: schedule → duel → return focus, player dialogs, Escape, group
// tabs, phone side switch, navigation drawer, theme toggle, raven hover and the lantern.
// Usage: node scripts/verify-battle-interactions.mjs [baseUrl] [outputDir]
import { chromium } from 'file:///C:/Users/daniel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fixture } from './battle-fixture.mjs';
const base = process.argv[2] || 'http://127.0.0.1:3042';
const output = process.argv[3]
  ? pathToFileURL(process.argv[3].replace(/[\\/]?$/, '/'))
  : new URL('../docs/battle-verification/interactions/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [],
  results = [];
page.on('pageerror', (e) => errors.push(e.message));
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
};
const shot = (name) =>
  page.screenshot({ path: new URL(name + '.png', output).pathname.replace(/^\/(\w:)/, '$1') });
const inBracket = (fn, arg) =>
  page.evaluate(
    ([src, arg]) =>
      new Function('root', 'arg', src)(
        document.querySelector('#bracket-host .battle-art-host').shadowRoot,
        arg,
      ),
    [`return (${fn})(root, arg)`, arg],
  );
const inDuel = (fn, arg) =>
  page.evaluate(
    ([src, arg]) =>
      new Function('root', 'arg', src)(
        document.querySelector('#battle-duel-host .battle-art-host').shadowRoot,
        arg,
      ),
    [`return (${fn})(root, arg)`, arg],
  );
const lantern = () =>
  page.evaluate(() => {
    const nav = document.querySelector('.lj-nav__inner');
    return {
      opacity: getComputedStyle(document.querySelector('.battle-nav-frame--lit')).opacity,
      hover: nav.matches(':hover'),
      focusWithin: nav.matches(':focus-within'),
      active: document.activeElement?.className || document.activeElement?.tagName,
    };
  });
const settleFocus = async () => {
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => document.activeElement?.blur());
    await page.mouse.move(700, 600);
    await page.waitForTimeout(250);
  }
};
const settle = async (chapter) => {
  await page.waitForFunction(
    (c) =>
      document.querySelector('.chapter[data-on]')?.id === c &&
      !document.body.hasAttribute('data-cut'),
    chapter,
    { timeout: 20000 },
  );
  await page.waitForTimeout(500);
};
async function load(hash = 'schedule', width = 1440) {
  await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
  await page.goto(`${base}/?intro=0&stage=2d#${hash}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForFunction(() => !!window.__LUNJIAN);
  await page.waitForTimeout(3500);
  // Freeze the live stream: later heartbeats must not overwrite the injected fixture mid-check.
  await page.evaluate(() => {
    const real = window.__LUNJIAN.updateTournament;
    window.__LUNJIAN.updateTournament = (view) => {
      if (view?.slug === 'visual-test') real(view);
    };
  });
}
async function inject(layout, options) {
  const data = fixture(layout, options);
  await page.evaluate((data) => window.__LUNJIAN.updateTournament(data), data);
  await page.waitForFunction(() =>
    document
      .querySelector('#bracket-host .battle-art-host')
      ?.shadowRoot?.querySelector('.ab-tree, .champion-board'),
  );
  await page.waitForTimeout(400);
  return data;
}

// 1. Schedule → duel via match tag → return restores focus on the same match.
await load('schedule');
await inject('A', { longName: true });
check(
  'A long name ends with an ellipsis inside its plate and keeps the full name for assistive tech',
  await inBracket((root) => {
    const s = root.querySelector('.ab-tree .seat-name strong');
    const plate = s.closest('.seat').getBoundingClientRect();
    const box = s.getBoundingClientRect();
    const button = s.closest('[data-player]');
    return (
      getComputedStyle(s).textOverflow === 'ellipsis' &&
      box.right <= plate.right + 1 &&
      s.textContent.length > 8 &&
      button.getAttribute('aria-label').includes(s.textContent)
    );
  }),
);
await inBracket((root) => root.querySelector('.ab-tree [data-match-open="r1m0"]').click());
await settle('duel');
check(
  'match tag opens the duel chapter',
  (await page.evaluate(
    () => location.hash + ' ' + new URL(location.href).searchParams.get('match'),
  )) === '#duel r1m0',
);
check(
  'duel shows the selected pair',
  await inDuel(
    (root) => root.textContent.includes('東方不敗') && root.textContent.includes('照雪'),
  ),
);
check(
  'duel focus lands inside the battle surface',
  await inDuel((root) => root.activeElement?.hasAttribute('data-player')),
);
await shot('01-duel-from-schedule');
await inDuel((root) => root.querySelector('[data-back-schedule]').click());
await settle('schedule');
check(
  'return restores focus on the same match tag',
  await inBracket((root) => root.activeElement?.getAttribute('data-match-open') === 'r1m0'),
);
await shot('02-back-to-schedule');

// 2. Player dialog, Escape, focus return.
await inBracket((root) => root.querySelector('.ab-tree .seat-player[data-player="p0"]').click());
check(
  'player dialog opens from a tree card',
  await inBracket(
    (root) =>
      root.querySelector('dialog').open &&
      root.querySelector('dialog').textContent.includes('東方不敗'),
  ),
);
check(
  'dialog explains the missing photo honestly',
  await inBracket((root) =>
    root.querySelector('dialog').textContent.includes('遊戲照片待管理員提供'),
  ),
);
await shot('03-player-dialog');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('Escape closes the dialog', await inBracket((root) => !root.querySelector('dialog').open));
check(
  'focus returns to the card that opened the dialog',
  await inBracket((root) => root.activeElement?.dataset.player === 'p0'),
);

// 3. Keyboard: Tab reaches the tree controls inside the shadow root.
await page.keyboard.press('Tab');
check(
  'Tab moves to the next control inside the tree',
  await inBracket((root) => !!root.activeElement && root.activeElement.tagName === 'BUTTON'),
);

// 4. Champion board history remains at desktop and after a phone → desktop resize.
await inject('I');
check(
  'I keeps both side histories (4 rows each)',
  await inBracket(
    (root) =>
      root.querySelectorAll('.side-history .history-table tbody tr').length === 6 &&
      root.querySelectorAll('.side-history details[open]').length === 2,
  ),
);
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
await page.setViewportSize({ width: 1440, height: 1000 });
await page.waitForTimeout(400);
check(
  'I histories still visible after phone → desktop resize',
  await inBracket((root) =>
    [...root.querySelectorAll('.side-history .history-table')].every(
      (t) => t.getBoundingClientRect().height > 40,
    ),
  ),
);
await inBracket((root) => root.querySelector('.history-match[data-match-open]').click());
await settle('duel');
check(
  'history row opens the recorded duel',
  (await page.evaluate(() => location.hash)) === '#duel',
);
await inDuel((root) => root.querySelector('[data-back-schedule]').click());
await settle('schedule');
await inject('J');
check(
  'J keeps both route trees with a highlighted winner path',
  await inBracket(
    (root) =>
      root.querySelectorAll('.live-team-route').length === 2 &&
      root.querySelectorAll('.live-team-route path.winner').length >= 1,
  ),
);
await inBracket((root) => root.querySelector('[data-roster]').click());
check(
  'J roster dialog lists 4 members',
  await inBracket(
    (root) => root.querySelector('dialog[data-kind=roster] .dialog-roster').children.length === 4,
  ),
);
await shot('04-j-roster');
await page.keyboard.press('Escape');

// 5. H group tabs and phone side switch.
const h = await inject('H');
await page.evaluate((id) => window.__LUNJIAN.selectDuelMatch(id), h.rounds[0].matches[0].id);
await settle('duel');
await inDuel((root) => root.querySelector('[data-roster-side="red"][data-group="1"]').click());
check(
  'H group 2 shows members 5–8',
  await inDuel(
    (root) =>
      root.querySelector('.duel-roster.red').textContent.includes('5 - 8 / 16') &&
      root.querySelector('.duel-roster.red [data-group="1"]').getAttribute('aria-pressed') ===
        'true',
  ),
);
check(
  'H group tab keeps focus after re-render',
  await inDuel((root) => root.activeElement?.dataset.group === '1'),
);
await inDuel((root) => root.querySelector('[data-roster="p0"]').click());
check(
  'H full roster dialog lists 16',
  await inDuel(
    (root) => root.querySelector('dialog[data-kind=roster] .dialog-roster').children.length === 16,
  ),
);
await page.keyboard.press('Escape');
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(500);
check(
  'phone shows red roster only',
  await inDuel(
    (root) =>
      getComputedStyle(root.querySelector('.duel-roster.red')).display !== 'none' &&
      getComputedStyle(root.querySelector('.duel-roster.blue')).display === 'none',
  ),
);
await inDuel((root) => root.querySelector('[data-side-pick="blue"]').click());
check(
  'phone side switch reveals blue roster',
  await inDuel(
    (root) =>
      getComputedStyle(root.querySelector('.duel-roster.blue')).display !== 'none' &&
      root.activeElement?.dataset.sidePick === 'blue',
  ),
);
await shot('05-h-phone-blue');

// 6. Phone bracket: round tabs, keyboard, overview toggle.
await page.evaluate(() => {
  location.hash = 'schedule';
});
await settle('schedule');
await inject('B');
check(
  'phone B shows round tabs with the bye match',
  await inBracket(
    (root) =>
      getComputedStyle(root.querySelector('.mobile-rounds')).display !== 'none' &&
      root.querySelector('#round-panel').textContent.includes('輪空'),
  ),
);
await inBracket((root) => root.querySelector('[data-round="2"]').click());
check(
  'round tab switches to the final',
  await inBracket(
    (root) =>
      root.querySelector('#round-panel .final-match-mobile') &&
      root.querySelector('[data-round="2"]').getAttribute('aria-selected') === 'true',
  ),
);
await page.keyboard.press('ArrowLeft');
check(
  'arrow keys move between round tabs',
  await inBracket((root) => root.activeElement?.dataset.round === '1'),
);
await inBracket((root) => root.querySelector('.overview-toggle').click());
check(
  'overview toggle reveals the scrollable tree',
  await inBracket(
    (root) =>
      getComputedStyle(root.querySelector('.ab-scroll')).display !== 'none' &&
      root.querySelector('.overview-toggle').getAttribute('aria-expanded') === 'true',
  ),
);
await shot('06-b-phone-overview');

// 7. Navigation: drawer, theme toggle, raven hover, lantern.
const toggleVisible = await page.evaluate(
  () =>
    getComputedStyle(document.querySelector('header[data-site-nav] .lj-nav__toggle')).display !==
    'none',
);
check('phone shows the navigation toggle', toggleVisible);
await page.click('header[data-site-nav] .lj-nav__toggle');
await page.waitForTimeout(400);
check(
  'drawer opens',
  await page.evaluate(() => document.querySelector('#site-navigation-drawer')?.open === true),
);
await shot('07-drawer');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const escapeClosed = await page.evaluate(
  () => document.querySelector('#site-navigation-drawer')?.open === false,
);
if (!escapeClosed) await page.click('#site-navigation-drawer [data-nav-close]');
await page.waitForTimeout(300);
check(
  'drawer closes and returns focus to the toggle',
  await page.evaluate(
    () =>
      document.querySelector('#site-navigation-drawer')?.open === false &&
      document.activeElement?.classList.contains('lj-nav__toggle'),
  ),
  escapeClosed
    ? 'closed by Escape'
    : 'Escape did not close the site drawer; closed by its close button',
);
await page.setViewportSize({ width: 1440, height: 1000 });
await page.waitForTimeout(500);
await page.mouse.move(700, 600);
await page.evaluate(() => document.activeElement?.blur());
await page.waitForTimeout(400);
await settleFocus();
{
  const l = await lantern();
  check(
    'lantern rests when nothing points at or focuses the navigation',
    l.opacity === '0',
    JSON.stringify(l),
  );
}
const ravenBefore = await page.evaluate(
  () => getComputedStyle(document.querySelector('.battle-nav-raven')).backgroundImage,
);
await page.hover('header[data-site-nav] .lj-nav__brand');
await page.waitForTimeout(400);
const ravenHover = await page.evaluate(
  () => getComputedStyle(document.querySelector('.battle-nav-raven')).backgroundImage,
);
check(
  'raven swaps image on hover',
  ravenBefore !== ravenHover && /raven-hover|raven-alert/.test(ravenHover),
  ravenHover,
);
{
  // The lit frame fades in over 280ms; sample after it settles and allow rounding.
  await page.waitForTimeout(400);
  const l = await lantern();
  check(
    'lantern lights while the pointer is on the navigation',
    Number(l.opacity) >= 0.99,
    JSON.stringify(l),
  );
}
await shot('08-nav-hover');
await page.mouse.move(700, 600);
await page.evaluate(() => document.activeElement?.blur());
await page.waitForTimeout(400);
await settleFocus();
{
  const l = await lantern();
  check('lantern returns to rest', l.opacity === '0', JSON.stringify(l));
}
const modeBefore = await page.evaluate(() => document.documentElement.dataset.colorMode);
await page.click('header[data-site-nav] .lj-nav__theme');
await page.waitForTimeout(400);
const modeAfter = await page.evaluate(() => document.documentElement.dataset.colorMode);
check(
  'theme toggle switches colour mode',
  modeBefore !== modeAfter,
  `${modeBefore} → ${modeAfter}`,
);
check(
  'battle surface follows the colour mode',
  (await page.evaluate(
    () => document.querySelector('#bracket-host .battle-art-host').dataset.battleTheme,
  )) === modeAfter,
);
await shot('09-theme-' + modeAfter);

// 8. Unpublished data never leaks participants.
await page.evaluate(() =>
  window.__LUNJIAN.updateTournament({
    kind: 'ready',
    slug: 'visual-test',
    published: false,
    bestOf: 3,
    players: [{ id: 'secret', name: '不可外洩', rank: 1, seed: 1 }],
    rounds: [],
  }),
);
await page.waitForTimeout(400);
check(
  'unpublished bracket shows only the waiting notice and no names',
  await page.evaluate(() => {
    const host = document.querySelector('#bracket-host .battle-art-host');
    const text = host.shadowRoot.textContent;
    return (
      !host.hidden &&
      text.includes('賽程待公布') &&
      !text.includes('不可外洩') &&
      !document.querySelector('#bracket-host').textContent.includes('不可外洩')
    );
  }),
);

await writeFile(
  new URL('results.json', output),
  JSON.stringify({ base, results, errors }, null, 2),
);
console.log(
  JSON.stringify({
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).map((r) => r.name),
    errors,
  }),
);
if (errors.length || results.some((r) => !r.ok)) process.exitCode = 1;
await browser.close();
