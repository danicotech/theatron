import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const out = 'docs/previews/member-arena-browser';
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
    await page.goto('http://127.0.0.1:3000/?mode=manage&preview=1&phase=live&stage=2d&intro=0#register', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__LUNJIAN);
    assert.equal(await page.locator('#register-cta').getAttribute('aria-label'), '報名表');
    assert.equal(await page.locator('#register-cta').textContent(), '');
    assert.equal(await page.locator('.registration-loadout').count(), 0);
    await snapshot('plain-scroll');
    await page.getByRole('button', { name: '會員專區', exact: true }).click();
    let member = page.getByRole('dialog', { name: '會員專區', exact: true });
    await member.getByLabel('帳號', { exact: true }).waitFor();
    assert.equal(await member.getByRole('button', { name: '場次盤', exact: true }).count(), 0);
    await snapshot('member-login');
    await member.getByRole('button', { name: '註冊', exact: true }).click();
    await member.getByLabel('帳號', { exact: true }).fill('member-flow');
    await member.getByLabel('密碼', { exact: true }).fill('test-password');
    await member.getByLabel('暱稱', { exact: true }).fill('江上客');
    await member.getByRole('button', { name: '註冊並領取 1,000 點', exact: true }).click();
    await member.getByRole('heading', { name: '江上客，別來無恙。' }).waitFor();
    assert.equal(await member.getByRole('button', { name: '管理模式', exact: true }).count(), 0);
    await snapshot('member-overview');
    await member.getByRole('button', { name: '關閉視窗', exact: true }).click();
    await page.locator('.site-nav a[href="#duel"]').click();
    await page.waitForFunction(() => document.querySelector('#duel[data-on]') && !document.body.hasAttribute('data-cut'));
    await page.locator('[data-duel-center]').click();
    let arena = page.getByRole('dialog', { name: '觀局雅集 · 本機試玩', exact: true });
    await arena.getByRole('button', { name: '管理模式', exact: true }).click();
    await arena.getByRole('button', { name: '以目前賽程建立試玩', exact: true }).click();
    await page.waitForFunction(() => new URL(location.href).searchParams.has('sportsEvent'));
    const eventId = new URL(page.url()).searchParams.get('sportsEvent');
    await arena.getByRole('button', { name: '檢視模式', exact: true }).click();
    const select = arena.getByRole('combobox', { name: /^選擇場次/ });
    await select.waitFor();
    const second = await select.locator('option').nth(1).getAttribute('value');
    assert.ok(second);
    await select.selectOption(second);
    await arena.getByRole('link', { name: '進入比武場景 ↗', exact: true }).click();
    await page.waitForFunction(id => new URL(location.href).searchParams.get('match') === id && document.querySelector('#duel[data-on]'), second);
    await page.locator('[data-duel-center]').click();
    arena = page.getByRole('dialog', { name: '觀局雅集 · 本機試玩', exact: true });
    await arena.getByRole('combobox', { name: /^選擇場次/ }).waitFor();
    assert.equal(await arena.getByRole('combobox', { name: /^選擇場次/ }).inputValue(), second);
    assert.equal(await arena.getByRole('combobox', { name: /^活動/ }).inputValue(), eventId);
    await arena.getByRole('button', { name: '投票', exact: true }).first().click();
    await arena.getByRole('button', { name: '已投', exact: true }).waitFor();
    await snapshot('arena-selected-match');
    await arena.getByRole('button', { name: '關閉視窗', exact: true }).click();
    assert.equal(new URL(page.url()).hash, '#duel');
    assert.equal(await page.locator('[data-duel-center]').evaluate(el => el === document.activeElement), true);
    await page.getByRole('button', { name: '會員專區', exact: true }).click();
    member = page.getByRole('dialog', { name: '會員專區', exact: true });
    await member.getByRole('heading', { name: '江上客，別來無恙。' }).waitFor();
    await member.getByRole('button', { name: '點數紀錄', exact: true }).click();
    await snapshot('member-ledger');
    await member.getByRole('button', { name: '登出', exact: true }).click();
    await member.getByLabel('帳號', { exact: true }).waitFor();
    assert.equal(await member.getByRole('heading', { name: '江上客，別來無恙。' }).count(), 0);
    await member.getByLabel('帳號', { exact: true }).fill('member-flow');
    await member.getByLabel('密碼', { exact: true }).fill('test-password');
    await member.getByRole('button', { name: '登入', exact: true }).last().click();
    await member.getByRole('button', { name: '會員總覽', exact: true }).waitFor();
    await member.getByRole('button', { name: '會員總覽', exact: true }).click();
    await member.getByRole('heading', { name: '江上客，別來無恙。' }).waitFor();
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
