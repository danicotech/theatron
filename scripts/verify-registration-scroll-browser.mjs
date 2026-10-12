import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const out = 'docs/previews/registration-scroll-browser';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader'] });
const results = [];
try {
  for (const reduced of [false, true]) {
    const context = await browser.newContext({
      viewport: { width: 946, height: 884 },
      reducedMotion: reduced ? 'reduce' : 'no-preference',
    });
    const page = await context.newPage();
    await page.goto(
      `http://127.0.0.1:3000/?stage=${process.env.TEST_STAGE || '2d'}&intro=0#register`,
      { waitUntil: 'networkidle' },
    );
    await page.waitForFunction(() =>
      document.querySelector('#register-cta')?.hasAttribute('data-registration-entry'),
    );
    await page.locator('#register-cta').click();
    const scroll = page.getByRole('region', { name: '報名書卷', exact: true });
    await scroll.getByRole('heading', { name: '赴約參賽' }).waitFor();
    const animations = await scroll.evaluate((el) =>
      el
        .getAnimations({ subtree: true })
        .map((a) => ({ name: a.animationName, duration: a.effect.getTiming().duration })),
    );
    if (reduced) assert.equal(animations.length, 0);
    else {
      assert.ok(animations.some((a) => a.name.includes('unrollRod') && a.duration === 900));
      assert.ok(animations.some((a) => a.name.includes('unrollWindow') && a.duration === 900));
      // Scrub the real CSS animations to record the paper and moving bottom rod.
      await scroll.evaluate((el) =>
        el.getAnimations({ subtree: true }).forEach((a) => {
          a.pause();
          a.currentTime = 200;
        }),
      );
      await page.screenshot({ path: `${out}/unrolling.png` });
      await scroll.evaluate((el) => el.getAnimations({ subtree: true }).forEach((a) => a.finish()));
    }
    const state = await scroll.evaluate((el) => ({
      innerScrollers: [...el.querySelectorAll('*')].filter(
        (n) =>
          !n.closest('dialog') &&
          ['auto', 'scroll'].includes(getComputedStyle(n).overflowY) &&
          n.scrollHeight > n.clientHeight + 1,
      ).length,
      chapterOverflow: getComputedStyle(el.closest('.chapter-sticky')).overflowY,
      chapter: el.closest('section.chapter').id,
      stage: document.documentElement.dataset.stage || document.body.dataset.stage,
      nestedMain: el.querySelectorAll('main').length,
    }));
    assert.equal(state.innerScrollers, 0);
    assert.equal(state.nestedMain, 0);
    assert.equal(state.chapter, 'register');
    if (!reduced) assert.equal(state.chapterOverflow, 'auto');
    await scroll.getByRole('button', { name: /收卷/ }).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(new URL(page.url()).hash, '#register');
    await page.screenshot({
      path: `${out}/${reduced ? 'reduced' : process.env.TEST_STAGE || '2d'}-open.png`,
    });
    await scroll.getByRole('button', { name: /收卷/ }).click();
    await scroll.waitFor({ state: 'hidden' });
    assert.equal(
      await page.locator('#register-cta').evaluate((el) => el === document.activeElement),
      true,
    );
    await page.screenshot({
      path: `${out}/${reduced ? 'reduced' : process.env.TEST_STAGE || '2d'}-closed.png`,
    });
    results.push({ reduced, animations, ...state });
    console.log(JSON.stringify(results.at(-1)));
    await context.close();
  }
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
