import axe from 'axe-core';
import { expect } from 'vitest';

/**
 * 無障礙基本檢查。
 *
 * color-contrast 在 jsdom 下沒有版面可以量,axe 只會回 incomplete,所以關掉 ——
 * 對比度靠 /kitchen-sink 的主題驗收清單把關(theming.md),不假裝在單元測試裡驗過了。
 */
export async function expectNoAxeViolations(container: HTMLElement): Promise<void> {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  const summary = results.violations.map((v) => `${v.id}: ${v.help}`);
  expect(summary).toEqual([]);
}
