import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fixture, inspect } from './ink-wave-fixture.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.ARTIFACT_DIR || path.join(os.tmpdir(), 'theatron-ink-audit');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const report = [];
  for (const width of [1247, 390]) {
    const p = await b.newPage({
      viewport: { width, height: 884 },
      hasTouch: true,
      reducedMotion: 'no-preference',
    });
    await p.goto(
      (process.env.AUDIT_URL || 'http://localhost:3014') + '/?intro=0&stage=2d#register',
    );
    await p.waitForSelector('.chapter-entry:not([data-entry-pending])');
    await fixture(p);
    const button = p.locator('#wave-audit-fixture button');
    await button.evaluate((el) => {
      window.auditClicks = 0;
      el.addEventListener('click', () => window.auditClicks++);
    });
    for (const mode of ['light', 'dark']) {
      await p.evaluate((m) => (document.documentElement.dataset.colorMode = m), mode);
      await p.waitForTimeout(50);
      const before = await button
        .locator('.build-card')
        .first()
        .evaluate((el) => ({
          bg: getComputedStyle(el).backgroundColor,
          color: getComputedStyle(el.querySelector('strong')).color,
        }));
      await button.hover();
      await p.waitForTimeout(200);
      let row = await button.evaluate(inspect);
      assert(row.items.every((i) => i.ratio >= 4.5));
      await p.screenshot({ path: output + `/wave-motion-${width}-${mode}-partial.png` });
      await p.waitForTimeout(650);
      row = await button.evaluate(inspect);
      assert(row.items.every((i) => i.ratio >= 4.5));
      assert.equal(await button.getAttribute('data-ink-filled'), '');
      await button.screenshot({ path: output + `/wave-motion-${width}-${mode}-full.png` });
      await p.mouse.move(1, 1);
      await p.waitForTimeout(1300);
      assert.equal(await button.getAttribute('data-ink-surface'), null);
      assert.deepEqual(
        await button
          .locator('.build-card')
          .evaluate((el) => ({
            bg: getComputedStyle(el).backgroundColor,
            color: getComputedStyle(el.querySelector('strong')).color,
          })),
        before,
      );
      await p.keyboard.press('Tab');
      await button.focus();
      await p.waitForTimeout(800);
      assert((await button.evaluate(inspect)).items.every((i) => i.ratio >= 4.5));
      await p.evaluate(() => document.activeElement.blur());
      await p.waitForTimeout(1300);
      assert.equal(await button.getAttribute('data-ink-surface'), null);
      const cdp = await p.context().newCDPSession(p),
        rect = await button.boundingBox();
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }],
      });
      await p.waitForTimeout(800);
      assert((await button.evaluate(inspect)).items.every((i) => i.ratio >= 4.5));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await p.waitForTimeout(1400);
      assert.equal(await button.getAttribute('data-ink-surface'), null);
      await cdp.detach();
      await button.hover();
      await p.waitForTimeout(180);
      await p.evaluate(
        (m) => (document.documentElement.dataset.colorMode = m),
        mode === 'light' ? 'dark' : 'light',
      );
      await p.waitForTimeout(60);
      assert.equal(await button.getAttribute('data-ink-surface'), null);
      await p.mouse.move(1, 1);
      report.push({
        width,
        mode,
        hoverPartial: true,
        hoverFull: true,
        restore: true,
        keyboard: true,
        touch: true,
        themeReset: true,
        min: Math.min(...row.items.map((i) => i.ratio)),
      });
    }
    assert.equal(await p.evaluate(() => window.auditClicks), 2);
    await p.close();
  }
  await b.close();
  fs.writeFileSync(
    output + '/wave-motion-' + (process.env.AUDIT_URL ? 'live' : 'local') + '.json',
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
