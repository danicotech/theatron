// Isolated homepage audit; never connects to the user's existing browser profile.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright-core');
const output = 'docs/previews/home-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 768, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.motionEvents = [];
      new MutationObserver(records => {
        for (const record of records) {
          const el = record.target;
          if (el.matches('[data-comic-frame]') || el === document.body || el.matches('section.chapter')) {
            window.motionEvents.push({ time: performance.now(), attribute: record.attributeName,
              chapter: el.closest('.chapter')?.id, value: el.getAttribute(record.attributeName),
              frame: el.matches('[data-comic-frame]') ? [...el.closest('.chapter').querySelectorAll('[data-comic-frame]')].indexOf(el) : null });
          }
        }
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-comic-state', 'data-cut', 'data-on'] });
    });
    await page.goto('http://127.0.0.1:3000/?preview=1&phase=finished&stage=2d&intro=0#prologue', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__LUNJIAN && !document.body.hasAttribute('data-intro'));
    async function snapshot(name) {
      await page.screenshot({ path: `${output}/${width}-${name}.png`, animations: 'disabled' });
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const result = await page.evaluate(async () => ({
        stage: document.body.dataset.stage,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        active: document.querySelector('.chapter[data-on]')?.id,
        controls: [...document.querySelectorAll('button,a,summary,select,input:not([type=checkbox]):not([type=radio])')]
          .filter(el => el.checkVisibility() && !el.disabled && !el.closest('[inert],nextjs-portal') && (!el.matches('.visually-hidden') || el === document.activeElement) && el.getBoundingClientRect().bottom > 0 && el.getBoundingClientRect().top < innerHeight)
          .map(el => ({ text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0,50),
            selector: el.id || el.className, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }))
          .filter(el => el.height < 43.5 || el.width < 43.5),
        violations: (await window.axe.run(document.body, {
          runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa'] },
        })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })),
      }));
      results.push({ width, name, ...result, motion: await page.evaluate(() => window.motionEvents) });
      console.log(JSON.stringify({ width, name, ...result }));
    }
    // Fragment navigation starts the browser's sequential focus at the chapter.
    // Focus the skip link explicitly to check its focused appearance and Enter action.
    await page.locator('.skip-link').focus();
    assert.equal(await page.locator('.skip-link').evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator('.skip-link').evaluate(el => { const r=el.getBoundingClientRect(); return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2) === el; }), true, 'focused skip link is not covered');
    await snapshot('skip-link');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#prologue .chapter-sticky').evaluate(el => el === document.activeElement), true);
    for (const chapter of ['prologue','rules','invitation','register','duel','schedule','rewards']) {
      await page.evaluate(() => { window.motionEvents = []; });
      if (chapter !== 'prologue') await page.locator(`.site-nav a[href="#${chapter}"]`).click();
      await page.waitForFunction(chapter => document.querySelector(`section#${chapter}`)?.hasAttribute('data-on') && !document.body.hasAttribute('data-cut'), chapter);
      await page.waitForFunction(chapter => !document.querySelector(`section#${chapter} [data-comic-state="entering"]`), chapter);
      await snapshot(chapter);
      const reader = page.locator(`#${chapter} .chapter-sticky`);
      const panels = reader.locator('[data-comic-frame]');
      for (let i = 0; i < await panels.count(); i++) {
        await panels.nth(i).scrollIntoViewIfNeeded();
        await page.waitForFunction(({chapter, i}) => document.querySelectorAll(`#${chapter} [data-comic-frame]`)[i]?.dataset.comicState === 'shown', {chapter, i});
      }
      const events = await page.evaluate(() => window.motionEvents);
      let entering = null;
      let previous = -1;
      for (const event of events.filter(e => e.chapter === chapter && e.attribute === 'data-comic-state')) {
        if (event.value === 'entering') {
          assert.equal(entering, null, `${chapter}: concurrent panel animation`);
          assert.ok(event.frame > previous, `${chapter}: reading order`);
          entering = event.frame; previous = event.frame;
        } else if (event.value === 'shown' && event.frame === entering) entering = null;
      }
      assert.equal(entering, null, `${chapter}: unfinished panel`);
      await reader.evaluate(el => { el.scrollTop = el.scrollHeight; });
      await snapshot(`${chapter}-bottom`);
      if (chapter === 'schedule') {
        assert.equal(await page.locator('#schedule .chapter-calligraphy').evaluate(el => getComputedStyle(el).color === getComputedStyle(document.body).color), true, 'schedule title uses light text');
      }
    }
    await page.locator('.nav-more summary').click();
    await snapshot('more-menu');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.nav-more').evaluate(el => el.open), false);
    assert.equal(await page.locator('.nav-more summary').evaluate(el => el === document.activeElement), true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.body.classList.contains('reading'));
    assert.equal(await page.locator('[data-comic-state="entering"]').count(), 0);
    assert.equal(await page.locator('[data-chapter-title] .writing').count(), 0);
    assert.equal(await page.locator('.chapter-sticky').evaluateAll(els => els.every(el => !el.inert)), true);
    await page.locator('.site-nav a[href="#rules"]').click();
    await snapshot('reduced-rules');
    assert.deepEqual(errors, [], `${width}: page errors`);
    await context.close();
  }
  for (const result of results) {
    assert.equal(result.overflow, false, `${result.width} ${result.name}: page overflow`);
    assert.deepEqual(result.controls, [], `${result.width} ${result.name}: undersized controls`);
    assert.deepEqual(result.violations, [], `${result.width} ${result.name}: accessibility`);
  }
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
