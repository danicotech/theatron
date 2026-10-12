// Isolated UI-created members and event. No fixtures are written into IndexedDB.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const output = 'docs/previews/participation-handoff-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of process.env.TEST_WIDTH
    ? [Number(process.env.TEST_WIDTH)]
    : [1440, 768, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    // Exercise the real link, but use the existing 2D fallback for this UI audit.
    // The software GPU cannot establish hardware 3D quality; event and match stay intact.
    await context.route('http://127.0.0.1:3000/?**', async (route) => {
      const url = new URL(route.request().url());
      if (route.request().isNavigationRequest() && url.searchParams.get('stage') === '3d') {
        url.searchParams.set('stage', '2d');
        url.searchParams.set('intro', '0');
        await route.fulfill({ status: 302, headers: { location: url.href } });
      } else await route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    async function snapshot(name) {
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((a) => a.effect?.getTiming().iterations !== Infinity)
            .map((a) => a.finished.catch(() => {})),
        ),
      );
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const data = await page.evaluate(async () => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        smallButtons: [...document.querySelectorAll('button')]
          .filter(
            (el) =>
              el.checkVisibility() &&
              !el.disabled &&
              !el.closest('nextjs-portal') &&
              !el.closest('[inert]'),
          )
          .map((el) => ({
            text: el.getAttribute('aria-label') || el.textContent.trim(),
            width: el.getBoundingClientRect().width,
            height: el.getBoundingClientRect().height,
          }))
          .filter((r) => r.width < 43.5 || r.height < 43.5),
        violations: (
          await window.axe.run(document.body, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
          })
        ).violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      }));
      await page.screenshot({
        path: `${output}/${width}-${name}.png`,
        fullPage: false,
        animations: 'disabled',
      });
      results.push({ width, name, ...data });
      console.log(JSON.stringify(results.at(-1)));
      assert.equal(data.overflow, false);
      assert.deepEqual(data.smallButtons, []);
      assert.deepEqual(data.violations, []);
    }
    const button = (name) => page.getByRole('button', { name, exact: true });
    await page.goto('http://127.0.0.1:3000/sportsbook?mode=manage', { waitUntil: 'networkidle' });
    await page.getByLabel('賽事名稱', { exact: true }).fill('交接驗收 · 同門試鋒');
    await button('建立活動').click();
    await page.getByRole('heading', { name: '活動與報名名單' }).waitFor();
    const eventId = new URL(page.url()).searchParams.get('event');
    assert.ok(eventId);
    await button('檢視模式').click();
    for (const [index, name] of ['霜月歸舟', '照夜行'].entries()) {
      await button('我的參賽').click();
      await page.getByLabel('我已了解賽制與讓武原則', { exact: true }).check();
      await button('登入／註冊後繼續').click();
      const auth = page.getByRole('dialog');
      await auth.getByRole('button', { name: '註冊', exact: true }).click();
      await auth.getByLabel('帳號', { exact: true }).fill(`handoff-${index}`);
      await auth.getByLabel('密碼', { exact: true }).fill('isolated-test-password');
      await auth.getByLabel('暱稱', { exact: true }).fill(`會員${index + 1}`);
      await auth.getByRole('button', { name: '註冊並領取 1,000 點', exact: true }).click();
      await auth.waitFor({ state: 'hidden' });
      await page.getByLabel('我已了解賽制與讓武原則', { exact: true }).check();
      await button('下一步').click();
      for (const [label, value] of [
        ['遊戲 ID', `PRIVATE-ID-${index}`],
        ['角色姓名', name],
        ['所在伺服器', '試玩服'],
        ['Discord 名稱', `PRIVATE-CONTACT-${index}`],
        ['對戰經驗', '偶爾切磋'],
        ['可參賽時段', '週六晚間'],
      ])
        await page.getByLabel(label, { exact: true }).fill(value);
      await button('下一步').click();
      for (const [label, value] of [
        ['流派', '劍'],
        ['武器', `${name}的長劍`],
        ['裝備', `${name}的輕甲`],
        ['武學與配裝說明', `${name}的試鋒配置`],
      ])
        await page.getByLabel(label, { exact: true }).fill(value);
      await button('下一步').click();
      await button('確認完成報名').click();
      await page.getByText('本機報名已完成', { exact: true }).waitFor();
      await snapshot(`receipt-${index}`);
      if (index === 0) await button('登出').click();
    }
    await button('管理模式').click();
    const publish = button('發布對局（2 人）');
    assert.equal(await publish.isDisabled(), true);
    await page.getByRole('combobox', { name: '報名狀態', exact: true }).selectOption('no');
    await button('儲存活動設定').click();
    await page.getByText(/報名已關閉 · 完成 2/).waitFor();
    await button('將 照夜行 籤位前移').click();
    await snapshot('closed-roster');
    await publish.click();
    let confirm = page.getByRole('alertdialog', { name: '確認發布對局' });
    assert.match(await confirm.innerText(), /照夜行、霜月歸舟/);
    await confirm.getByRole('button', { name: '返回修改', exact: true }).click();
    assert.equal(await page.getByLabel('活動名稱', { exact: true }).isEnabled(), true);
    await publish.click();
    confirm = page.getByRole('alertdialog', { name: '確認發布對局' });
    await snapshot('publish-confirm');
    await confirm.getByRole('button', { name: '發布對局', exact: true }).click();
    await page.getByText(/已發布對局 · 完成 2/).waitFor();
    assert.equal(await page.getByLabel('活動名稱', { exact: true }).isDisabled(), true);
    await snapshot('published');
    await button('檢視模式').click();
    await button('我的參賽').click();
    await button('查看我的對局 · 第 1 輪').click();
    await page.getByRole('heading', { name: '整場勝負', exact: true }).waitFor();
    assert.equal(
      await page.locator('main').evaluate((el) => el === document.activeElement),
      true,
      'receipt action must move keyboard focus to the match content',
    );
    await snapshot('my-match');
    await button('管理模式').click();
    await page.getByRole('link', { name: '查看完整賽程 ↗', exact: true }).click();
    await page.waitForFunction(
      () =>
        document.querySelector('#schedule[data-on]') &&
        document.querySelector('#bracket-host')?.textContent.includes('照夜行'),
    );
    assert.equal(new URL(page.url()).searchParams.get('sportsEvent'), eventId);
    const seat = page
      .locator('#bracket-host .tt-player')
      .filter({ hasText: '照夜行', visible: true })
      .first();
    await seat.click();
    await page.locator('#psheet:not([hidden])').waitFor();
    const detail = await page.locator('#dz-body').innerText();
    assert.match(detail, /照夜行的長劍/);
    assert.match(detail, /照夜行的輕甲/);
    assert.doesNotMatch(detail, /PRIVATE-/);
    await snapshot('public-character');
    await page.keyboard.press('Escape');
    const node = page.locator('#bracket-host .tt-node').filter({ visible: true }).first();
    const matchId = await node.getAttribute('data-match-id');
    await node.click();
    await page.waitForFunction(
      () => document.querySelector('#duel[data-on]') && !document.body.hasAttribute('data-cut'),
    );
    assert.equal(new URL(page.url()).searchParams.get('match'), matchId);
    assert.match(await page.locator('#duel').innerText(), /照夜行/);
    await snapshot('duel');
    await page.locator('[data-sports-center]').click();
    await page.getByRole('dialog', { name: '觀局雅集 · 本機試玩' }).waitFor();
    await page.waitForFunction(
      (id) => [...document.querySelectorAll('select')].some((el) => el.value === id),
      eventId,
    );
    assert.equal(
      await page.getByRole('combobox', { name: '試玩賽事', exact: true }).inputValue(),
      eventId,
    );
    const ownMarket = page
      .getByRole('heading', { name: '整場勝負', exact: true })
      .locator('..')
      .locator('..');
    await ownMarket
      .getByText('不能投注自己參與的場次。可切換其他場次觀局。', { exact: true })
      .waitFor();
    assert.equal(await ownMarket.getByRole('button', { name: /選擇/ }).first().isDisabled(), true);
    await snapshot('embedded-center');
    await page.getByRole('dialog').getByRole('button', { name: '關閉視窗', exact: true }).click();
    await page.locator('[data-return-bracket]').click();
    await page.waitForFunction(
      () => document.querySelector('#schedule[data-on]') && !document.body.hasAttribute('data-cut'),
    );
    assert.equal(new URL(page.url()).searchParams.get('sportsEvent'), eventId);
    await snapshot('schedule-return');
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
