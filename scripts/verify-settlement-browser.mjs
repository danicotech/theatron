// Real local UI and IndexedDB in isolated contexts; never attaches the user's profile.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
    : 'playwright-core'
);
const output = 'docs/previews/settlement-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of process.env.TEST_WIDTH
    ? [Number(process.env.TEST_WIDTH)]
    : [1440, 768, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    let page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    async function snapshot(name) {
      const geometry = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth,
        small: [
          ...document.querySelectorAll(
            'button,input:not([type=checkbox]):not([type=radio]),select,textarea',
          ),
        ]
          .filter((el) => el.checkVisibility() && !el.disabled && !el.closest('nextjs-portal'))
          .map((el) => ({
            text: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30) || el.name,
            height: el.getBoundingClientRect().height,
          }))
          .filter((el) => el.height < 43.5),
      }));
      await page.screenshot({
        path: `${output}/${width}-${name}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      if (await page.locator('dialog[open]').count()) {
        await page.screenshot({
          path: `${output}/${width}-${name}-viewport.png`,
          animations: 'disabled',
        });
        const modal = page.locator('dialog[open]').last();
        const box = await modal.boundingBox();
        assert.ok(
          box.x >= -1 &&
            box.y >= -1 &&
            box.x + box.width <= width + 1 &&
            box.y + box.height <= page.viewportSize().height + 1,
          `${width}/${name}: modal outside viewport`,
        );
        const focus = await page.evaluateHandle(() => document.activeElement);
        for (let i = 0; i < 16; i++) {
          await page.keyboard.press(i < 8 ? 'Tab' : 'Shift+Tab');
          // Native dialogs may hand focus to browser chrome (activeElement becomes body).
          // No page-background control may receive focus.
          assert.equal(
            await modal.evaluate(
              (el) =>
                document.activeElement === document.body || el.contains(document.activeElement),
            ),
            true,
            `${name}: focus entered page background`,
          );
        }
        await page.getByRole('main').evaluate((el) => el.focus());
        assert.equal(
          await page.getByRole('main').evaluate((el) => el === document.activeElement),
          false,
          `${name}: background accepted focus`,
        );
        await focus.evaluate((el) => el?.focus());
        await focus.dispose();
      } else if (name === 'insufficient-balance' || name === 'parlay-slip') {
        await page.screenshot({
          path: `${output}/${width}-${name}-viewport.png`,
          animations: 'disabled',
        });
      }
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const violations = await page.evaluate(async () =>
        (
          await window.axe.run(document.body, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
          })
        ).violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      );
      results.push({ width, name, geometry, violations });
      console.log(JSON.stringify({ width, name, violations }));
      assert.ok(geometry.document <= width + 1, `${width}/${name}: page overflow`);
      assert.deepEqual(geometry.small, [], `${width}/${name}: targets under 44px`);
      assert.deepEqual(violations, [], `${width}/${name}: axe`);
    }
    async function balance(value) {
      await page.waitForFunction(
        (value) =>
          document.querySelector('header strong')?.textContent?.replace(/\D/g, '') === value,
        value,
      );
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
    const market = (title) =>
      page.locator('section').filter({
        has: page.getByRole('heading', {
          name: title.includes('時間')
            ? `${title} · ${title === '整場總時間' ? 180 : 90} 秒`
            : title,
          exact: true,
        }),
      });
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

    const button = (name) => page.getByRole('button', { name, exact: true });
    let slip = page.getByRole('complementary', { name: '我的注單' });
    for (const title of [
      '整場勝負',
      'BO3 比分',
      '第 1 局勝負',
      '第 2 局勝負',
      '第 3 局勝負',
      '第 1 局時間',
      '第 2 局時間',
      '第 3 局時間',
      '整場總時間',
    ]) {
      const choices = market(title).getByRole('button', { name: /選擇/ });
      await (title.includes('時間') ? choices.last() : choices.first()).click();
    }
    await openSlip();
    await slip.getByLabel('每筆本金（點）', { exact: true }).fill('100');
    await slip.getByRole('button', { name: '檢查注單', exact: true }).click();
    await confirm('確認扣點下注');
    await balance('100');
    assert.equal(await page.locator('article > header > strong').count(), 9);
    await snapshot('all-match-markets-tickets');
    const matchPage = page;
    const podiumPage = await context.newPage();
    page = podiumPage;
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(matchPage.url(), { waitUntil: 'networkidle' });
    await button('登入／註冊領 1,000 點').click();
    const podiumAuth = page.getByRole('dialog');
    await podiumAuth.getByRole('button', { name: '註冊', exact: true }).click();
    await podiumAuth.getByLabel('帳號', { exact: true }).fill('podium-audience');
    await podiumAuth.getByLabel('密碼', { exact: true }).fill('isolated-only');
    await podiumAuth.getByLabel('暱稱', { exact: true }).fill('名次觀局客');
    await podiumAuth.getByRole('button', { name: '註冊並領取 1,000 點', exact: true }).click();
    await podiumAuth.waitFor({ state: 'hidden' });
    await balance('1000');
    slip = page.getByRole('complementary', { name: '我的注單' });
    const podium = [
      ['冠軍', '聞人夜'],
      ['亞軍', '柳三更'],
      ['季軍', '沈青梧'],
      ['殿軍', '白十七'],
    ];
    for (const [i, [place, player]] of podium.entries()) {
      await button('名次盤').click();
      if (width <= 900) assert.equal(await slip.getAttribute('data-open'), 'false');
      await market(place)
        .getByRole('button', { name: new RegExp(`選擇 ${player}`) })
        .click();
      await openSlip();
      await slip.getByLabel('每筆本金（點）', { exact: true }).fill('100');
      await slip.getByRole('button', { name: '檢查注單', exact: true }).click();
      await confirm('確認扣點下注');
      await balance(String(900 - i * 100));
    }
    await snapshot('podium-tickets');
    page = matchPage;
    await button('管理模式').click();
    const matchDetails = page
      .locator('details')
      .filter({ has: page.getByText('賽果與結算', { exact: true }) });
    if (!(await matchDetails.evaluate((el) => el.open)))
      await matchDetails.locator('summary').click();
    for (const [id, sides, seconds, expected] of [
      ['m1-0', [1, 1], [90, 90], '1820'],
      ['m1-1', [2, 1, 2], [89, 91, 90], '1820'],
      ['m2-0', [1, 2, 1], [60, 70, 50], '1820'],
      ['podium-third', [2, 2], [60, 60], '1820'],
    ]) {
      await page.getByRole('combobox', { name: '切換管理對局', exact: true }).selectOption(id);
      const active = matchDetails
        .locator('article')
        .filter({ has: page.locator(`a[href*="match=${id}"]`) });
      await active.getByRole('button', { name: '開始比賽', exact: true }).click();
      await confirm('開始比賽並封盤');
      await active.getByRole('button', { name: '填寫逐局賽果', exact: true }).click();
      const draft = page.getByRole('dialog', { name: '逐局賽果草稿', exact: true });
      if (id === 'm1-0') {
        await draft.locator('[name="winner0"]').selectOption({ index: 1 });
        await draft.locator('[name="winner1"]').selectOption({ index: 2 });
        await draft.locator('[name="seconds0"]').fill('90');
        await draft.locator('[name="seconds1"]').fill('90');
        await draft.getByRole('button', { name: '儲存賽果草稿', exact: true }).click();
        await draft.getByRole('alert').waitFor();
        assert.match(await draft.getByRole('alert').innerText(), /BO3 尚未產生勝者/);
        assert.equal(
          await draft.getByRole('alert').evaluate((el) => el === document.activeElement),
          true,
        );
        await snapshot('incomplete-result-error');
        await draft.locator('[name="winner1"]').selectOption({ index: 1 });
        assert.equal(await draft.getByRole('alert').count(), 0);
        await draft.locator('[name="winner2"]').selectOption({ index: 1 });
        await draft.locator('[name="seconds2"]').fill('60');
        await draft.getByRole('button', { name: '儲存賽果草稿', exact: true }).click();
        await draft.getByRole('alert').waitFor();
        assert.match(await draft.getByRole('alert').innerText(), /已取得兩勝/);
        await snapshot('extra-round-error');
        await draft.getByRole('button', { name: '關閉視窗', exact: true }).click();
        await active.getByRole('button', { name: '填寫逐局賽果', exact: true }).click();
        assert.equal(await draft.locator('[name="winner0"]').inputValue(), '');
        assert.equal(await draft.getByRole('alert').count(), 0);
      }
      for (let i = 0; i < sides.length; i++) {
        await draft.locator(`[name="winner${i}"]`).selectOption({ index: sides[i] });
        if (id === 'm1-1' && i === 2) {
          await draft.getByRole('button', { name: '儲存賽果草稿', exact: true }).click();
          await draft.getByRole('alert').waitFor();
          assert.match(await draft.getByRole('alert').innerText(), /每局須選擇勝者/);
          assert.equal(
            await draft.getByRole('alert').evaluate((el) => el === document.activeElement),
            true,
          );
          await snapshot('missing-third-seconds');
        }
        await draft.locator(`[name="seconds${i}"]`).fill(String(seconds[i]));
      }
      await draft.getByRole('button', { name: '儲存賽果草稿', exact: true }).click();
      await draft.waitFor({ state: 'hidden' });
      const before = await page.locator('header strong').first().innerText();
      await active.getByRole('button', { name: '檢查結算', exact: true }).click();
      const review = page.getByRole('alertdialog').getByRole('list', { name: '待確認對局' });
      assert.match(await review.innerText(), /BO3/);
      for (const [i, secondsValue] of seconds.entries())
        assert.match(await review.innerText(), new RegExp(`第 ${i + 1} 局：.*${secondsValue} 秒`));
      assert.match(
        await review.innerText(),
        new RegExp(`整場時間：${seconds.reduce((sum, n) => sum + n, 0)} 秒`),
      );
      if (seconds.length === 2) assert.match(await review.innerText(), /第三局未進行/);
      await snapshot(`settlement-${id}`);
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: '返回修改', exact: true })
        .click();
      assert.equal(await page.locator('header strong').first().innerText(), before);
      await active.getByRole('button', { name: '檢查結算', exact: true }).click();
      await confirm('結算並派彩');
      await balance(expected);
      assert.equal(
        await active.getByRole('button', { name: '填寫逐局賽果', exact: true }).count(),
        0,
      );
      if (id === 'm1-0') {
        await button('檢視模式').click();
        await button('我的注單').click();
        assert.equal(
          await page
            .locator('article > header > strong')
            .filter({ hasText: /^中獎$/ })
            .count(),
          7,
        );
        assert.equal(
          await page
            .locator('article > header > strong')
            .filter({ hasText: /^作廢退款$/ })
            .count(),
          2,
        );
        await snapshot('match-tickets-settled');
        await button('管理模式').click();
      }
      if (id === 'm1-0' || id === 'm2-0') {
        page = podiumPage;
        await button('我的注單').click();
        await balance(id === 'm1-0' ? '600' : '1360');
        assert.equal(
          await page
            .locator('article > header > strong')
            .filter({ hasText: /^待結算$/ })
            .count(),
          id === 'm1-0' ? 4 : 2,
        );
        if (id === 'm2-0')
          for (const place of ['季軍', '殿軍']) {
            const ticket = page
              .locator('article')
              .filter({ has: page.locator('ol > li').filter({ hasText: place }) });
            assert.match(await ticket.locator('header strong').innerText(), /待結算/);
          }
        await snapshot(`podium-after-${id}`);
        page = matchPage;
      }
    }
    page = podiumPage;
    await button('我的注單').click();
    await balance('2120');
    assert.equal(
      await page
        .locator('article > header > strong')
        .filter({ hasText: /^中獎$/ })
        .count(),
      4,
    );
    await snapshot('complete-tickets');
    await button('名次盤').click();
    for (const [place, player] of podium) {
      await market(place).getByText(`${player} · 中選`, { exact: true }).waitFor();
      assert.equal(
        await market(place).getByRole('button', { name: /選擇/ }).first().isDisabled(),
        true,
      );
    }
    await snapshot('all-four-places');
    await button('點數紀錄').click();
    await snapshot('final-ledger');
    await page.reload({ waitUntil: 'networkidle' });
    await balance('2120');
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
