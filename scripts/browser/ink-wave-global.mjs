import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fixture, inspect } from './ink-wave-fixture.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.ARTIFACT_DIR || path.join(os.tmpdir(), 'theatron-ink-audit');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const base = process.env.AUDIT_URL || 'http://localhost:3014';
  const report = [];
  for (const width of [1247, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: 884 },
      reducedMotion: 'reduce',
    });
    for (const route of [
      '/home?intro=0&stage=2d',
      '/?intro=0&stage=2d#prologue',
      '/?intro=0&stage=2d#rules',
      '/?intro=0&stage=2d#invitation',
      '/?intro=0&stage=2d#register',
      '/?intro=0&stage=2d#duel',
      '/?intro=0&stage=2d#schedule',
      '/?intro=0&stage=2d#rewards',
      '/loadout',
      '/kitchen-sink',
      '/t/2026-baiye-shifeng/login',
    ]) {
      await page.goto(base + route);
      await page.waitForTimeout(550);
      await page.evaluate('window.auditInspect=' + inspect.toString());
      for (const mode of ['light', 'dark']) {
        await page.evaluate((m) => (document.documentElement.dataset.colorMode = m), mode);
        await page.waitForTimeout(30);
        const rows = await page.evaluate(() => {
          const rows = [];
          for (const el of document.querySelectorAll('button,summary,a[href]')) {
            if (
              el.closest('.ink-g-layer') ||
              !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) ||
              el.getBoundingClientRect().width === 0
            )
              continue;
            el.dispatchEvent(
              new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }),
            );
            const result = window.auditInspect(el);
            if (result) {
              rows.push({ ...result, tag: el.tagName, className: el.className });
              el.dispatchEvent(
                new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse' }),
              );
            }
          }
          return rows;
        });
        report.push({ width, route, mode, rows });
      }
      console.log(width, route, 'checked');
    }
    await page.goto(base + '/?intro=0&stage=2d#register');
    await page.waitForTimeout(550);
    await fixture(page);
    await page.evaluate('window.auditInspect=' + inspect.toString());
    for (const mode of ['light', 'dark']) {
      await page.evaluate((m) => (document.documentElement.dataset.colorMode = m), mode);
      await page.waitForTimeout(20);
      for (const variant of ['default', 'primary', 'secondary', 'money', 'danger', 'selected']) {
        await page.evaluate((v) => {
          const b = document.querySelector('#wave-audit-fixture button');
          b.dataset.inkVariant = v;
          b.setAttribute('aria-pressed', v === 'selected' ? 'true' : 'false');
          return null;
        }, variant);
        await page.waitForTimeout(20);
        const row = await page.evaluate(() => {
          const b = document.querySelector('#wave-audit-fixture button');
          b.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
          const row = window.auditInspect(b);
          b.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse' }));
          return row;
        });
        report.push({ width, route: 'fixture:' + variant, mode, rows: [row] });
      }
    }
    await page.close();
  }
  const fails = report.flatMap((r) =>
    r.rows.flatMap((row) =>
      row.items
        .filter((i) => i.ratio < 4.5)
        .map((i) => ({ width: r.width, route: r.route, mode: r.mode, control: row.text, ...i })),
    ),
  );
  fs.writeFileSync(
    output + '/wave-global-' + (process.env.AUDIT_URL ? 'live' : 'local') + '.json',
    JSON.stringify({ report, fails }, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        controls: report.reduce((s, r) => s + r.rows.length, 0),
        failCount: fails.length,
        failures: fails.slice(0, 25),
      },
      null,
      2,
    ),
  );
  await browser.close();
  process.exitCode = fails.length ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
