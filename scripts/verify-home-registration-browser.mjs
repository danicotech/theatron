// Isolated UI-created members and event. No fixtures are written into IndexedDB.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const output = 'docs/previews/home-registration-browser';
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
        modalHeaderClear: (() => {
          const dialog = [...document.querySelectorAll('dialog[open]')].at(-1);
          if (!dialog) return true;
          const header = dialog.querySelector(':scope > header');
          const title = header.querySelector('h2').getBoundingClientRect();
          return header.contains(
            document.elementFromPoint(title.x + title.width / 2, title.y + title.height / 2),
          );
        })(),
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
      assert.equal(data.modalHeaderClear, true, 'dialog title must stay above scrolled content');
      assert.deepEqual(data.smallButtons, []);
      assert.deepEqual(data.violations, []);
    }
    await page.goto('http://127.0.0.1:3000/?stage=2d&intro=0#register', {
      waitUntil: 'networkidle',
    });
    const opener = page.locator('#register-cta');
    await page.waitForFunction(() =>
      document.querySelector('#register-cta')?.hasAttribute('data-registration-entry'),
    );
    assert.equal(await opener.getAttribute('aria-label'), '報名表');
    const fallback = new URL(await opener.getAttribute('href'), page.url()).href;
    assert.equal(new URL(fallback).searchParams.get('entry'), 'registration');
    await opener.click();
    const center = page.getByRole('region', { name: '報名書卷', exact: true });
    await center.getByRole('heading', { name: '赴約參賽', exact: true }).waitFor();
    await page.waitForFunction(() => new URL(location.href).searchParams.has('sportsEvent'));
    const eventId = new URL(page.url()).searchParams.get('sportsEvent');
    assert.ok(eventId);
    assert.equal(await center.getByRole('group', { name: '操作模式' }).count(), 0);
    assert.equal(await page.locator('dialog[open]').count(), 0);
    assert.equal(await center.locator('main').count(), 0);
    await snapshot('home-direct-registration');
    const loginButton = center.getByRole('button', { name: '登入／註冊後繼續', exact: true });
    await center.getByLabel('我已了解賽制與讓武原則', { exact: true }).check();
    await loginButton.click();
    const auth = page.getByRole('dialog', { name: '會員登入與註冊', exact: true });
    await auth.waitFor();
    await page.keyboard.press('Escape');
    await auth.waitFor({ state: 'hidden' });
    assert.equal(await center.isVisible(), true, 'Escape closes only the nested auth modal');
    assert.equal(await loginButton.evaluate((el) => el === document.activeElement), true);
    await loginButton.click();
    await auth.getByRole('button', { name: '註冊', exact: true }).click();
    await auth.getByLabel('帳號', { exact: true }).fill('embedded-flow');
    await auth.getByLabel('密碼', { exact: true }).fill('isolated-password');
    await auth.getByLabel('暱稱', { exact: true }).fill('月照長川');
    await snapshot('nested-auth');
    await auth.getByRole('button', { name: '註冊並領取 1,000 點', exact: true }).click();
    await auth.waitFor({ state: 'hidden' });
    await center.getByLabel('我已了解賽制與讓武原則', { exact: true }).check();
    await center.getByRole('button', { name: '下一步', exact: true }).click();
    await center.getByRole('button', { name: '下一步', exact: true }).click();
    assert.equal(
      await center
        .getByLabel('遊戲 ID', { exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await snapshot('embedded-field-error');
    for (const [label, value] of [
      ['遊戲 ID', 'LOCAL-EMBED-01'],
      ['角色姓名', '月照長川'],
      ['所在伺服器', '本機服'],
      ['Discord 名稱', 'local-moon'],
      ['對戰經驗', '每週切磋'],
      ['可參賽時段', '週末晚間'],
    ]) {
      await center.getByLabel(label, { exact: true }).fill(value);
    }
    await center.getByRole('button', { name: '儲存草稿', exact: true }).click();
    await center.getByText('草稿已儲存，尚未完成報名。', { exact: true }).waitFor();
    await snapshot('embedded-saved-draft');
    await center.getByLabel('所在伺服器', { exact: true }).fill('未儲存也保留');
    await center.getByRole('button', { name: '收卷', exact: false }).click();
    assert.equal(await opener.evaluate((el) => el === document.activeElement), true);
    assert.equal(new URL(page.url()).hash, '#register');
    await opener.click();
    assert.equal(
      await center.getByLabel('所在伺服器', { exact: true }).inputValue(),
      '未儲存也保留',
    );
    assert.equal(
      await center.getByLabel('遊戲 ID', { exact: true }).inputValue(),
      'LOCAL-EMBED-01',
    );
    await center.getByRole('button', { name: '下一步', exact: true }).click();
    for (const [label, value] of [
      ['流派', '劍'],
      ['武器', '長劍'],
      ['裝備', '輕甲'],
      ['武學與配裝說明', '嵌入表單的角色方案'],
    ]) {
      await center.getByLabel(label, { exact: true }).fill(value);
    }
    await page.keyboard.press('ArrowRight');
    assert.equal(
      new URL(page.url()).hash,
      '#register',
      'typing inside a dialog must not navigate chapters',
    );
    await center.getByRole('button', { name: '下一步', exact: true }).click();
    await snapshot('embedded-review');
    await center.getByRole('button', { name: '確認完成報名', exact: true }).click();
    await center.getByText('本機報名已完成', { exact: true }).waitFor();
    await snapshot('embedded-receipt');
    await center.getByRole('button', { name: '收卷', exact: false }).click();
    assert.equal(await opener.evaluate((el) => el === document.activeElement), true);
    await page.reload({ waitUntil: 'networkidle' });
    await opener.click();
    await center.getByText('本機報名已完成', { exact: true }).waitFor();
    await snapshot('embedded-reloaded');
    await center.getByRole('button', { name: '登出', exact: true }).click();
    assert.equal(await center.getByText('LOCAL-EMBED-01', { exact: false }).count(), 0);
    await snapshot('embedded-logged-out');
    await center.getByRole('button', { name: '收卷', exact: false }).click();
    assert.equal(await opener.evaluate((el) => el === document.activeElement), true);
    await page.goto(fallback, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: '赴約參賽', exact: true }).waitFor();
    await snapshot('direct-link-fallback');
    assert.equal(new URL(page.url()).searchParams.get('event'), eventId);
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
