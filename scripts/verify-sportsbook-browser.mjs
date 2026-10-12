// Real local UI and IndexedDB in isolated contexts; never attaches the user's profile.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright-core');
const output = 'docs/previews/sportsbook-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 768, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    async function snapshot(name) {
      const geometry = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth,
        small: [...document.querySelectorAll('button,input:not([type=checkbox]):not([type=radio]),select,textarea')]
          .filter(el => el.checkVisibility() && !el.disabled && !el.closest('nextjs-portal'))
          .map(el => ({ text: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30) || el.name,
            height: el.getBoundingClientRect().height }))
          .filter(el => el.height < 43.5),
      }));
      await page.screenshot({ path: `${output}/${width}-${name}.png`, fullPage: true, animations: 'disabled' });
      if (await page.locator('dialog[open]').count()) {
        await page.screenshot({ path: `${output}/${width}-${name}-viewport.png`, animations: 'disabled' });
        const modal = page.locator('dialog[open]').last();
        const box = await modal.boundingBox();
        assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= page.viewportSize().height + 1, `${width}/${name}: modal outside viewport`);
        const focus = await page.evaluateHandle(() => document.activeElement);
        for (let i = 0; i < 16; i++) {
          await page.keyboard.press(i < 8 ? 'Tab' : 'Shift+Tab');
          // Native dialogs may hand focus to browser chrome (activeElement becomes body).
          // No page-background control may receive focus.
          assert.equal(await modal.evaluate(el => document.activeElement === document.body || el.contains(document.activeElement)), true, `${name}: focus entered page background`);
        }
        await page.getByRole('main').evaluate(el => el.focus());
        assert.equal(await page.getByRole('main').evaluate(el => el === document.activeElement), false, `${name}: background accepted focus`);
        await focus.evaluate(el => el?.focus());
        await focus.dispose();
      } else if (name === 'insufficient-balance' || name === 'parlay-slip') {
        await page.screenshot({ path: `${output}/${width}-${name}-viewport.png`, animations: 'disabled' });
      }
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const violations = await page.evaluate(async () => (await window.axe.run(document.body, {
        runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa'] },
      })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })));
      results.push({ width, name, geometry, violations });
      assert.ok(geometry.document <= width + 1, `${width}/${name}: page overflow`);
      assert.deepEqual(geometry.small, [], `${width}/${name}: targets under 44px`);
      assert.deepEqual(violations, [], `${width}/${name}: axe`);
    }
    async function balance(value) {
      await page.waitForFunction(value => document.querySelector('header strong')?.textContent?.replace(/\D/g, '') === value, value);
    }
    async function confirm(action) {
      const dialog = page.getByRole('alertdialog');
      await dialog.getByRole('button', { name: action, exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
    }
    async function openSlip() {
      if (width <= 900) {
        const toggle = page.getByRole('button', { name: /查看注單 ↑/ });
        if (await toggle.isVisible()) await toggle.click();
      }
    }
    async function closeSlip() {
      if (width <= 900) {
        const toggle = page.getByRole('button', { name: /繼續選盤 ↓/ });
        if (await toggle.isVisible()) await toggle.click();
      }
    }
    const market = title => page.locator('section').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
    await page.goto('http://127.0.0.1:3000/sportsbook?mode=manage', { waitUntil: 'networkidle' });
    await page.getByRole('combobox', { name: '選手來源', exact: true }).selectOption('generated');
    await page.getByLabel('報名上限／示範人數', { exact: true }).fill('4');
    await page.getByRole('button', { name: '建立活動', exact: true }).click();
    await page.getByRole('combobox', { name: '切換管理對局', exact: true }).waitFor();
    await page.getByRole('button', { name: '檢視模式', exact: true }).click();
    await page.getByRole('button', { name: '登入／註冊領 1,000 點', exact: true }).click();
    const auth = page.getByRole('dialog');
    await auth.getByRole('button', { name: '註冊', exact: true }).click();
    await auth.getByLabel('帳號', { exact: true }).fill('audience-test');
    await auth.getByLabel('密碼', { exact: true }).fill('isolated-only');
    await auth.getByLabel('暱稱', { exact: true }).fill('觀局客');
    await auth.getByRole('button', { name: '註冊並領取 1,000 點', exact: true }).click();
    await auth.waitFor({ state: 'hidden' });
    await balance('1000');
    for (const title of ['整場勝負', 'BO3 比分']) {
      await market(title).getByRole('button', { name: '投票', exact: true }).first().click();
      await market(title).getByRole('button', { name: '已投', exact: true }).waitFor();
      await market(title).getByRole('button', { name: /選擇/ }).first().click();
    }
    // Both categories retain their vote; changing one does not erase the other.
    assert.equal(await page.getByRole('button', { name: '已投', exact: true }).count(), 2);
    if (width <= 900) assert.equal(await page.getByRole('button', { name: /查看注單 ↑/ }).getAttribute('aria-expanded'), 'false');
    await snapshot('markets-selected');
    await openSlip();
    const slip = page.getByRole('complementary', { name: '我的注單' });
    if (width > 900) {
      assert.equal(await slip.evaluate(el => getComputedStyle(el).overflowY), 'visible');
      await slip.scrollIntoViewIfNeeded();
      const box = await slip.boundingBox();
      const before = await page.evaluate(() => scrollY);
      await page.mouse.move(box.x + box.width / 2, box.y + 60);
      await page.mouse.wheel(0, 400);
      await page.waitForFunction(before => scrollY > before + 100, before);
      await page.setViewportSize({ width, height: 540 });
      await page.waitForFunction(() => document.querySelector('aside')?.dataset.fits === 'false');
      assert.equal(await slip.evaluate(el => getComputedStyle(el).position), 'static');
      await snapshot('short-viewport-document-scroll');
      await page.setViewportSize({ width, height: 900 });
    }
    await slip.getByRole('button', { name: '查看選項與設定（2）', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '選項與投注設定', exact: true });
    await snapshot('slip-settings');
    await page.keyboard.press('Escape');
    await editor.waitFor({ state: 'hidden' });
    assert.equal(await slip.getByRole('button', { name: '查看選項與設定（2）', exact: true }).evaluate(el => el === document.activeElement), true);
    await slip.getByLabel('每筆本金（點）', { exact: true }).fill('600');
    await slip.getByRole('button', { name: '檢查注單', exact: true }).click();
    await slip.getByRole('alert').filter({ hasText: '可用點數不足' }).waitFor();
    await snapshot('insufficient-balance');
    // The actionable error must be visible beside the slip, not only above the markets.
    assert.ok(await slip.getByText('可用點數不足。', { exact: true }).isVisible(), 'Slip must show insufficient balance locally');
    assert.equal(await slip.getByRole('alert').evaluate(el => el === document.activeElement), true);
    await slip.getByLabel('每筆本金（點）', { exact: true }).fill('100');
    await slip.getByRole('button', { name: '檢查注單', exact: true }).click();
    await snapshot('bet-confirm');
    await confirm('確認扣點下注');
    await balance('800');
    assert.equal(await page.getByRole('main').evaluate(el => el === document.activeElement), true, 'After submitting, focus moves to ticket content when the slip trigger disappears');
    await closeSlip();
    await page.getByRole('button', { name: '我的注單', exact: true }).click();
    assert.equal(await page.getByText('待結算', { exact: true }).count(), 2);
    await snapshot('tickets');
    await page.getByRole('button', { name: '場次盤', exact: true }).click();
    await openSlip();
    await slip.getByRole('combobox', { name: '投注方式', exact: true }).selectOption('parlay');
    await closeSlip();
    await market('整場勝負').getByRole('button', { name: /選擇/ }).first().click();
    await page.getByRole('combobox', { name: '選擇場次', exact: true }).selectOption('m1-1');
    await market('整場勝負').getByRole('button', { name: /選擇/ }).first().click();
    await openSlip();
    assert.match(await slip.getByRole('region', { name: '注單賠率' }).innerText(), /3.610/);
    await slip.getByLabel('每組本金（點）', { exact: true }).fill('100');
    await snapshot('parlay-slip');
    await slip.getByRole('button', { name: '檢查注單', exact: true }).click();
    await confirm('確認扣點下注');
    await balance('700');
    await page.getByRole('button', { name: '獎品兌換', exact: true }).click();
    await page.getByRole('button', { name: '申請兌換', exact: true }).first().click();
    await snapshot('redeem-confirm');
    await confirm('確認扣點兌換');
    await balance('400');
    await snapshot('redeem-pending');
    await page.getByRole('button', { name: '取消並退款', exact: true }).click();
    await confirm('取消並退回點數');
    await balance('700');
    await snapshot('redeem-cancelled');
    await page.getByRole('button', { name: '管理模式', exact: true }).click();
    const matchDetails = page.locator('details').filter({ has: page.getByText('賽果與結算', { exact: true }) });
    if (!(await matchDetails.evaluate(el => el.open))) await matchDetails.locator('summary').click();
    await snapshot('match-management');
    for (const [id, expectedBalance] of [['m1-0', '1270'], ['m1-1', '1631']]) {
      await page.getByRole('combobox', { name: '切換管理對局', exact: true }).selectOption(id);
      const active = matchDetails.locator('article').filter({ has: page.locator(`a[href*="match=${id}"]`) });
      await active.getByRole('button', { name: '開始比賽', exact: true }).click();
      await snapshot(`start-${id}`);
      await confirm('開始比賽並封盤');
      await active.getByRole('button', { name: '填寫逐局賽果', exact: true }).click();
      const draft = page.getByRole('dialog', { name: '逐局賽果草稿', exact: true });
      for (let i = 0; i < 2; i++) {
        await draft.locator(`select[name="winner${i}"]`).selectOption({ index: 1 });
        await draft.locator(`input[name="seconds${i}"]`).fill(String(90 + i * 5));
      }
      await snapshot(`result-draft-${id}`);
      await draft.getByRole('button', { name: '儲存賽果草稿', exact: true }).click();
      await draft.waitFor({ state: 'hidden' });
      await active.getByRole('button', { name: '檢查結算', exact: true }).click();
      await snapshot(`settle-${id}`);
      await confirm('結算並派彩');
      await balance(expectedBalance);
      assert.equal(await active.getByRole('button', { name: '填寫逐局賽果', exact: true }).count(), 0);
    }
    await page.getByRole('button', { name: '檢視模式', exact: true }).click();
    await page.getByRole('button', { name: '我的注單', exact: true }).click();
    assert.equal(await page.locator('article > header > strong').filter({ hasText: /^中獎$/ }).count(), 3);
    await snapshot('settled-tickets');
    await page.getByRole('button', { name: '點數紀錄', exact: true }).click();
    await snapshot('ledger');
    // A second redemption is approved and delivered. Its final state has no repeat action.
    await page.getByRole('button', { name: '獎品兌換', exact: true }).click();
    await page.getByRole('button', { name: '申請兌換', exact: true }).first().click();
    await confirm('確認扣點兌換');
    await balance('1331');
    await page.getByRole('button', { name: '管理模式', exact: true }).click();
    const prizes = page.locator('details').filter({ has: page.getByText('獎品與兌換審核', { exact: true }) });
    await prizes.locator('summary').click();
    await prizes.getByRole('button', { name: '核准', exact: true }).click();
    await prizes.getByText('已核准 · 300 點', { exact: true }).waitFor();
    await snapshot('redemption-approved');
    await prizes.getByRole('button', { name: '標記已發放', exact: true }).click();
    await confirm('確認標記已發放');
    await prizes.getByText('已發放 · 300 點', { exact: true }).waitFor();
    assert.equal(await prizes.getByRole('button', { name: '標記已發放', exact: true }).count(), 0);
    await balance('1331');
    await snapshot('redemption-delivered');
    await prizes.getByRole('button', { name: '新增獎品', exact: true }).click();
    const prizeForm = page.getByRole('dialog', { name: '示範獎品設定', exact: true });
    await prizeForm.getByLabel('名稱', { exact: true }).fill('試玩墨印');
    await prizeForm.getByLabel('所需點數', { exact: true }).fill('100');
    await prizeForm.getByLabel('可用庫存', { exact: true }).fill('0');
    await snapshot('prize-editor');
    await prizeForm.getByRole('button', { name: '儲存獎品', exact: true }).click();
    await prizeForm.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: '檢視模式', exact: true }).click();
    await page.getByRole('button', { name: '獎品兌換', exact: true }).click();
    const emptyPrize = page.locator('article').filter({ has: page.getByRole('heading', { name: '試玩墨印', exact: true }) });
    assert.equal(await emptyPrize.getByRole('button', { name: '申請兌換', exact: true }).isDisabled(), true);
    await snapshot('out-of-stock');
    assert.deepEqual(errors, [], `${width}: runtime errors`);
    await context.close();
  }
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(JSON.stringify(results.map(({ width, name, violations }) => ({ width, name, violations })), null, 2));
