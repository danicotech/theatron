// Run with PLAYWRIGHT_MODULE pointing to an installed playwright-core index.mjs.
// Uses a fresh non-persistent context: existing local members and events are untouched.
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
const output = 'docs/previews/registration-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 768, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    async function snapshot(name) {
      const geometry = await page.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
        focusedHeadingTop: document.activeElement?.matches('h2,h3')
          ? document.activeElement.getBoundingClientRect().top
          : null,
        undersized: [
          ...document.querySelectorAll('button, input:not([type=checkbox]), select, textarea'),
        ]
          .filter((el) => el.checkVisibility() && !el.disabled && !el.closest('nextjs-portal'))
          .map((el) => ({
            text: el.textContent?.trim().slice(0, 50) || el.getAttribute('aria-label') || el.name,
            height: el.getBoundingClientRect().height,
          }))
          .filter((el) => el.height < 43.5),
      }));
      if (name === 'review' || name === 'receipt') {
        assert.ok(
          geometry.focusedHeadingTop >= 0 && geometry.focusedHeadingTop < 900,
          `${width}/${name}: the new step heading must be in view`,
        );
      }
      await page.screenshot({
        path: `${output}/${width}-${name}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      assert.ok(geometry.document <= width + 1, `${width}/${name}: horizontal overflow`);
      assert.deepEqual(geometry.undersized, [], `${width}/${name}: control target under 44px`);
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const violations = await page.evaluate(async () =>
        (
          await window.axe.run(
            document.querySelector('body > div[class*="Sportsbook"]') || document.body,
            { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } },
          )
        ).violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      );
      results.push({ width, name, geometry, violations });
      assert.deepEqual(violations, [], `${width}/${name}: accessibility violations`);
    }
    await page.goto('http://127.0.0.1:3000/sportsbook?mode=manage', { waitUntil: 'networkidle' });
    await page.getByLabel('賽事名稱', { exact: true }).fill('驗收 · 百業試鋒');
    await page.getByRole('button', { name: '建立活動', exact: true }).click();
    await page.getByText('活動與報名名單', { exact: true }).waitFor();
    await page.getByRole('button', { name: '檢視模式', exact: true }).click();
    await page.getByRole('button', { name: '我的參賽', exact: true }).click();
    await page.getByRole('button', { name: '登入／註冊後繼續', exact: true }).click();
    assert.equal(
      await page
        .locator('[data-field="rulesAccepted"]')
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.getByLabel('我已了解賽制與讓武原則', { exact: true }).check();
    await page.getByRole('button', { name: '登入／註冊後繼續', exact: true }).click();
    const auth = page.getByRole('dialog');
    await auth.getByRole('button', { name: '註冊', exact: true }).click();
    await auth.getByLabel('帳號', { exact: true }).fill('ui-check');
    await auth.getByLabel('密碼', { exact: true }).fill('isolated-test-only');
    await auth.getByLabel('暱稱', { exact: true }).fill('驗收俠客');
    await snapshot('auth');
    await auth.getByRole('button', { name: '註冊並領取 1,000 點', exact: true }).click();
    await auth.waitFor({ state: 'hidden' });
    // Login changes member identity and remounts the enrollment form.
    await page.getByLabel('我已了解賽制與讓武原則', { exact: true }).check();
    await snapshot('rules');
    await page.getByRole('button', { name: '下一步', exact: true }).click();
    await page.getByRole('button', { name: '下一步', exact: true }).click();
    assert.equal(
      await page
        .getByLabel('遊戲 ID', { exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await snapshot('identity-errors');
    await page.getByLabel('遊戲 ID', { exact: true }).fill('UI-0001');
    await page.getByLabel('角色姓名', { exact: true }).fill('霜月歸舟');
    await page.getByLabel('所在伺服器', { exact: true }).fill('試玩服');
    await page.getByLabel('Discord 名稱', { exact: true }).fill('test-only');
    await page.getByLabel('對戰經驗', { exact: true }).fill('初入江湖，偶爾與同門切磋。');
    await page.getByLabel('可參賽時段', { exact: true }).fill('週六晚間 20:00–22:00');
    await page.getByRole('button', { name: '儲存草稿', exact: true }).click();
    await page.getByText('草稿已儲存，尚未完成報名。', { exact: true }).waitFor();
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '我的參賽', exact: true }).click();
    await page.getByRole('button', { name: '下一步', exact: true }).click();
    assert.equal(await page.getByLabel('遊戲 ID', { exact: true }).inputValue(), 'UI-0001');
    await snapshot('identity');
    await page.getByRole('button', { name: '下一步', exact: true }).click();
    for (const [label, value] of [
      ['流派', '劍'],
      ['武器', '長劍、扇'],
      ['裝備', '武庫裝備'],
      ['武學與配裝說明', '試玩配置，無奇術'],
    ]) {
      await page.getByLabel(label, { exact: true }).fill(value);
    }
    await snapshot('character');
    await page.getByRole('link', { name: '儲存並開啟完整備戰方案 ↗', exact: true }).click();
    await page.waitForURL('**/loadout?sportsEvent=*');
    await page.waitForFunction(() => document.querySelector('#storage-status')?.dataset.state === 'saved');
    const localEventId = new URL(page.url()).searchParams.get('sportsEvent');
    await page.getByRole('button', { name: '選擇流派', exact: true }).click();
    await page.getByRole('dialog', { name: '選擇流派' }).getByRole('searchbox').fill('鳴金虹');
    await page.getByRole('dialog', { name: '選擇流派' }).getByRole('button', { name: /^鳴金虹/ }).click();
    await page.locator('#step-check').click();
    const returnedArts = await page.locator('#sheet').textContent();
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      window.restoreLoadoutStorage = () => { Storage.prototype.setItem = original; };
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith('lunjian.loadout.v3')) throw new DOMException('Test quota failure', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    await page.getByRole('button', { name: '帶回角色設定', exact: true }).click();
    await page.locator('#storage-status[data-state="error"]').waitFor();
    assert.equal(new URL(page.url()).pathname, '/loadout');
    assert.equal(await page.locator('#storage-retry').evaluate(el => el === document.activeElement), true);
    await snapshot('loadout-storage-error');
    await page.evaluate(() => { window.restoreLoadoutStorage(); delete window.restoreLoadoutStorage; });
    await page.locator('#storage-retry').click();
    await page.waitForFunction(() => document.querySelector('#storage-status')?.dataset.state === 'saved');
    await page.getByRole('button', { name: '帶回角色設定', exact: true }).click();
    await page.waitForURL('**/sportsbook?event=*');
    assert.equal(new URL(page.url()).searchParams.get('event'), localEventId);
    assert.equal(await page.getByLabel('武學與配裝說明', { exact: true }).inputValue(), returnedArts);
    assert.equal(await page.getByLabel('流派', { exact: true }).inputValue(), '劍');
    await snapshot('loadout-return');
    await page.getByRole('button', { name: '下一步', exact: true }).click();
    await snapshot('review');
    await page.getByRole('button', { name: '確認完成報名', exact: true }).click();
    await page.getByText('本機報名已完成', { exact: true }).waitFor();
    await snapshot('receipt');
    const secondPage = await context.newPage();
    await secondPage.goto(page.url(), { waitUntil: 'networkidle' });
    // Member sessions intentionally belong to a tab; sign in independently.
    await secondPage.getByRole('button', { name: '登入／註冊領 1,000 點', exact: true }).click();
    const secondAuth = secondPage.getByRole('dialog');
    await secondAuth.getByLabel('帳號', { exact: true }).fill('ui-check');
    await secondAuth.getByLabel('密碼', { exact: true }).fill('isolated-test-only');
    await secondAuth.locator('form').getByRole('button', { name: '登入', exact: true }).click();
    await secondAuth.waitFor({ state: 'hidden' });
    await secondPage.getByRole('button', { name: '我的參賽', exact: true }).click();
    await secondPage.getByText('本機報名已完成', { exact: true }).waitFor();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: '修改報名資料與角色', exact: true }).click();
    const fields = page
      .locator('fieldset')
      .filter({ has: page.getByLabel('遊戲 ID', { exact: true }) });
    assert.equal(await fields.evaluate((el) => getComputedStyle(el).animationName), 'none');
    const newName = '霜月歸舟' + '長名驗收'.repeat(8);
    const nameInput = page.getByLabel('角色姓名', { exact: true });
    // Reach the name field and save action with Tab, then activate with Enter.
    async function tabTo(target) {
      for (let i = 0; i < 45; i++) {
        if (await target.evaluate((el) => document.activeElement === el)) return;
        await page.keyboard.press('Tab');
      }
      throw new Error('Keyboard target was unreachable');
    }
    await tabTo(nameInput);
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText(newName);
    await tabTo(page.getByRole('button', { name: '儲存修改', exact: true }));
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: newName, exact: true }).waitFor();
    await secondPage.getByRole('heading', { name: newName, exact: true }).waitFor();
    await snapshot('updated-long-name');
    assert.match(await page.locator('header').first().innerText(), /1,000/);
    await secondPage.close();
    // A second entrant completes the entire form using only Tab, typing and Enter/Space.
    // Setup uses the real management UI; no direct IndexedDB fixture writes.
    await page.getByRole('button', { name: '管理模式', exact: true }).click();
    await page.getByLabel('報名人數上限', { exact: true }).fill('2');
    await page.getByRole('button', { name: '儲存活動設定', exact: true }).click();
    await page.getByText('開放報名 · 完成 1 / 2 人 · 草稿 0 人', { exact: true }).waitFor();
    await page.getByRole('button', { name: '檢視模式', exact: true }).click();
    await page.getByRole('button', { name: '我的參賽', exact: true }).click();
    async function keyActivate(target, key = 'Enter') {
      await tabTo(target);
      await page.keyboard.press(key);
    }
    async function keyFill(label, value, scope = page) {
      await tabTo(scope.getByLabel(label, { exact: true }));
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.insertText(value);
    }
    await keyActivate(page.getByRole('button', { name: '登出', exact: true }));
    await keyActivate(page.getByLabel('我已了解賽制與讓武原則', { exact: true }), 'Space');
    await keyActivate(page.getByRole('button', { name: '登入／註冊後繼續', exact: true }));
    await keyActivate(auth.getByRole('button', { name: '註冊', exact: true }));
    await keyFill('帳號', 'keyboard-check', auth);
    await keyFill('密碼', 'isolated-test-only', auth);
    await keyFill('暱稱', '鍵盤俠客', auth);
    await keyActivate(auth.getByRole('button', { name: '註冊並領取 1,000 點', exact: true }));
    await auth.waitFor({ state: 'hidden' });
    await keyActivate(page.getByLabel('我已了解賽制與讓武原則', { exact: true }), 'Space');
    await keyActivate(page.getByRole('button', { name: '下一步', exact: true }));
    for (const [label, value] of [
      ['遊戲 ID', 'KEY-0002'], ['角色姓名', '逐風客'], ['所在伺服器', '試玩服'],
      ['Discord 名稱', 'keyboard-only'], ['對戰經驗', '第一次參賽'],
      ['可參賽時段', '週末晚間'],
    ]) await keyFill(label, value);
    await keyActivate(page.getByRole('button', { name: '下一步', exact: true }));
    for (const [label, value] of [
      ['流派', '鳴金虹'], ['武器', '劍'], ['裝備', '武庫裝備'], ['武學與配裝說明', '新人配置'],
    ]) await keyFill(label, value);
    await keyActivate(page.getByRole('button', { name: '下一步', exact: true }));
    await snapshot('keyboard-review');
    await keyActivate(page.getByRole('button', { name: '確認完成報名', exact: true }));
    await page.getByText('本機報名已完成', { exact: true }).waitFor();
    await snapshot('keyboard-receipt');
    await keyActivate(page.getByRole('button', { name: '登出', exact: true }));
    await page.getByRole('heading', { name: '報名名額已滿', exact: true }).waitFor();
    await snapshot('capacity-full');
    await page.getByRole('button', { name: '管理模式', exact: true }).click();
    await page.getByRole('heading', { name: '雅集事務', exact: true }).waitFor();
    await page.getByRole('combobox', { name: '報名狀態', exact: true }).selectOption('no');
    await page.getByRole('button', { name: '儲存活動設定', exact: true }).click();
    await page.getByText('報名已關閉 · 完成 2 / 2 人 · 草稿 0 人', { exact: true }).waitFor();
    await page.getByRole('button', { name: '檢視模式', exact: true }).click();
    await page.getByRole('button', { name: '我的參賽', exact: true }).click();
    await page.getByRole('heading', { name: '報名已截止', exact: true }).waitFor();
    await snapshot('registration-closed');
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '我的參賽', exact: true }).click();
    await page.getByRole('heading', { name: '報名已截止', exact: true }).waitFor();
    await page.getByRole('button', { name: '登入／註冊領 1,000 點', exact: true }).click();
    await auth.getByLabel('帳號', { exact: true }).fill('keyboard-check');
    await auth.getByLabel('密碼', { exact: true }).fill('isolated-test-only');
    await auth.locator('form').getByRole('button', { name: '登入', exact: true }).click();
    await auth.waitFor({ state: 'hidden' });
    await page.getByText('本機報名已完成', { exact: true }).waitFor();
    await page.getByRole('heading', { name: '逐風客', exact: true }).waitFor();
    await snapshot('closed-member-receipt');
    assert.match(await page.locator('header').first().innerText(), /1,000/);
    assert.deepEqual(errors, [], `page errors at ${width}`);
    await context.close();
  }
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(
  JSON.stringify(
    results.map(({ width, name, violations }) => ({ width, name, violations })),
    null,
    2,
  ),
);
