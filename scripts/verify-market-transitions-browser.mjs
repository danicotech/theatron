// Real UI, two tabs, shared IndexedDB; isolated from the user's local data.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const output = 'docs/previews/market-transitions-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 768, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const admin = await context.newPage();
    const errors = [];
    for (const tab of [page, admin]) tab.on('pageerror', (e) => errors.push(e.message));
    const button = (tab, name) => tab.getByRole('button', { name, exact: true });
    const market = (tab, name) => tab.getByRole('heading', { name }).locator('..').locator('..');
    const balance = (tab, value) =>
      tab.waitForFunction(
        (v) => document.querySelector('header strong')?.textContent.replace(/\D/g, '') === v,
        value,
      );
    async function snapshot(tab, name) {
      await tab.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((a) => a.effect?.getTiming().iterations !== Infinity)
            .map((a) => a.finished.catch(() => {})),
        ),
      );
      await tab.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const data = await tab.evaluate(async () => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        violations: (
          await window.axe.run(document.body, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
          })
        ).violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      }));
      await tab.screenshot({ path: `${output}/${width}-${name}.png`, animations: 'disabled' });
      results.push({ width, name, ...data });
      console.log(JSON.stringify(results.at(-1)));
      assert.equal(data.overflow, false);
      assert.deepEqual(data.violations, []);
    }
    async function openSlip(tab) {
      const toggle = tab.getByRole('button', { name: /查看注單 ↑/ });
      if (await toggle.isVisible()) await toggle.click();
    }
    async function closeSlip(tab) {
      const toggle = tab.getByRole('button', { name: /繼續選盤 ↓/ });
      if (await toggle.isVisible()) await toggle.click();
    }
    async function login(tab, create = false) {
      await button(tab, '登入／註冊領 1,000 點').click();
      const auth = tab.getByRole('dialog');
      if (create) await auth.getByRole('button', { name: '註冊', exact: true }).click();
      await auth.getByLabel('帳號', { exact: true }).fill('market-viewer');
      await auth.getByLabel('密碼', { exact: true }).fill('isolated-password');
      if (create) await auth.getByLabel('暱稱', { exact: true }).fill('觀局驗收客');
      await auth
        .locator('form')
        .getByRole('button', { name: create ? '註冊並領取 1,000 點' : '登入', exact: true })
        .click();
      await auth.waitFor({ state: 'hidden' });
    }
    async function confirm(tab, name) {
      const dialog = tab.getByRole('alertdialog');
      await dialog.getByRole('button', { name, exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
    }
    async function edit(name, matchId = 'm1-0') {
      const group = admin
        .locator('details')
        .filter({ has: admin.getByText('盤口與賠率設定', { exact: true }) });
      if (!(await group.evaluate((el) => el.open))) await group.locator('summary').click();
      await group.getByRole('combobox', { name: '場次', exact: true }).selectOption(matchId);
      await group
        .locator('div')
        .filter({ has: admin.locator('span').filter({ hasText: new RegExp(`^${name} ·`) }) })
        .getByRole('button', { name: '設定／作廢', exact: true })
        .click();
      return admin.getByRole('dialog', { name: `設定 ${name}`, exact: true });
    }
    async function voidMarket(name, matchId = 'm1-0', cancel = false) {
      const dialog = await edit(name, matchId);
      await dialog.getByLabel('作廢原因', { exact: true }).fill('試玩驗收：此盤取消');
      await dialog.getByRole('button', { name: '作廢此盤', exact: true }).click();
      await snapshot(admin, `${matchId}-${name}-${cancel ? 'void-cancel' : 'void-confirm'}`);
      if (cancel) await confirm(admin, '返回修改');
      else await confirm(admin, '作廢並退款');
    }
    await page.goto('http://127.0.0.1:3000/sportsbook?mode=manage', { waitUntil: 'networkidle' });
    await page.getByRole('combobox', { name: '選手來源', exact: true }).selectOption('generated');
    await page.getByLabel('報名上限／示範人數', { exact: true }).fill('4');
    await button(page, '建立活動').click();
    await page.getByRole('combobox', { name: '切換管理對局', exact: true }).waitFor();
    const eventId = new URL(page.url()).searchParams.get('event');
    await button(page, '檢視模式').click();
    await login(page, true);
    await admin.goto(`http://127.0.0.1:3000/sportsbook?event=${eventId}&mode=manage`, {
      waitUntil: 'networkidle',
    });
    await market(page, '整場勝負').getByRole('button', { name: /選擇/ }).first().click();
    await openSlip(page);
    await page.getByLabel('每筆本金（點）', { exact: true }).fill('100');
    await button(page, '檢查注單').click();
    await page.getByRole('alertdialog', { name: '確認本機下注' }).waitFor();
    const editor = await edit('整場勝負');
    await editor.getByLabel('固定賠率', { exact: true }).first().fill('abc');
    await editor.getByRole('button', { name: '儲存設定', exact: true }).click();
    await editor.getByRole('alert').waitFor();
    assert.equal(
      await editor.getByRole('button', { name: '關閉視窗', exact: true }).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.top >= 0 &&
          r.bottom <= innerHeight &&
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el
        );
      }),
      true,
      'editor close remains reachable after error focus scrolls the form',
    );
    await snapshot(admin, 'invalid-odds');
    assert.equal(
      await editor.getByRole('alert').evaluate((el) => el === document.activeElement),
      true,
      'invalid odds feedback must receive focus inside the editor',
    );
    await editor.getByLabel('固定賠率', { exact: true }).first().fill('2.50');
    await editor.getByRole('button', { name: '儲存設定', exact: true }).click();
    await editor.waitFor({ state: 'hidden' });
    await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
    const slip = page.getByRole('complementary', { name: '我的注單' });
    await slip.getByRole('alert').waitFor();
    assert.equal(
      await slip.getByRole('alert').evaluate((el) => el === document.activeElement),
      true,
    );
    assert.match(await slip.innerText(), /2\.500/);
    await balance(page, '1000');
    await snapshot(page, 'quote-changed');
    await button(page, '檢查注單').click();
    assert.match(await page.getByRole('alertdialog').innerText(), /2\.500/);
    await confirm(page, '確認扣點下注');
    await balance(page, '900');
    await voidMarket('整場勝負', 'm1-0', true);
    await balance(page, '900');
    await voidMarket('整場勝負');
    await balance(page, '1000');
    await snapshot(page, 'single-refunded');
    await button(page, '場次盤').click();
    await closeSlip(page);
    await market(page, 'BO3 比分').getByRole('button', { name: /選擇/ }).first().click();
    await page.getByRole('combobox', { name: '選擇場次', exact: true }).selectOption('m1-1');
    await market(page, '整場勝負').getByRole('button', { name: /選擇/ }).first().click();
    await openSlip(page);
    await page.getByRole('combobox', { name: '投注方式', exact: true }).selectOption('parlay');
    await page.getByLabel('每組本金（點）', { exact: true }).fill('100');
    await button(page, '檢查注單').click();
    await confirm(page, '確認扣點下注');
    await balance(page, '900');
    await voidMarket('BO3 比分');
    await page.getByText('作廢，按 1.00 倍', { exact: true }).first().waitFor();
    await balance(page, '900');
    await snapshot(page, 'partial-void-pending');
    await voidMarket('整場勝負', 'm1-1');
    await balance(page, '1000');
    await snapshot(page, 'all-void-refunded');
    // Both tabs have the same account and enough balance at confirmation time.
    await button(admin, '檢視模式').click();
    await login(admin);
    await button(page, '場次盤').click();
    for (const tab of [page, admin]) {
      await closeSlip(tab);
      await tab.getByRole('combobox', { name: '選擇場次', exact: true }).selectOption('m1-0');
      await market(tab, /整場總時間/)
        .getByRole('button', { name: /選擇/ })
        .first()
        .click();
      await openSlip(tab);
      await tab.getByRole('combobox', { name: '投注方式', exact: true }).selectOption('singles');
      await tab.getByLabel('每筆本金（點）', { exact: true }).fill('800');
      await button(tab, '檢查注單').click();
      await tab.getByRole('alertdialog').waitFor();
    }
    await Promise.all(
      [page, admin].map((tab) =>
        tab
          .getByRole('alertdialog')
          .getByRole('button', { name: '確認扣點下注', exact: true })
          .click(),
      ),
    );
    await balance(page, '200');
    await balance(admin, '200');
    const rejected = (await page.getByRole('alertdialog').count()) ? page : admin;
    await rejected.getByRole('alertdialog').getByRole('alert').waitFor();
    assert.match(
      await rejected.getByRole('alertdialog').getByRole('alert').innerText(),
      /餘額|點數/,
    );
    await snapshot(rejected, 'concurrent-rejected');
    await confirm(rejected, '返回修改');
    for (const tab of [page, admin]) {
      await closeSlip(tab);
      await button(tab, '我的注單').click();
      assert.equal(
        await tab.locator('main article').count(),
        3,
        'one concurrent ticket committed, not two',
      );
      await snapshot(tab, tab === page ? 'synced-tickets-a' : 'synced-tickets-b');
    }
    await button(admin, '管理模式').click();
    const timeEditor = await edit('整場總時間');
    assert.equal(
      await timeEditor
        .getByLabel('秒數門檻（時間盤）', { exact: true })
        .evaluate((el) => el.readOnly),
      true,
    );
    await timeEditor
      .getByText('此盤已有注單，秒數門檻已鎖定；既有注單的條件不會改變。', { exact: true })
      .waitFor();
    await snapshot(admin, 'time-line-locked');
    await timeEditor.getByRole('button', { name: '關閉視窗', exact: true }).click();
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
