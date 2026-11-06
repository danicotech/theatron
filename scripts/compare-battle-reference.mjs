// Side-by-side: each approved reference panel next to the live render of the same layout.
// Usage: node scripts/compare-battle-reference.mjs [baseUrl] [outputDir] [studyDir]
import { chromium } from 'file:///C:/Users/daniel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fixture } from './battle-fixture.mjs';
const base = (process.argv[2] || 'http://127.0.0.1:3042').replace(/\/$/, '');
const output = pathToFileURL(
  (process.argv[3] || 'docs/battle-verification/compare').replace(/[\\/]?$/, '/'),
);
const study =
  process.argv[4] ||
  'C:/Users/daniel/.codex/.chatgpt-projects/g-p-6accc9140ad881918ef6aa0576d0076c/nav-schedule-preview/assets/battle-references';
const layouts = process.env.LAYOUTS || 'ABCDEFGHIJ';
const width = Number(process.env.WIDTH || 1440);
// Reference crops in sheet pixels: [sheet, x, y, w, h]. The label column on the left is excluded.
const crops = {
  A: ['AB.png', 165, 0, 1371, 505],
  B: ['AB.png', 165, 513, 1371, 511],
  C: ['CDEF.png', 0, 0, 766, 508],
  D: ['CDEF.png', 770, 0, 766, 508],
  E: ['CDEF.png', 0, 515, 766, 509],
  F: ['CDEF.png', 770, 515, 766, 509],
  G: ['GH.png', 152, 0, 1384, 468],
  H: ['GH.png', 152, 474, 1190, 550],
  I: ['IJ-approved-2026-10-29.png', 155, 0, 1381, 520],
  J: ['IJ-approved-2026-10-29.png', 155, 524, 1381, 500],
};
await mkdir(output, { recursive: true });
const shotPath = (name) => new URL(name, output).pathname.replace(/^\/(\w:)/, '$1');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width, height: 900 } });
await page.goto(`${base}/?intro=0&stage=2d#schedule`, {
  waitUntil: 'domcontentloaded',
  timeout: 120000,
});
await page.waitForFunction(() => !!window.__LUNJIAN);
await page.waitForTimeout(3500);
await page.evaluate(() => {
  document.documentElement.dataset.colorMode = 'dark';
  const real = window.__LUNJIAN.updateTournament;
  window.__LUNJIAN.updateTournament = (view) => {
    if (view?.slug === 'visual-test') real(view);
  };
});
for (const layout of layouts) {
  const data = fixture(layout);
  await page.evaluate(
    ({ data, layout }) => {
      window.__LUNJIAN.updateTournament(data);
      if ('CDEFGH'.includes(layout)) window.__LUNJIAN.selectDuelMatch(data.rounds[0].matches[0].id);
      else location.hash = 'schedule';
    },
    { data, layout },
  );
  await page.waitForFunction(
    (layout) => {
      const duel = 'CDEFGH'.includes(layout);
      const el = duel
        ? document.querySelector('#battle-duel-host .battle-art-host')
        : document.querySelector('#bracket-host');
      const chapter = document.querySelector('.chapter[data-on]')?.id;
      return (
        el?.dataset.battleLayout === layout &&
        !document.body.hasAttribute('data-cut') &&
        chapter === (duel ? 'duel' : 'schedule')
      );
    },
    layout,
    { timeout: 20000 },
  );
  await page.mouse.move(2, 890);
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(1200);
  await page.screenshot({ path: shotPath(`live-${layout}.png`) });
  const [sheet, x, y, w, h] = crops[layout];
  const ref = (await readFile(`${study}/${sheet}`)).toString('base64');
  const live = (await readFile(shotPath(`live-${layout}.png`))).toString('base64');
  const html = `<html><body style="margin:0;background:#111;color:#eee;font:14px sans-serif;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;width:1600px">
    <div><div>${layout} · 原稿</div><div style="width:792px;aspect-ratio:${w}/${h};background:url(data:image/png;base64,${ref}) no-repeat;background-size:${(1536 / w) * 792}px auto;background-position:-${(x / w) * 792}px -${(y / w) * 792}px"></div></div>
    <div><div>${layout} · 現況 ${width}px</div><img src="data:image/png;base64,${live}" style="width:792px;display:block"></div></body></html>`;
  await writeFile(new URL(`compare-${layout}.html`, output), html);
  const sheetPage = await browser.newPage({ viewport: { width: 1616, height: 600 } });
  await sheetPage.goto(new URL(`compare-${layout}.html`, output).href);
  await sheetPage.screenshot({ path: shotPath(`compare-${layout}.png`), fullPage: true });
  await sheetPage.close();
  console.log('compared', layout);
}
await browser.close();
