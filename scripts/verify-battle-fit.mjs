// One-screen check for the two battle chapters (賽程 and 比武), in every state they can be in:
// unpublished, schedule layouts A/B/I/J and duel layouts C–H, at common screen sizes. The duel's C–H art is
// switched off (DUEL_BATTLE_ART in lunjian-layout.html), so the default run covers the schedule only;
// pass CASES=…,C,D,E,F,G,H after switching it back on.
//
// Landscape screens (desktop and tablet landscape) must show the whole chapter without scrolling:
// the scene, the refresh control and both chapter plaques stay inside the viewport. Portrait screens
// stack content and may scroll inside the chapter, but never sideways, and controls keep 44px targets.
//
// Usage: node scripts/verify-battle-fit.mjs [baseUrl] [outputDir]
//   SIZES=1920x911,1366x768  limits the sizes; CASES=live,A,C limits the states.
// Fixture names are placeholders injected under the slug "visual-test"; nothing is written to the API.
import { chromium } from 'file:///C:/Users/daniel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fixture } from './battle-fixture.mjs';

const base = (process.argv[2] || 'http://127.0.0.1:3042').replace(/\/$/, '');
const output = process.argv[3]
  ? pathToFileURL(process.argv[3].replace(/[\\/]?$/, '/'))
  : new URL('../docs/battle-verification/fit/', import.meta.url);
const sizes = (process.env.SIZES || '1920x911,1440x900,1366x768,1280x720,1024x768,768x1024,390x844')
  .split(',')
  .map((s) => s.split('x').map(Number));
const cases = (process.env.CASES || 'live,A,B,I,J').split(',');
const SCHEDULE = new Set(['live', 'A', 'B', 'I', 'J']);
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const failures = [];
const report = [];

for (const [width, height] of sizes) {
  const landscape = width > height;
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/?intro=0&stage=2d#schedule`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForFunction(() => !!window.__LUNJIAN, null, { timeout: 60000 });
  // Let the live bracket arrive first, so the unpublished state is the real one.
  await page.waitForTimeout(4000);
  for (const name of cases) {
    const chapter = SCHEDULE.has(name) ? 'schedule' : 'duel';
    if (name !== 'live') {
      await page.evaluate(
        ({ data, chapter }) => {
          // Freeze the live stream once, so later heartbeats cannot replace the fixture mid-check.
          if (!window.__fitFrozen) {
            const real = window.__LUNJIAN.updateTournament;
            window.__LUNJIAN.updateTournament = (view) => {
              if (view?.slug === 'visual-test') real(view);
            };
            window.__fitFrozen = true;
          }
          window.__LUNJIAN.updateTournament(data);
          if (chapter === 'duel') window.__LUNJIAN.selectDuelMatch(data.rounds[0].matches[0].id);
          else location.hash = 'schedule';
        },
        { data: fixture(name), chapter },
      );
    }
    if (process.env.VERBOSE) console.log('…', width + 'x' + height, name);
    await page.waitForFunction(
      ({ chapter, name }) => {
        const on = document.querySelector('.chapter[data-on]')?.id === chapter;
        if (!on || document.body.hasAttribute('data-cut')) return false;
        if (name === 'live') return !!document.querySelector('#bracket-host.battle-live');
        // The duel marks its layout on the inner art host; the schedule on #bracket-host.
        const host = chapter === 'duel' ? '#battle-duel-host .battle-art-host' : '#bracket-host';
        return document.querySelector(host)?.dataset.battleLayout === name;
      },
      { chapter, name },
      { timeout: 30000 },
    );
    // Fonts, images and the bracket line drawing settle.
    await page.waitForTimeout(1200);
    const m = await page.evaluate((chapter) => {
      const sticky = document.querySelector(`#${chapter} .chapter-sticky`);
      const box = (el) => {
        if (!el || el.hidden || !el.getClientRects().length) return null;
        const r = el.getBoundingClientRect();
        return {
          top: r.top,
          bottom: r.bottom,
          left: r.left,
          right: r.right,
          w: r.width,
          h: r.height,
        };
      };
      const refresh =
        chapter === 'schedule' ? box(document.querySelector('#schedule .schedule-refresh')) : null;
      const plaques = [...document.querySelectorAll(`#${chapter} .chapter-plaque`)]
        .map(box)
        .filter(Boolean);
      return {
        overflowY: sticky.scrollHeight - sticky.clientHeight,
        pageOverflowX: document.documentElement.scrollWidth - innerWidth,
        chapterOverflowX: sticky.scrollWidth - sticky.clientWidth,
        refresh,
        plaques,
        vh: innerHeight,
        vw: innerWidth,
      };
    }, chapter);
    const problems = [];
    if (m.pageOverflowX > 1 || m.chapterOverflowX > 1)
      problems.push(`scrolls sideways (${Math.max(m.pageOverflowX, m.chapterOverflowX)}px)`);
    if (landscape) {
      if (m.overflowY > 1) problems.push(`needs vertical scrolling (${m.overflowY}px)`);
      for (const [label, b] of [
        ['refresh', m.refresh],
        ...m.plaques.map((p, i) => [`plaque ${i + 1}`, p]),
      ]) {
        if (b && (b.bottom > m.vh + 1 || b.top < 0))
          problems.push(`${label} outside the screen (bottom ${Math.round(b.bottom)} of ${m.vh})`);
      }
    }
    for (const [label, b] of [
      ['refresh', m.refresh],
      ...m.plaques.map((p, i) => [`plaque ${i + 1}`, p]),
    ]) {
      if (b && (b.h < 44 || b.w < 44))
        problems.push(`${label} tap target ${Math.round(b.w)}x${Math.round(b.h)} under 44px`);
    }
    const tag = `${width}x${height} ${name}`;
    report.push({ case: tag, ...m, problems });
    if (problems.length) {
      failures.push(`${tag}: ${problems.join('; ')}`);
      await page.screenshot({
        path: new URL(`fail-${width}x${height}-${name}.png`, output).pathname.replace(
          /^\/(\w:)/,
          '$1',
        ),
      });
    }
  }
  if (errors.length) failures.push(`${width}x${height}: page errors: ${errors.join(' | ')}`);
  await page.close();
}
await browser.close();
await writeFile(new URL('fit-report.json', output), JSON.stringify(report, null, 1));
for (const line of failures) console.log('FAIL', line);
console.log(JSON.stringify({ checked: report.length, failed: failures.length }));
process.exitCode = failures.length ? 1 : 0;
