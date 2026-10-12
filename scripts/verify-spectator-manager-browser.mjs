// Spectator/admin cross-check: separate pages, shared isolated browser context.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'file:///C:/Users/User/Documents/code/react-vite-erp/node_modules/playwright-core/index.mjs';
const output = 'docs/previews/spectator-manager';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of process.env.TEST_WIDTH ? [Number(process.env.TEST_WIDTH)] : [1440, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const admin = await context.newPage(), viewer = await context.newPage();
    const errors = [];
    for (const page of [admin, viewer]) page.on('pageerror', e => errors.push(e.message));
    const button = (page, name) => page.getByRole('button', { name, exact: true });
    const state = () => viewer.evaluate(() => new Promise((resolve, reject) => {
      const r = indexedDB.open('lunjian-sportsbook-demo', 1);
      r.onsuccess = () => { const db = r.result; const g = db.transaction('state').objectStore('state').get('root'); g.onsuccess = () => { resolve(g.result); db.close(); }; g.onerror = () => reject(g.error); };
    }));
    async function confirm(page, name = '確認儲存') {
      const modal = page.getByRole('alertdialog');
      await modal.getByRole('button', { name, exact: true }).click();
      await modal.waitFor({ state: 'hidden' });
    }
    async function expand(page, summary) {
      const d = page.locator('details').filter({ has: page.locator('summary').getByText(summary, { exact: true }) }).first();
      if (!(await d.evaluate(el => el.open))) await d.locator('summary').first().click();
      return d;
    }
    async function screenshot(name) {
      assert.equal(await viewer.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert.deepEqual(errors, []);
      await viewer.screenshot({ path: `${output}/${width}-${name}.png`, fullPage: true });
      results.push({ width, name, errors: [...errors] });
      console.log(`${width}: ${name}`);
    }
    await admin.goto('http://127.0.0.1:3000/sportsbook?mode=manage', { waitUntil: 'networkidle' });
    await admin.getByRole('combobox', { name: '選手來源', exact: true }).selectOption('generated');
    await admin.getByLabel('報名上限／示範人數', { exact: true }).fill('4');
    await button(admin, '建立活動').click();
    await admin.getByRole('combobox', { name: '切換管理對局', exact: true }).waitFor();
    await viewer.goto('http://127.0.0.1:3000/sportsbook', { waitUntil: 'networkidle' });
    await button(viewer, '登入／註冊領 1,000 點').click();
    const auth = viewer.getByRole('dialog');
    await button(auth, '註冊').click();
    await auth.getByLabel('帳號', { exact: true }).fill('market-crosscheck');
    await auth.getByLabel('密碼', { exact: true }).fill('isolated-only-password');
    await auth.getByLabel('暱稱', { exact: true }).fill('交叉觀眾');
    await button(auth, '註冊並領取 1,000 點').click();
    await auth.waitFor({ state: 'hidden' });
    const controls = await expand(admin, '下注類型與盤口開關');
    const form = controls.locator('form').first();
    await form.getByLabel('盤口名稱').fill('首戰勝負');
    await button(form, '儲存名稱').click();
    const market = () => viewer.getByRole('heading', { name: '首戰勝負', exact: true }).locator('..').locator('..');
    await viewer.getByRole('heading', { name: '首戰勝負', exact: true }).waitFor();
    await market().getByRole('button', { name: /選擇/ }).first().click();
    await button(form, '暫停投注').click();
    await button(form, '重新開放').waitFor();
    await viewer.waitForFunction(() => [...document.querySelectorAll('h3')].find(h => h.textContent === '首戰勝負')?.closest('section')?.querySelector('button')?.disabled);
    const open = viewer.getByRole('button', { name: /查看注單 ↑/ });
    if (await open.isVisible()) await open.click();
    const slip = viewer.getByRole('complementary', { name: '我的注單' });
    await slip.getByLabel('每筆本金（點）', { exact: true }).fill('100');
    await button(slip, '檢查注單').click();
    await slip.getByRole('alert').waitFor();
    assert.equal((await state()).bets.length, 0);
    assert.equal((await state()).members[0].balance, '1000');
    await screenshot('paused-draft-rejected');
    await button(form, '重新開放').click();
    await button(form, '暫停投注').waitFor();
    await viewer.waitForFunction(() => ![...document.querySelectorAll('h3')].find(h => h.textContent === '首戰勝負')?.closest('section')?.querySelector('button')?.disabled);
    await button(slip, '檢查注單').click();
    await confirm(viewer, '確認扣點下注');
    await viewer.getByRole('heading', { name: '我的注單', exact: true }).waitFor();
    const originalBet = structuredClone((await state()).bets[0]);
    await admin.waitForFunction(() => document.querySelector('[aria-label="活動管理工具"] input[name="title"]')?.disabled);
    assert.equal(await form.getByLabel('盤口名稱').isDisabled(), true);
    await button(controls, '全部暫停').click();
    await confirm(admin, '暫停投注');
    assert.deepEqual((await state()).bets[0], originalBet);

    const resultControls = await expand(admin, '賽果與結算');
    for (const id of ['m1-0', 'm1-1']) {
      await admin.getByRole('combobox', { name: '切換管理對局', exact: true }).selectOption(id);
      const active = resultControls.locator('article').filter({ has: admin.locator(`a[href*="match=${id}"]`) });
      await button(active, '開始比賽').click();
      await confirm(admin, '開始比賽並封盤');
      if (id === 'm1-0') {
        await button(controls, '開放未開賽項目').click();
        await admin.waitForFunction(() => [...document.querySelectorAll('button')].find(b => b.textContent === '開放未開賽項目')?.disabled === false);
        const current = await state();
        assert.ok(current.markets.filter(m => m.matchId === id).every(m => m.status === 'closed'));
        await button(controls, '全部暫停').click();
        await confirm(admin, '暫停投注');
      }
      await button(active, '填寫逐局賽果').click();
      const draft = admin.getByRole('dialog', { name: '逐局賽果草稿', exact: true });
      for (let i = 0; i < 2; i++) {
        await draft.locator(`[name="winner${i}"]`).selectOption({ index: 1 });
        await draft.locator(`[name="seconds${i}"]`).fill('90');
      }
      await button(draft, '儲存賽果草稿').click();
      await draft.waitFor({ state: 'hidden' });
      await button(active, '檢查結算').click();
      await confirm(admin, '結算並派彩');
    }
    const after = await state();
    assert.equal(after.bets[0].status, 'won');
    assert.deepEqual(after.bets[0].legs, originalBet.legs);
    assert.equal(after.bets[0].payout, '190');
    assert.equal(after.members[0].balance, '1090');
    const future = after.markets.filter(m => m.kind === 'winner' && ['m2-0', 'podium-third'].includes(m.matchId));
    assert.equal(future.length, 2);
    assert.ok(future.every(m => m.status === 'closed'), 'Disabled type applies to newly created later rounds');
    await button(viewer, '投注區').click();
    await viewer.getByRole('combobox', { name: '選擇場次', exact: true }).selectOption('m2-0');
    const finalMarket = viewer.getByRole('heading', { name: '整場勝負', exact: true }).locator('..').locator('..');
    assert.equal(await finalMarket.getByRole('button', { name: /選擇/ }).first().isDisabled(), true);
    await screenshot('future-round-type-stays-closed');

    const ceremony = await expand(admin, '抽獎與頒獎');
    await ceremony.getByRole('combobox', { name: '抽獎獎品', exact: true }).selectOption('prize-0');
    await ceremony.getByRole('button', { name: /抽取 1 名/ }).click();
    await button(ceremony, '標記頒發').waitFor();
    await button(viewer, '我的獎品').click();
    await viewer.getByRole('region', { name: '活動得獎紀錄' }).waitFor();
    await viewer.getByText('待現場頒發', { exact: true }).waitFor();
    await screenshot('raffle-recipient-pending');
    await button(ceremony, '標記頒發').click();
    await confirm(admin, '確認標記頒發');
    await viewer.getByText('已標記頒發', { exact: true }).waitFor();
    await screenshot('raffle-recipient-delivered');
    // A separate event lets this member receive an award as a player without
    // changing the locked spectator membership of the already-bet event.
    const create = await expand(admin, '另開一屆試玩');
    await create.getByLabel('賽事名稱', { exact: true }).fill('頒獎驗收活動');
    await create.getByRole('combobox', { name: '選手來源', exact: true }).selectOption('generated');
    await create.getByLabel('報名上限／示範人數', { exact: true }).fill('2');
    await button(create, '建立活動').click();
    await admin.getByRole('combobox', { name: '切換管理對局', exact: true }).waitFor();
    const members = await expand(admin, '會員與參賽者對應');
    await members.getByRole('combobox', { name: '交叉觀眾', exact: true }).selectOption('p1');
    const awards = await expand(admin, '抽獎與頒獎');
    await awards.getByRole('combobox', { name: '得獎選手', exact: true }).selectOption('p1');
    await awards.getByLabel('獎項名稱', { exact: true }).fill('最佳風采');
    await awards.getByLabel('獎勵內容', { exact: true }).fill('紀念獎牌');
    await button(awards, '登錄獎項').click();
    await confirm(admin, '登錄獎項');
    await viewer.getByRole('heading', { name: '最佳風采 · 紀念獎牌', exact: true }).waitFor();
    const awardReceipt = viewer.getByRole('heading', { name: '最佳風采 · 紀念獎牌', exact: true }).locator('..');
    await awardReceipt.getByText('待現場頒發', { exact: true }).waitFor();
    await button(awards, '標記頒發').click();
    await confirm(admin, '確認標記頒發');
    await awardReceipt.getByText('已標記頒發', { exact: true }).waitFor();
    await screenshot('award-recipient-delivered');
    await viewer.reload({ waitUntil: 'networkidle' });
    await button(viewer, '我的獎品').click();
    await viewer.getByRole('heading', { name: '最佳風采 · 紀念獎牌', exact: true }).waitFor();
    results.push({ width, preservedOdds: originalBet.legs[0].odds, payout: '190', balance: '1090', futureTypeClosed: true, raffleReceipt: true, awardReceipt: true });
    await context.close();
  }
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
