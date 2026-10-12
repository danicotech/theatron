import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const output = 'docs/previews/opening-motion-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  // Sparse frames model a stalled/background renderer; do not change the production clock.
  const slow = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const slowPage = await slow.newPage();
  await slowPage.addInitScript(() => {
    const native = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      const requested = performance.now();
      const frame = (now) => (now - requested >= 240 ? callback(now) : native(frame));
      return native(frame);
    };
  });
  await slowPage.goto('http://127.0.0.1:3000/?stage=2d&intro=0#register', {
    waitUntil: 'networkidle',
  });
  const started = Date.now();
  await slowPage.locator('.site-nav a[href="#duel"]').click();
  await slowPage.waitForFunction(
    () => document.querySelector('#duel[data-on]') && !document.body.hasAttribute('data-cut'),
    null,
    { timeout: 6500 },
  );
  const elapsed = Date.now() - started;
  assert.ok(
    elapsed < 6500,
    'a 3.2 second ink transition must not become a 16 second wait with sparse frames',
  );
  results.push({ name: 'sparse-frames', elapsed });
  console.log(JSON.stringify(results.at(-1)));
  await slow.close();
  for (const width of [1440, 768, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.swapEvidence = [];
      new MutationObserver((records) => {
        for (const { target } of records)
          if (target.matches('.chapter[data-on]') && document.body.hasAttribute('data-cut')) {
            const canvas = document.querySelector('#ink-canvas');
            const pixels = canvas
              .getContext('2d')
              .getImageData(0, 0, canvas.width, canvas.height).data;
            let minAlpha = 255;
            for (let i = 3; i < pixels.length; i += 4) minAlpha = Math.min(minAlpha, pixels[i]);
            window.swapEvidence.push({
              chapter: target.id,
              progress: Number(document.querySelector('#ink-wipe').dataset.progress),
              minAlpha,
            });
          }
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-on'] });
    });
    async function snapshot(name, audit = true) {
      await page.screenshot({ path: `${output}/${width}-${name}.png`, animations: 'allow' });
      const item = { width, name };
      if (audit) {
        await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
        Object.assign(
          item,
          await page.evaluate(async () => ({
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            violations: (
              await window.axe.run(document.body, {
                runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
              })
            ).violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          })),
        );
        assert.equal(item.overflow, false);
        assert.deepEqual(item.violations, []);
      }
      results.push(item);
      console.log(JSON.stringify(item));
    }
    await page.goto('http://127.0.0.1:3000/?stage=2d', { waitUntil: 'domcontentloaded' });
    await page.locator('#boot[data-state="ready"]').waitFor();
    await page.waitForFunction(
      () => Number(getComputedStyle(document.querySelector('.boot-loading')).opacity) < 0.01,
    );
    assert.equal(await page.locator('#load-progress').getAttribute('value'), '100');
    assert.equal(await page.locator('.site-header').evaluate((el) => el.inert), true);
    await page.keyboard.press('Tab');
    assert.equal(
      await page.locator('#ignite').evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('body').getAttribute('data-intro'), 'curtain');
    await snapshot('waiting-for-ignite');
    if (width === 768) await page.locator('#ignite').click({ position: { x: 30, y: 30 } });
    else await page.keyboard.press(width === 375 ? 'Space' : 'Enter');
    await page.locator('#boot[data-state="burning"]').waitFor();
    assert.equal(await page.locator('#ignite').isDisabled(), true);
    await page.waitForFunction(
      () =>
        parseFloat(
          getComputedStyle(document.querySelector('.boot-fabric')).getPropertyValue(
            '--burn-radius',
          ),
        ) > 35,
    );
    await snapshot('burning', false);
    await page.waitForFunction(() => !document.body.hasAttribute('data-intro'));
    assert.equal(await page.locator('.site-header').evaluate((el) => el.inert), false);
    assert.equal(
      await page
        .locator('.site-nav a')
        .first()
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await snapshot('entered');
    await page.waitForFunction(() =>
      document.querySelector('#ink-wipe').hasAttribute('data-renderer'),
    );
    await page.locator('.site-nav a[href="#rules"]').click();
    await page.waitForFunction(
      () => Number(document.querySelector('#ink-wipe').dataset.progress) > 0.2,
    );
    await snapshot('ink-cover', false);
    await page.waitForFunction(
      () => Number(document.querySelector('#ink-wipe').dataset.progress) > 0.65,
    );
    await snapshot('center-reveal', false);
    await page.waitForFunction(() => !document.body.hasAttribute('data-cut'));
    const evidence = await page.evaluate(() => window.swapEvidence);
    assert.ok(evidence.length > 0);
    assert.ok(
      evidence.every((x) => x.progress >= 0.46 && x.minAlpha === 255),
      JSON.stringify(evidence),
    );
    results.push({ width, name: 'opaque-swap', evidence });
    await snapshot('rules-ready');
    await page.locator('.site-nav a[href="#invitation"]').click();
    await page.locator('.site-nav a[href="#rewards"]').click();
    await page.waitForFunction(
      () => document.querySelector('#rewards[data-on]') && !document.body.hasAttribute('data-cut'),
    );
    assert.equal(new URL(page.url()).hash, '#rewards');
    await snapshot('last-navigation-wins');
    await page.locator('.site-nav a[href="#rules"]').click();
    await page.waitForFunction(() => document.body.hasAttribute('data-cut'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(
      () => document.body.classList.contains('reading') && !document.body.hasAttribute('data-cut'),
    );
    assert.equal(await page.locator('.chapter[data-on]').count(), 7);
    assert.equal(
      await page.locator('.chapter-sticky').evaluateAll((els) => els.some((el) => el.inert)),
      false,
    );
    await snapshot('reduced-mid-transition');
    assert.deepEqual(errors, []);
    await context.close();
  }
  const fallback = await browser.newContext({ viewport: { width: 375, height: 900 } });
  const fallbackPage = await fallback.newPage();
  const blocked = [];
  await fallback.route(
    /\/lunjian\/(stage3d\.js|ink-transitions\.js|art\/(intro-duel[^/]*|curtain-figures\.webp))/,
    (route) => {
      blocked.push(new URL(route.request().url()).pathname);
      return route.abort();
    },
  );
  await fallbackPage.goto('http://127.0.0.1:3000/?stage=3d', { waitUntil: 'domcontentloaded' });
  await fallbackPage.locator('#boot[data-state="ready"][data-fallback]').waitFor();
  assert.equal(await fallbackPage.locator('body').getAttribute('data-stage'), '2d');
  await fallbackPage.keyboard.press('Enter');
  await fallbackPage.waitForFunction(() => !document.body.hasAttribute('data-intro'));
  await fallbackPage.locator('.site-nav a[href="#rules"]').click();
  await fallbackPage.waitForFunction(
    () => document.querySelector('#rules[data-on]') && !document.body.hasAttribute('data-cut'),
  );
  assert.equal(await fallbackPage.locator('#ink-wipe').getAttribute('data-renderer'), null);
  assert.ok(blocked.some((url) => url.includes('stage3d.js')));
  assert.ok(blocked.some((url) => url.includes('ink-transitions.js')));
  assert.ok(blocked.some((url) => url.includes('intro-duel')));
  await fallbackPage.screenshot({ path: `${output}/375-resource-fallback.png` });
  results.push({ name: 'resource-fallback', blocked });
  await fallback.close();
  const reduced = await browser.newContext({
    viewport: { width: 375, height: 900 },
    reducedMotion: 'reduce',
  });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto('http://127.0.0.1:3000/?stage=2d', { waitUntil: 'networkidle' });
  assert.equal(await reducedPage.locator('body').getAttribute('data-intro'), null);
  assert.equal(
    await reducedPage
      .locator('.chapter')
      .evaluateAll((chapters) => chapters.filter((chapter) => chapter.checkVisibility()).length),
    7,
  );
  assert.equal(
    await reducedPage.locator('.chapter-sticky').evaluateAll((els) => els.some((el) => el.inert)),
    false,
  );
  assert.equal(await reducedPage.locator('#boot').isVisible(), false);
  await reducedPage.screenshot({ path: `${output}/375-reduced-from-start.png` });
  results.push({ name: 'reduced-from-start', chapters: 7 });
  await reduced.close();
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
