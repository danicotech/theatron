// Real, isolated browser interactions; does not use the user's saved data.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright-core');
const output = 'docs/previews/home-controls-browser';
await mkdir(output, { recursive: true });
const results = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 768, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:3000/?preview=1&phase=finished&stage=2d&intro=0#rules', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__LUNJIAN);
    async function chapter(id) {
      await page.locator(`.site-nav a[href="#${id}"]`).click();
      await page.waitForFunction(id => document.querySelector(`#${id}`)?.hasAttribute('data-on') && !document.body.hasAttribute('data-cut'), id);
    }
    async function snapshot(name) {
      await page.screenshot({ path: `${output}/${width}-${name}.png`, animations: 'disabled' });
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const data = await page.evaluate(async () => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        violations: (await window.axe.run(document.body, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })),
      }));
      results.push({ width, name, ...data }); console.log(JSON.stringify(results.at(-1)));
      assert.equal(data.overflow, false); assert.deepEqual(data.violations, []);
    }
    for (const gap of [0, 1, 2, 3]) {
      await page.locator(`[data-bp-gap="${gap}"]`).click();
      assert.equal(await page.locator('#comic-bp-output').innerText(), String(gap * 8));
      assert.equal(await page.locator(`[data-bp-gap="${gap}"]`).getAttribute('aria-pressed'), 'true');
    }
    await snapshot('bp-selection');
    await page.locator('#rules .manga-fulltext summary').click();
    assert.equal(await page.locator('#rules .manga-fulltext').evaluate(el => el.open), true);
    await snapshot('rules-expanded');
    await chapter('invitation');
    const links = page.locator('#invitation a[href^="#handicap-"]');
    assert.equal(await links.count(), 6);
    for (let i=0; i<6; i++) {
      const href = await links.nth(i).getAttribute('href');
      await links.nth(i).click();
      assert.equal(await page.locator(href).evaluate(el => el.open), true);
      assert.equal(await page.locator(`${href}>summary`).evaluate(el => el === document.activeElement), true);
    }
    await snapshot('handicap-expanded');
    await chapter('duel');
    for (const [phase, score] of [['before','0:0'],['live','1:1'],['after','2:1']]) {
      await page.locator(`[data-duel-preview="${phase}"]`).click();
      assert.equal((await page.locator('#duel-score').innerText()).replace(/\s/g,''), score);
      await snapshot(`duel-${phase}`);
    }
    for (const outcome of ['dominant','crushed','narrow','draw']) {
      await page.locator(`[data-duel-outcome="${outcome}"]`).click();
      assert.equal(await page.locator(`[data-duel-outcome="${outcome}"]`).getAttribute('aria-pressed'), 'true');
    }
    await page.locator('[data-duel-reset]').click();
    const fighter = page.locator('#duel .arena-fighter[data-side="left"]');
    await fighter.scrollIntoViewIfNeeded();
    const box = await fighter.boundingBox();
    assert.ok(box);
    // Click the upper figure, since the character's name is a separate control over its feet.
    await page.evaluate(() => document.addEventListener('pointerdown', event => {
      window.lastDuelTrigger = event.target.closest('.arena-fighter,.fighter');
    }, { once: true, capture: true }));
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 4);
    await page.waitForFunction(() => !document.querySelector('#psheet').hidden);
    assert.equal(await page.evaluate(() => !!window.lastDuelTrigger), true);
    await snapshot('player-details');
    assert.equal(await page.locator('.dz-close').evaluate(el => el === document.activeElement), true);
    async function closeIsReachable() {
      assert.equal(await page.locator('.dz-close').evaluate(el => {
        const r=el.getBoundingClientRect();
        return r.top>=0 && r.bottom<=innerHeight && document.elementFromPoint(r.x+r.width/2,r.y+r.height/2) === el;
      }), true, 'close is visible above header and scroll content');
    }
    await closeIsReachable();
    await page.locator('.dz-sheet').evaluate(el => {el.scrollTop=el.scrollHeight;});
    await closeIsReachable();
    await snapshot('player-details-bottom');
    await page.locator('.site-nav a').first().evaluate(el => el.focus());
    assert.equal(await page.locator('#psheet').evaluate(el => el.contains(document.activeElement)), true);
    await page.locator('.skip-link').evaluate(el => el.focus());
    assert.equal(await page.locator('#psheet').evaluate(el => el.contains(document.activeElement)), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.lastDuelTrigger === document.activeElement), true);
    await chapter('schedule');
    const node = page.locator('#bracket-host .tt-node').filter({ visible: true }).first();
    const match = await node.getAttribute('data-match-id');
    assert.ok(match);
    await node.click();
    await page.waitForFunction(() => document.querySelector('#duel').hasAttribute('data-on') && !document.body.hasAttribute('data-cut'));
    assert.equal(new URL(page.url()).searchParams.get('match'), match);
    await page.locator('[data-return-bracket]').click();
    await page.waitForFunction(() => document.querySelector('#schedule').hasAttribute('data-on') && !document.body.hasAttribute('data-cut'));
    assert.equal(await page.evaluate(() => document.activeElement?.closest('#schedule') !== null), true);
    await snapshot('schedule-return');
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
