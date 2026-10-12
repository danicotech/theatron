// All writes occur in fresh browser contexts. Never attaches the user's profile.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
  : 'file:///C:/Users/User/Documents/code/react-vite-erp/node_modules/playwright-core/index.mjs');
const output = 'docs/previews/spectator-flow';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of process.env.TEST_WIDTH ? [Number(process.env.TEST_WIDTH)] : [1440, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const button = name => page.getByRole('button', { name, exact: true });
    const market = title => page.locator('section').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
    const state = () => page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('lunjian-sportsbook-demo', 1);
      request.onsuccess = () => {
        const db = request.result;
        const get = db.transaction('state', 'readonly').objectStore('state').get('root');
        get.onsuccess = () => { resolve(get.result); db.close(); };
        get.onerror = () => reject(get.error);
      };
      request.onerror = () => reject(request.error);
    }));
    async function snapshot(name) {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(overflow, false, `${width}/${name}: horizontal overflow`);
      assert.deepEqual(errors, [], `${width}/${name}: browser errors`);
      await page.screenshot({ path: `${output}/${width}-${name}.png`, fullPage: true, animations: 'disabled' });
      results.push({ width, name, overflow, errors: [...errors] });
      console.log(`${width}: ${name}`);
    }
    async function confirm(name) {
      const dialog = page.getByRole('alertdialog');
      await dialog.getByRole('button', { name, exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
    }
    async function wager(title, optionIndex = 0, checkGuards = false) {
      await market(title).getByRole('button', { name: /選擇/ }).nth(optionIndex).click();
      const toggle = page.getByRole('button', { name: /查看注單 ↑/ });
      if (await toggle.isVisible()) await toggle.click();
      const slip = page.getByRole('complementary', { name: '我的注單' });
      if (checkGuards) {
        await slip.getByLabel('每筆本金（點）', { exact: true }).fill('1100');
        await slip.getByRole('button', { name: '檢查注單', exact: true }).click();
        await slip.getByRole('alert').filter({ hasText: '可用點數不足' }).waitFor();
        assert.equal((await state()).members[0].balance, '1000');
        assert.equal(await slip.getByRole('alert').evaluate(el => el === document.activeElement), true);
        await snapshot('insufficient-balance');
      }
      await slip.getByLabel('每筆本金（點）', { exact: true }).fill('100');
      await slip.getByRole('button', { name: '檢查注單', exact: true }).click();
      if (checkGuards) {
        const dialog = page.getByRole('alertdialog');
        const box = await dialog.boundingBox();
        assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= 901);
        await confirm('返回修改');
        assert.equal((await state()).bets.length, 0);
        assert.equal((await state()).members[0].balance, '1000');
        await slip.getByRole('button', { name: '檢查注單', exact: true }).click();
      }
      await confirm('確認扣點下注');
      await page.getByRole('heading', { name: '我的注單', exact: true }).waitFor();
    }
    await page.goto('http://127.0.0.1:3000/sportsbook?mode=manage', { waitUntil: 'networkidle' });
    await page.getByRole('combobox', { name: '選手來源', exact: true }).selectOption('generated');
    await page.getByLabel('報名上限／示範人數', { exact: true }).fill('4');
    await button('建立活動').click();
    await page.getByRole('combobox', { name: '切換管理對局', exact: true }).waitFor();
    await button('檢視模式').click();
    await button('登入／註冊領 1,000 點').click();
    const auth = page.getByRole('dialog');
    await auth.getByRole('button', { name: '註冊', exact: true }).click();
    await auth.getByLabel('帳號', { exact: true }).fill('spectator-audit');
    await auth.getByLabel('密碼', { exact: true }).fill('isolated-audit-only');
    await auth.getByLabel('暱稱', { exact: true }).fill('觀眾驗收');
    await auth.getByRole('button', { name: '註冊並領取 1,000 點', exact: true }).click();
    await auth.waitFor({ state: 'hidden' });
    assert.equal((await state()).members[0].balance, '1000');
    await snapshot('logged-in-markets');

    // Current scheduled and future scheduled matches both accept tickets.
    await wager('整場勝負', 0, true);
    await button('投注區').click();
    await page.getByRole('combobox', { name: '選擇場次', exact: true }).selectOption('m1-1');
    await wager('整場勝負');
    await button('投注區').click();
    await page.getByRole('combobox', { name: '投注類型', exact: true }).selectOption('place');
    await wager('冠軍');
    let current = await state();
    assert.equal(current.bets.length, 3);
    assert.equal(current.members[0].balance, '700');
    await snapshot('match-and-champion-tickets');

    // Enter actual results through admin UI; no database fixture mutation.
    await button('管理模式').click();
    const details = page.locator('details').filter({ has: page.getByText('賽果與結算', { exact: true }) });
    if (!(await details.evaluate(el => el.open))) await details.locator('summary').click();
    for (const id of ['m1-0', 'm1-1', 'm2-0', 'podium-third']) {
      await page.getByRole('combobox', { name: '切換管理對局', exact: true }).selectOption(id);
      const active = details.locator('article').filter({ has: page.locator(`a[href*="match=${id}"]`) });
      await active.getByRole('button', { name: '開始比賽', exact: true }).click();
      await confirm('開始比賽並封盤');
      if (id === 'm1-0') {
        current = await state();
        assert.ok(current.markets.filter(m => m.kind === 'place').every(m => m.status === 'closed'));
        assert.ok(current.markets.filter(m => m.matchId === 'm1-0').every(m => m.status === 'closed'));
        assert.ok(current.markets.filter(m => m.matchId === 'm1-1').every(m => m.status === 'open'));
        await button('檢視模式').click();
        await page.getByRole('combobox', { name: '投注類型', exact: true }).selectOption('match');
        await page.getByRole('combobox', { name: '選擇場次', exact: true }).selectOption('m1-0');
        assert.equal(await market('整場勝負').getByRole('button', { name: /選擇/ }).first().isDisabled(), true);
        await snapshot('live-match-closed');
        await page.getByRole('combobox', { name: '選擇場次', exact: true }).selectOption('m1-1');
        assert.equal(await market('整場勝負').getByRole('button', { name: /選擇/ }).first().isEnabled(), true);
        await page.getByRole('combobox', { name: '投注類型', exact: true }).selectOption('place');
        assert.equal(await market('冠軍').getByRole('button', { name: /選擇/ }).first().isDisabled(), true);
        await snapshot('champion-closed');
        await button('管理模式').click();
        if (!(await details.evaluate(el => el.open))) await details.locator('summary').click();
        await page.getByRole('combobox', { name: '切換管理對局', exact: true }).selectOption(id);
      }
      await active.getByRole('button', { name: '填寫逐局賽果', exact: true }).click();
      const draft = page.getByRole('dialog', { name: '逐局賽果草稿', exact: true });
      for (let i = 0; i < 2; i++) {
        await draft.locator(`[name="winner${i}"]`).selectOption({ index: 1 });
        await draft.locator(`[name="seconds${i}"]`).fill('90');
      }
      await draft.getByRole('button', { name: '儲存賽果草稿', exact: true }).click();
      await draft.waitFor({ state: 'hidden' });
      await active.getByRole('button', { name: '檢查結算', exact: true }).click();
      await confirm('結算並派彩');
    }
    current = await state();
    assert.ok(current.bets.every(b => b.status === 'won'));
    const expectedBalance = 700n + current.bets.reduce((sum, bet) => sum + BigInt(bet.payout), 0n);
    assert.equal(current.members[0].balance, String(expectedBalance));
    assert.ok(current.markets.filter(m => m.kind === 'place').every(m => m.status === 'settled'));
    await button('檢視模式').click();
    await button('我的注單').click();
    await snapshot('settled-tickets');
    await button('點數紀錄').click();
    await snapshot('settled-ledger');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal((await state()).members[0].balance, String(expectedBalance));
    results.push({ width, tickets: current.bets.length, finalBalance: String(expectedBalance), allWon: true, persisted: true });
    await context.close();
  }
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
