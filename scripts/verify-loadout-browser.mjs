// Standalone UI verification; never attaches to a user's existing browser.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
    : 'playwright-core'
);
const output = 'docs/previews/loadout-browser';
await mkdir(output, { recursive: true });
const results = [];
const browser = await chromium.launch();
try {
  for (const width of [1440, 768, 375]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      hasTouch: width < 1024,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    async function checkModalFocus(id) {
      await page.waitForFunction(
        (id) => document.querySelector(id).contains(document.activeElement),
        id,
      );
      const dialog = page.locator(id);
      const buttons = dialog.locator(
        'button:visible:not([disabled]),input:visible:not([disabled]),textarea:visible',
      );
      await buttons.last().focus();
      for (const key of ['Tab', 'Tab', 'Shift+Tab', 'Shift+Tab']) {
        await page.keyboard.press(key);
        assert.equal(
          await page.evaluate(
            (id) =>
              document.activeElement === document.body ||
              document.querySelector(id).contains(document.activeElement),
            id,
          ),
          true,
          `${id}: focus entered page background`,
        );
      }
      // Programmatic background focus must also be rejected by the native modal.
      await page.locator('#bhead').evaluate((e) => e.focus());
      assert.equal(
        await page.locator('#bhead').evaluate((e) => e === document.activeElement),
        false,
      );
    }
    async function snapshot(name) {
      await page.screenshot({
        path: `${output}/${width}-${name}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      if (name === 'equipment-editor')
        await page.screenshot({
          path: `${output}/${width}-${name}-viewport.png`,
          animations: 'disabled',
        });
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const result = await page.evaluate(async () => ({
        documentWidth: document.documentElement.scrollWidth,
        small: [
          ...document.querySelectorAll(
            'button,input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]),select,textarea',
          ),
        ]
          .filter((e) => e.checkVisibility() && !e.disabled && !e.closest('nextjs-portal'))
          .map((e) => ({
            text: e.getAttribute('aria-label') || e.innerText,
            width: e.getBoundingClientRect().width,
            height: e.getBoundingClientRect().height,
          }))
          .filter((e) => e.width < 43.5 || e.height < 43.5),
        violations: (
          await window.axe.run(document.body, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
          })
        ).violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      }));
      results.push({ width, name, ...result });
      assert.ok(result.documentWidth <= width + 1, `${name} horizontal overflow`);
      assert.deepEqual(result.small, [], `${width}/${name}: controls below 44px`);
      assert.deepEqual(result.violations, [], `${width}/${name}: accessibility violations`);
    }
    await page.goto('http://127.0.0.1:3000/loadout', { waitUntil: 'networkidle' });
    await snapshot('empty');
    await page.getByRole('button', { name: '選擇流派', exact: true }).click();
    await snapshot('build-picker');
    await checkModalFocus('#pick');
    await page.getByRole('dialog', { name: '選擇流派' }).getByRole('searchbox').fill('鳴金虹');
    await page
      .getByRole('dialog', { name: '選擇流派' })
      .getByRole('button', { name: /^鳴金虹/ })
      .click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.waitForFunction(
      () => document.querySelector('#storage-status')?.dataset.state === 'saved',
    );
    await snapshot('selected-build');
    await page.getByRole('button', { name: '無名劍法 等級，目前 未填', exact: true }).click();
    await snapshot('level-picker');
    await checkModalFocus('#pop');
    await page.locator('#pop-box').getByRole('button', { name: '20', exact: true }).click();
    await page.waitForFunction(
      () => document.activeElement?.getAttribute('aria-label') === '無名劍法 等級，目前 20',
    );
    await page.waitForFunction(
      () => document.querySelector('#storage-status')?.dataset.state === 'saved',
    );
    await page.reload({ waitUntil: 'networkidle' });
    assert.match(await page.locator('#bhead').innerText(), /鳴金虹/);
    assert.equal(
      await page.getByRole('button', { name: '無名劍法 等級，目前 20', exact: true }).count(),
      1,
    );
    await page.getByRole('button', { name: '無名心法，點一下選擇', exact: true }).click();
    await snapshot('mind-picker');
    await page.keyboard.press('Escape');
    assert.equal(
      await page
        .getByRole('button', { name: '無名心法，點一下選擇', exact: true })
        .evaluate((e) => document.activeElement === e),
      true,
    );
    await page.getByRole('button', { name: '匯出 JSON 備份', exact: true }).click();
    await snapshot('export');
    await checkModalFocus('#io-modal');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '下載檔案', exact: true }).click();
    const download = await downloadPromise;
    await download.saveAs(`${output}/${width}-export.json`);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '角色管理', exact: true }).click();
    await checkModalFocus('#roles-modal');
    await page.locator('#rm-name').fill('');
    await page.locator('#rm-save').click();
    assert.equal(await page.locator('#rm-error').innerText(), '請填寫角色名稱。');
    await snapshot('role-error');
    await page.getByRole('button', { name: '新增角色', exact: true }).click();
    await page.locator('#rm-name').fill('驗收新角色');
    await page.locator('#rm-save').click();
    await page.waitForFunction(
      () => document.activeElement?.getAttribute('aria-label') === '角色管理',
    );
    await page.getByRole('button', { name: '角色管理', exact: true }).click();
    await page.locator('#rm-delete').click();
    await checkModalFocus('#ask');
    await snapshot('delete-confirm');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#roles-modal').evaluate((e) => e.open), true);
    assert.equal(
      await page.locator('#rm-delete').evaluate((e) => e === document.activeElement),
      true,
    );
    await page.locator('#rm-delete').click();
    await page.locator('#ask-yes').click();
    await page.locator('#roles-modal').waitFor({ state: 'hidden' });
    if (!(await page.locator('#btn-import').isVisible())) await page.locator('#btn-more').click();
    await page.locator('#btn-import').click();
    await checkModalFocus('#io-modal');
    const paste = page.getByRole('textbox', { name: '貼上配置文字或 JSON' });
    await paste.pressSequentially('{bad');
    assert.equal(await paste.inputValue(), '{bad');
    assert.equal(await paste.evaluate((e) => e === document.activeElement), true);
    await snapshot('import-error');
    await paste.fill(await readFile(`${output}/${width}-export.json`, 'utf8'));
    await snapshot('import-preview');
    await page.locator('#io-foot').getByRole('button', { name: '套用', exact: true }).click();
    await page.getByRole('alertdialog', { name: '套用匯入配置' }).waitFor();
    await page.locator('#ask-yes').click();
    await page.locator('#io-modal').waitFor({ state: 'hidden' });
    await page.waitForFunction(() =>
      ['btn-import', 'btn-more'].includes(document.activeElement?.id),
    );
    assert.match(await page.locator('#bhead').innerText(), /鳴金虹/);
    if (width <= 900) await page.locator('#secbar button[data-k="vault"]').click();
    await page.getByRole('button', { name: '倉庫工具 ⌄', exact: true }).click();
    await page
      .locator('#pop-box')
      .getByRole('button', { name: /^快速添加/ })
      .click();
    const quick = page.getByRole('dialog', { name: '快速添加', exact: true });
    await quick.waitFor();
    await checkModalFocus('#qadd');
    await snapshot('quick-add');
    const firstEquipment = quick.locator('.qcard').first();
    await firstEquipment.click();
    assert.equal(await quick.locator('.qcard').first().getAttribute('aria-pressed'), 'false');
    await quick.locator('.qcard').first().click();
    assert.equal(await quick.locator('.qcard').first().getAttribute('aria-pressed'), 'true');
    await quick.getByRole('button', { name: '加入倉庫', exact: true }).click();
    await quick.waitFor({ state: 'hidden' });
    assert.equal((await page.locator('#vault .ecard').count()) > 0, true);
    const firstCard = page.locator('#vault .ecard').first();
    await firstCard.getByRole('button', { name: '編輯', exact: true }).click();
    await checkModalFocus('#edit');
    await snapshot('equipment-editor');
    const tier = page.locator('#edit-body input.snum').first();
    const initialTier = Number(await tier.inputValue());
    await page.getByRole('button', { name: '增加5 級', exact: true }).focus();
    await page.keyboard.press('Enter');
    assert.equal(Number(await tier.inputValue()), initialTier + 5);
    await page.locator('#edit-save').click();
    await page.waitForFunction(() =>
      document.activeElement?.dataset.focusKey?.startsWith('edit-item-'),
    );
    await page.waitForFunction(
      () => document.querySelector('#storage-status')?.dataset.state === 'saved',
    );
    const savedEquipment = await page.evaluate(() => localStorage.getItem('lunjian.loadout.v3'));
    const savedCard = await firstCard.innerText();
    await firstCard.getByRole('button', { name: '編輯', exact: true }).click();
    await page.getByLabel('掛在哪一格', { exact: true }).selectOption('w_main');
    await page.getByLabel('武器名稱', { exact: true }).fill('取消不應保存');
    await page.getByRole('button', { name: /^裝備類別，目前/ }).click();
    await page.locator('#pop-box button').last().click();
    await page.locator('#edit-clear').click();
    await snapshot('equipment-draft');
    await page.locator('#edit-cancel').click();
    // Let any accidental debounced write finish; canceled edits must be absent.
    await page.waitForTimeout(500);
    assert.equal(
      await page.evaluate(() => localStorage.getItem('lunjian.loadout.v3')),
      savedEquipment,
    );
    assert.equal(await firstCard.innerText(), savedCard);
    await firstCard.getByRole('button', { name: '編輯', exact: true }).click();
    await page.getByLabel('掛在哪一格', { exact: true }).selectOption('w_main');
    await page.getByLabel('武器名稱', { exact: true }).fill('驗收保存武器');
    await page.locator('#edit-save').click();
    await page.waitForFunction(
      () => document.querySelector('#storage-status')?.dataset.state === 'saved',
    );
    await page.reload({ waitUntil: 'networkidle' });
    const editedCard = page.locator('#vault .ecard').filter({ hasText: '驗收保存武器' });
    await editedCard.getByRole('button', { name: '編輯', exact: true }).click();
    assert.equal(await page.getByLabel('掛在哪一格', { exact: true }).inputValue(), 'w_main');
    assert.equal(await page.getByLabel('武器名稱', { exact: true }).inputValue(), '驗收保存武器');
    await page.locator('#edit-cancel').click();
    if (width <= 900) await page.locator('#secbar button[data-k="vault"]').click();
    const wornButton = editedCard.getByRole('button', { name: '卸下 主', exact: true });
    await wornButton.focus();
    await page.keyboard.press('Enter');
    const wearButton = editedCard.getByRole('button', { name: '裝上 主', exact: true });
    await wearButton.waitFor();
    assert.equal(
      await wearButton.evaluate((el) => el === document.activeElement),
      true,
      'unequip retains keyboard focus on the same item action',
    );
    await snapshot('direct-unequip');
    await page.keyboard.press('Enter');
    await editedCard.getByRole('button', { name: '卸下 主', exact: true }).waitFor();
    await snapshot('direct-equip');
    if (width <= 900) await page.locator('#secbar button[data-k="gear"]').click();
    await page.locator('.pickcell').first().click();
    await checkModalFocus('#eqsel');
    await snapshot('equipment-set');
    await page.keyboard.press('Escape');
    await page.locator('#attr-src').click();
    await checkModalFocus('#src');
    await snapshot('attribute-source');
    await page.keyboard.press('Escape');
    if (!(await page.locator('#btn-guide').isVisible())) await page.locator('#btn-more').click();
    await page.locator('#btn-guide').click();
    await checkModalFocus('#modal');
    await snapshot('guide');
    await page.keyboard.press('Escape');
    if (!(await page.locator('#btn-export').isVisible())) await page.locator('#btn-more').click();
    await page.locator('#btn-export').click();
    await page.evaluate(() => {
      const original = navigator.clipboard.writeText.bind(navigator.clipboard);
      window.restoreClipboard = () => {
        navigator.clipboard.writeText = original;
      };
      navigator.clipboard.writeText = async () => {
        throw new DOMException('Isolated test denial', 'NotAllowedError');
      };
    });
    await page.getByRole('button', { name: '複製到剪貼簿', exact: true }).click();
    await page.locator('#io-modal [role="alert"]').waitFor();
    assert.equal(
      await page
        .locator('#io-modal [role="alert"]')
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await snapshot('clipboard-denied');
    await page.getByRole('button', { name: '複製報名連結', exact: true }).click();
    assert.match(await page.locator('#io-modal [role="alert"]').innerText(), /賽事代號/);
    await snapshot('missing-signup-code');
    await page.evaluate(() => window.restoreClipboard());
    await page.keyboard.press('Escape');
    if (!(await page.locator('#btn-import').isVisible())) await page.locator('#btn-more').click();
    await page.locator('#btn-import').click();
    await page.evaluate(() => {
      const original = File.prototype.text;
      window.restoreFileText = () => {
        File.prototype.text = original;
      };
      File.prototype.text = () => Promise.reject(new Error('Isolated read failure'));
    });
    const file = {
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(await readFile(`${output}/${width}-export.json`, 'utf8')),
    };
    await page.locator('#io-modal input[type=file]').setInputFiles(file);
    await page.locator('#io-import-error').waitFor();
    assert.equal(
      await page.locator('#io-import-error').evaluate((el) => el === document.activeElement),
      true,
    );
    await snapshot('file-read-error');
    await page.evaluate(() => window.restoreFileText());
    await page.locator('#io-modal input[type=file]').setInputFiles(file);
    await page.getByRole('button', { name: '套用', exact: true }).waitFor();
    await snapshot('file-read-retry');
    // A late file response must not reopen or replace a different dialog.
    await page.evaluate(() => {
      File.prototype.text = () =>
        new Promise((resolve) => {
          window.finishOldFile = resolve;
        });
    });
    await page.locator('#io-modal input[type=file]').setInputFiles({ ...file, name: 'slow.json' });
    await page.keyboard.press('Escape');
    if (!(await page.locator('#btn-export').isVisible())) await page.locator('#btn-more').click();
    await page.locator('#btn-export').click();
    await page.evaluate(() => window.finishOldFile('{"build":"stale-file"}'));
    await page.evaluate(() => window.restoreFileText());
    assert.equal(await page.locator('#io-title').innerText(), '匯出配置');
    await snapshot('late-file-ignored');
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      navigator.clipboard.writeText = async () => {
        throw new Error('Isolated copy failure');
      };
    });
    if (!(await page.locator('#btn-copy').isVisible())) await page.locator('#btn-more').click();
    await page.locator('#btn-copy').click();
    const manualCopy = page.getByRole('textbox', { name: '手動複製配置文字', exact: true });
    await manualCopy.waitFor();
    assert.equal(await manualCopy.inputValue(), await page.locator('#sheet').textContent());
    assert.equal(
      await manualCopy.evaluate(
        (el) =>
          el === document.activeElement &&
          el.readOnly &&
          el.selectionStart === 0 &&
          el.selectionEnd === el.value.length,
      ),
      true,
    );
    await snapshot('manual-copy-fallback');
    await page.getByRole('button', { name: '完成', exact: true }).click();
    await page.evaluate(() => window.restoreClipboard());
    assert.deepEqual(errors, [], `page errors at ${width}`);
    await context.close();
  }
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(
  JSON.stringify(
    results.map(({ width, name, small, violations }) => ({ width, name, small, violations })),
    null,
    2,
  ),
);
