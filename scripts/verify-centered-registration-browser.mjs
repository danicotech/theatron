import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const out = 'docs/previews/centered-registration-browser';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 943, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 884 } });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:3000/?stage=2d&intro=0#register', {
      waitUntil: 'networkidle',
    });
    await page.waitForFunction(() =>
      document.querySelector('#register-cta')?.hasAttribute('data-registration-entry'),
    );
    async function snapshot(name) {
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((a) => a.effect?.getTiming().iterations !== Infinity)
            .map((a) => a.finished.catch(() => {})),
        ),
      );
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const state = await page.evaluate(async () => {
        const header = document.querySelector('.site-header').getBoundingClientRect();
        const nav = document.querySelector('.site-nav').getBoundingClientRect();
        const brand = document.querySelector('.brand').getBoundingClientRect();
        const actions = document.querySelector('.header-actions').getBoundingClientRect();
        const desk = document.querySelector('.registration-desk').getBoundingClientRect();
        return {
          headerHeight: header.height,
          rowCenters: [nav, brand, actions].map((r) => r.y + r.height / 2),
          centerOffset: Math.abs(desk.x + desk.width / 2 - innerWidth / 2),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          violations: (
            await window.axe.run(document.body, {
              runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
            })
          ).violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        };
      });
      await page.screenshot({ path: `${out}/${width}-${name}.png`, animations: 'disabled' });
      assert.ok(state.headerHeight <= 72);
      assert.ok(
        Math.max(...state.rowCenters) - Math.min(...state.rowCenters) < 2,
        'header must remain one row',
      );
      assert.ok(state.centerOffset < 10, 'scroll stays centered');
      assert.equal(state.overflow, false);
      assert.deepEqual(state.violations, []);
      results.push({ width, name, ...state });
      console.log(JSON.stringify(results.at(-1)));
    }
    assert.equal(await page.getByRole('region', { name: '報名書卷' }).count(), 0);
    assert.equal(await page.locator('.registration-intro').count(), 0);
    await snapshot('closed');
    await page.locator('#register-cta').click();
    const scroll = page.getByRole('region', { name: '報名書卷' });
    await scroll.getByRole('heading', { name: '赴約參賽' }).waitFor();
    await snapshot('open');
    await scroll.getByRole('button', { name: /收卷/ }).click();
    assert.equal(
      await page.locator('#register-cta').evaluate((el) => el === document.activeElement),
      true,
    );
    await page.locator('.nav-more summary').click();
    assert.equal(await page.locator('.nav-menu [data-activity-cta]').isVisible(), true);
    await snapshot('menu');
    await page.keyboard.press('Escape');
    for (const id of ['rules', 'rewards', 'register']) {
      await page.locator(`.site-nav a[href="#${id}"]`).click();
      await page.waitForFunction(
        (id) =>
          document.querySelector(`#${id}`)?.hasAttribute('data-on') &&
          !document.body.hasAttribute('data-cut'),
        id,
      );
      assert.equal(new URL(page.url()).hash, `#${id}`);
    }
    await context.close();
  }
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
