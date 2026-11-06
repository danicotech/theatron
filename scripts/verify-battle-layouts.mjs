// A–J battle layouts on the live page: layout selection, page errors, broken images and
// horizontal overflow at desktop, tablet and phone widths, in both colour modes.
// Usage: node scripts/verify-battle-layouts.mjs [baseUrl] [outputDir]
import { chromium } from 'file:///C:/Users/daniel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fixture } from './battle-fixture.mjs';
const base = process.argv[2] || 'http://127.0.0.1:3042';
const output = process.argv[3]
  ? pathToFileURL(process.argv[3].replace(/[\\/]?$/, '/'))
  : new URL('../docs/battle-verification/', import.meta.url);
const modes = (process.env.MODES || 'dark,light').split(',');
const widths = (process.env.WIDTHS || '1440,1024,390').split(',').map(Number);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/?intro=0&stage=2d#schedule`, {
  waitUntil: 'domcontentloaded',
  timeout: 120000,
});
await page.waitForFunction(() => !!window.__LUNJIAN);
// Let the realtime store publish the live bracket first, so a fixture is not overwritten by the first heartbeat.
await page.waitForTimeout(3500);
// Freeze the live stream: later heartbeats must not overwrite the injected fixture mid-check.
await page.evaluate(() => {
  const real = window.__LUNJIAN.updateTournament;
  window.__LUNJIAN.updateTournament = (view) => {
    if (view?.slug === 'visual-test') real(view);
  };
});
const report = [];
for (const mode of modes) {
  await page.evaluate((mode) => {
    document.documentElement.dataset.colorMode = mode;
  }, mode);
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
    for (const layout of 'ABCDEFGHIJ') {
      const data = fixture(layout);
      await page.evaluate(
        ({ data, layout }) => {
          window.__LUNJIAN.updateTournament(data);
          if ('CDEFGH'.includes(layout))
            window.__LUNJIAN.selectDuelMatch(data.rounds[0].matches[0].id);
          else location.hash = 'schedule';
        },
        { data, layout },
      );
      const selector = 'CDEFGH'.includes(layout)
        ? '#duel.battle-art-ready #battle-duel-host .battle-art-host'
        : '#bracket-host.battle-live';
      await page.waitForSelector(selector, { state: 'attached', timeout: 20000 });
      // Wait for the fixture itself (not the unpublished live bracket) and for the chapter cut to finish.
      await page.waitForFunction(
        (layout) => {
          const duel = 'CDEFGH'.includes(layout);
          const el = duel
            ? document.querySelector('#battle-duel-host .battle-art-host')
            : document.querySelector('#bracket-host');
          const root = duel ? el?.shadowRoot : el?.querySelector('.battle-art-host')?.shadowRoot;
          const chapter = document.querySelector('.chapter[data-on]')?.id;
          return (
            el?.dataset.battleLayout === layout &&
            root?.querySelector('.ab-tree, .champion-board, .scene-duel') &&
            !document.body.hasAttribute('data-cut') &&
            chapter === (duel ? 'duel' : 'schedule')
          );
        },
        layout,
        { timeout: 20000 },
      );
      await page.waitForTimeout(900);
      const state = await page.evaluate((layout) => {
        const el = 'CDEFGH'.includes(layout)
          ? document.querySelector('#battle-duel-host .battle-art-host')
          : document.querySelector('#bracket-host');
        const root = el.shadowRoot || el.querySelector('.battle-art-host')?.shadowRoot;
        const images = [...(root?.querySelectorAll('img') || [])];
        const rect = el.getBoundingClientRect();
        return {
          layout: el.dataset.battleLayout,
          rect: { w: Math.round(rect.width), h: Math.round(rect.height) },
          overflow: document.documentElement.scrollWidth > innerWidth + 2,
          assetFailures: images
            .filter((i) => i.complete && i.naturalWidth === 0)
            .map((i) => i.getAttribute('src')),
          pending: images.filter((i) => !i.complete).length,
          text: (root?.textContent || '').replace(/\s+/g, ' ').slice(0, 160),
        };
      }, layout);
      report.push({ expectedLayout: layout, mode, width, ...state });
      await page.screenshot({
        path: new URL(`${layout}-${width}-${mode}.png`, output).pathname.replace(/^\/(\w:)/, '$1'),
        fullPage: width < 1300,
      });
    }
  }
}
await writeFile(new URL('report.json', output), JSON.stringify({ base, report, errors }, null, 2));
const failures = report.filter(
  (r) => r.layout !== r.expectedLayout || r.overflow || r.assetFailures.length || r.rect.h < 200,
);
console.log(JSON.stringify({ cases: report.length, errors, failures }, null, 1));
if (errors.length || failures.length) process.exitCode = 1;
await browser.close();
