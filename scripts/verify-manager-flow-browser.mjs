// Fresh contexts only: all members, events and awards are disposable local data.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'file:///C:/Users/User/Documents/code/react-vite-erp/node_modules/playwright-core/index.mjs';
const output = 'docs/previews/manager-flow';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of process.env.TEST_WIDTH ? [Number(process.env.TEST_WIDTH)] : [1440, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const button = name => page.getByRole('button', { name, exact: true });
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
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${width}/${name}: horizontal overflow`);
      assert.deepEqual(errors, [], `${width}/${name}: page errors`);
      await page.screenshot({ path: `${output}/${width}-${name}.png`, fullPage: true, animations: 'disabled' });
      results.push({ width, name, errors: [...errors] });
      console.log(`${width}: ${name}`);
    }
    async function confirm(name = '確認儲存') {
      const dialog = page.getByRole('alertdialog');
      await dialog.getByRole('button', { name, exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
    }
    await page.goto('http://127.0.0.1:3000/sportsbook?mode=manage', { waitUntil: 'networkidle' });
    await page.getByRole('combobox', { name: '選手來源', exact: true }).selectOption('generated');
    await page.getByLabel('報名上限／示範人數', { exact: true }).fill('4');
    await button('建立活動').click();
    await page.getByRole('combobox', { name: '切換管理對局', exact: true }).waitFor();
    const ops = page.getByRole('region', { name: '活動管理工具' });
    await ops.getByText('抽籤與籤位安排', { exact: true }).click();
    const seats = ops.getByRole('list', { name: '首輪籤位預覽' });
    const before = await seats.locator('strong').allTextContents();
    const current = await state();
    const ids = current.events[0].players.map(p => p.id);
    // Native drag on desktop; select provides the same operation for touch/keyboard.
    if (width > 700) await seats.locator('li').nth(0).dragTo(seats.locator('li').nth(1));
    else await seats.getByRole('combobox').first().selectOption(ids[1]);
    assert.deepEqual(await seats.locator('strong').allTextContents(), [before[1], before[0], before[2], before[3]]);
    await button('抽取籤位').click();
    assert.equal(await ops.getByLabel('求籤台').getAttribute('data-drawing'), 'true');
    await button('抽取籤位').waitFor();
    assert.deepEqual(new Set(await seats.locator('strong').allTextContents()), new Set(before));
    await button('確認套用籤位').click();
    await confirm('套用籤位');
    await snapshot('draw-and-seats');
    await ops.getByText('抽籤與籤位安排', { exact: true }).click();
    await ops.getByText('下注類型與盤口開關', { exact: true }).click();
    await ops.getByLabel('盤口名稱', { exact: true }).first().fill('夜鴨首戰勝負');
    await ops.getByRole('button', { name: '儲存名稱', exact: true }).first().click();
    await page.waitForFunction(() => [...document.querySelectorAll('input')].some(e => e.value === '夜鴨首戰勝負'));
    await button('全部暫停').click();
    await confirm('暫停投注');
    assert.equal((await state()).markets.filter(m => m.kind === 'winner').every(m => m.status === 'closed'), true);
    await button('開放未開賽項目').click();
    await button('全部暫停').waitFor({ state: 'visible' });
    await page.waitForTimeout(200);
    assert.equal((await state()).markets.filter(m => m.kind === 'winner').every(m => m.status === 'open'), true);
    await snapshot('market-controls');
    await button('檢視模式').click();
    await button('登入／註冊領 1,000 點').click();
    const auth = page.getByRole('dialog');
    await auth.getByRole('button', { name: '註冊', exact: true }).click();
    await auth.getByLabel('帳號', { exact: true }).fill('manager-flow-member');
    await auth.getByLabel('密碼', { exact: true }).fill('isolated-manager-only');
    await auth.getByLabel('暱稱', { exact: true }).fill('抽獎驗收會員');
    await auth.getByRole('button', { name: '註冊並領取 1,000 點', exact: true }).click();
    await auth.waitFor({ state: 'hidden' });
    await button('管理模式').click();
    await ops.getByText('抽獎與頒獎', { exact: true }).click();
    await ops.getByRole('combobox', { name: '抽獎獎品', exact: true }).selectOption('prize-0');
    await button('抽取 1 名（1 人）').click();
    await ops.getByRole('status').filter({hasText:'抽獎驗收會員 · 示範獎品甲'}).waitFor();
    assert.equal((await state()).prizes[0].stock, 4);
    await button('標記頒發').click();
    await confirm('確認標記頒發');
    assert.equal((await state()).events[0].ceremony.draws[0].delivered, true);
    await ops.getByRole('combobox', { name: '得獎選手', exact: true }).selectOption(ids[0]);
    await ops.getByLabel('獎項名稱', { exact: true }).fill('最佳風采');
    await ops.getByLabel('獎勵內容', { exact: true }).fill('紀念品一份');
    await button('登錄獎項').click();
    await confirm('登錄獎項');
    await button('標記頒發').click();
    await confirm('確認標記頒發');
    assert.equal((await state()).events[0].ceremony.awards[0].delivered, true);
    await snapshot('raffle-and-awards');
    await page.reload({ waitUntil: 'networkidle' });
    await ops.getByText('抽獎與頒獎', { exact: true }).click();
    assert.equal(await ops.getByText('已標記頒發', { exact: true }).count(), 2);
    const matches = page.locator('details').filter({ has: page.getByText('賽果與結算', { exact: true }) });
    await page.getByRole('combobox', { name: '切換管理對局', exact: true }).selectOption('m1-1');
    await matches.getByRole('button', { name: '開始比賽', exact: true }).click();
    await confirm('開始比賽並封盤');
    assert.equal((await state()).events[0].matches.find(m => m.id === 'm1-1').status, 'live');
    await ops.getByText('抽籤與籤位安排', { exact: true }).click();
    assert.equal(await button('確認套用籤位').isDisabled(), true);
    await snapshot('chosen-match-started');
    await context.close();
  }
  // Non-power-of-two roster: preview must match actual byes and group boundaries.
  {
    const context = await browser.newContext({ viewport: { width: 786, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:3000/sportsbook?mode=manage', { waitUntil: 'networkidle' });
    await page.getByRole('combobox', { name: '選手來源', exact: true }).selectOption('generated');
    await page.getByLabel('報名上限／示範人數', { exact: true }).fill('5');
    await page.getByRole('button', { name: '建立活動', exact: true }).click();
    const ops = page.getByRole('region', { name: '活動管理工具' });
    await ops.getByText('抽籤與籤位安排', { exact: true }).click();
    const seats = ops.getByRole('list', { name: '首輪籤位預覽' });
    assert.equal(await seats.getByText('輪空', { exact: true }).count(), 3);
    await ops.getByRole('button', { name: '抽取籤位', exact: true }).click();
    await ops.getByRole('status').filter({ hasText: '抽籤完成' }).waitFor();
    const preview = await seats.locator('li').evaluateAll(items => items.map(li => ({ id: li.dataset.player, group: Number(li.dataset.group) })));
    await ops.getByRole('button', { name: '確認套用籤位', exact: true }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: '套用籤位', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    const actual = await page.evaluate(() => new Promise(resolve => {
      const request = indexedDB.open('lunjian-sportsbook-demo', 1);
      request.onsuccess = () => {
        const db = request.result, get = db.transaction('state', 'readonly').objectStore('state').get('root');
        get.onsuccess = () => { const e = get.result.events[0]; resolve(e.matches.filter(m => m.round === 1 && m.kind === 'bracket').sort((a, b) => a.slot - b.slot).flatMap(m => [{ id: m.p1, group: m.slot + 1 }, { id: m.p2, group: m.slot + 1 }])); db.close(); };
      };
    }));
    assert.deepEqual(preview, actual);
    await page.screenshot({ path: `${output}/786-five-player-byes.png`, fullPage: true, animations: 'disabled' });
    results.push({ width: 786, name: 'five-player-byes-match-preview' });
    console.log('786: five-player-byes-match-preview');
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
}
