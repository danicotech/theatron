import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const out = 'docs/previews/public-presentation-browser';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of process.env.TEST_WIDTH ? [Number(process.env.TEST_WIDTH)] : [943, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 884 } });
    await context.route('http://127.0.0.1:3000/?**', async route => {
      const url = new URL(route.request().url());
      if (route.request().isNavigationRequest() && url.searchParams.get('stage') === '3d') {
        url.searchParams.set('stage', '2d'); url.searchParams.set('intro', '0');
        await route.fulfill({ status: 302, headers: { location: url.href } });
      } else await route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    async function snapshot(name) {
      await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))));
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const result = await page.evaluate(async () => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        violations: (await window.axe.run(document.body, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })),
      }));
      await page.screenshot({ path: `${out}/${width}-${name}.png`, animations: 'disabled' });
      assert.equal(result.overflow, false); assert.deepEqual(result.violations, []);
      results.push({ width, name, ...result }); console.log(JSON.stringify(results.at(-1)));
    }
    await page.goto('http://127.0.0.1:3000/home?stage=2d&intro=0', { waitUntil: 'networkidle' });
    await page.getByRole('heading',{name:'百業試鋒',exact:true}).waitFor();
    assert.equal(await page.locator('.home-copy a').count(),2);
    assert.equal(await page.locator('.site-nav a').count(),7);
    await snapshot('home');
    await page.getByRole('button',{name:'會員專區',exact:true}).click();
    await page.getByRole('dialog',{name:'會員專區',exact:true}).getByLabel('帳號',{exact:true}).waitFor();
    await snapshot('home-member');
    await page.goto('http://127.0.0.1:3000/?preview=1&phase=signup&stage=2d&intro=0#schedule', { waitUntil: 'networkidle' });
    await page.waitForFunction(()=>!!window.__LUNJIAN);
    assert.equal(await page.locator('.schedule-empty a').count(),0);
    assert.equal(await page.locator('#bracket-tools').isVisible(),false);
    assert.equal(await page.locator('.comic-reading-note').count(),0);
    await snapshot('public-empty-schedule');
    await page.goto('http://127.0.0.1:3000/?preview=1&phase=live&stage=2d&intro=0#duel', { waitUntil: 'networkidle' });
    await page.waitForFunction(()=>!!window.__LUNJIAN);
    assert.equal(await page.locator('.duel-study').isVisible(),false);
    await page.locator('#duel .fighter[data-side="left"]').click();
    await snapshot('public-loadout');
    assert.equal(await page.locator('#dz-body img').count(),0);
    assert.match(await page.locator('#dz-body').textContent(),/待公開/);
    await page.goto('http://127.0.0.1:3000/?mode=manage&preview=1&phase=live&stage=2d&intro=0#duel', { waitUntil: 'networkidle' });
    await page.waitForFunction(()=>!!window.__LUNJIAN);
    await page.locator('[data-duel-preview="before"]').click();
    await page.locator('#duel .fighter[data-side="right"]').click();
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('#dz-body img')).every(i=>i.complete&&i.naturalWidth>0));
    assert.ok(await page.locator('#dz-body img').count()>=2);
    await snapshot('manager-image-loadout');
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
