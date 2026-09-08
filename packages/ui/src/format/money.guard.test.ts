// @vitest-environment node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// money.ts 是整個前端唯一被允許決定「金額怎麼變成字串」的地方。
// 只要有人在裡面用了浮點路徑,超過 2^53 的金額就會靜默失真 —— 不會丟錯,
// 只會少錢。這條測試把「不准用」變成 CI 擋得住的事,不靠 code review 記得。

const SOURCE = readFileSync(fileURLToPath(new URL('./money.ts', import.meta.url)), 'utf8');

const FORBIDDEN = [
  { pattern: /\bNumber\s*\(/, why: 'Number() 會把 > 2^53 的整數靜默截斷' },
  { pattern: /\bparseInt\s*\(/, why: 'parseInt 走的是 double' },
  { pattern: /\bparseFloat\s*\(/, why: 'parseFloat 走的是 double' },
  { pattern: /\.toFixed\s*\(/, why: 'toFixed 是 number 的方法' },
  { pattern: /\.toLocaleString\s*\(/, why: 'toLocaleString 會先轉 number' },
  {
    pattern: /Intl\.NumberFormat/,
    why: 'Intl.NumberFormat 對 bigint 的行為隨引擎變,而且會吃進 number',
  },
  { pattern: /\bMath\./, why: '金額不做浮點運算' },
];

describe('money.ts 的原始碼', () => {
  it.each(FORBIDDEN)('不出現 $pattern', ({ pattern, why }) => {
    const lines = SOURCE.split('\n').filter(
      (line) => !line.trimStart().startsWith('//') && pattern.test(line),
    );
    expect(lines, why).toEqual([]);
  });
});
