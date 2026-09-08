import { describe, expect, it } from 'vitest';

import { formatAmount, sumAmounts, toAmount, toMachineAmount } from './money';

// 這一組是這個 repo 的存在理由之一:後端金額是 int64,
// 一旦有人在中途用 number 接手就會靜默少錢,而且事後查不出來。

describe('toAmount', () => {
  it('接受 protobuf JSON 編出來的整數字串', () => {
    expect(toAmount('1234')).toBe(1234n);
    expect(toAmount('-1234')).toBe(-1234n);
    expect(toAmount('+7')).toBe(7n);
    expect(toAmount('0')).toBe(0n);
  });

  it('接受 bigint', () => {
    expect(toAmount(9_007_199_254_740_993n)).toBe(9_007_199_254_740_993n);
  });

  it('保住 int64 上下限,一個 bit 都不掉', () => {
    expect(toAmount('9223372036854775807')).toBe(9223372036854775807n);
    expect(toAmount('-9223372036854775808')).toBe(-9223372036854775808n);
  });

  it('拒絕 number —— 收到 number 代表上游已經失真過了', () => {
    // @ts-expect-error 型別本來就擋掉 number,這裡驗執行期也擋
    expect(() => toAmount(1234)).toThrow(TypeError);
  });

  it('拒絕小數與垃圾字串', () => {
    expect(() => toAmount('1.5')).toThrow(TypeError);
    expect(() => toAmount('1e3')).toThrow(TypeError);
    expect(() => toAmount('')).toThrow(TypeError);
    expect(() => toAmount('abc')).toThrow(TypeError);
    expect(() => toAmount('12,345')).toThrow(TypeError);
  });
});

describe('formatAmount 的精度', () => {
  it('超過 2^53 不失真(Number 會)', () => {
    const raw = '9007199254740993'; // 2^53 + 1
    expect(formatAmount(raw)).toBe('9,007,199,254,740,993');

    // 對照組:證明「用 Number 就會錯」不是假想敵。
    expect(String(globalThis.Number(raw))).toBe('9007199254740992');
  });

  it('int64 最大值完整顯示', () => {
    expect(formatAmount('9223372036854775807')).toBe('9,223,372,036,854,775,807');
  });

  it('int64 最小值完整顯示', () => {
    expect(formatAmount('-9223372036854775808')).toBe('-9,223,372,036,854,775,808');
  });
});

describe('formatAmount 的千分位', () => {
  it.each([
    ['0', '0'],
    ['7', '7'],
    ['999', '999'],
    ['1000', '1,000'],
    ['12345', '12,345'],
    ['1234567', '1,234,567'],
    ['-1234567', '-1,234,567'],
  ])('%s → %s', (input, expected) => {
    expect(formatAmount(input)).toBe(expected);
  });

  it('grouping 關掉就是純數字(賠率欄位有時候不要)', () => {
    expect(formatAmount('1234567', { grouping: false })).toBe('1234567');
  });
});

describe('formatAmount 的符號', () => {
  it('預設只有負數帶符號', () => {
    expect(formatAmount('120')).toBe('120');
    expect(formatAmount('-120')).toBe('-120');
  });

  it('always 讓帳本的入帳看得出是加的', () => {
    expect(formatAmount('120', { signDisplay: 'always' })).toBe('+120');
    expect(formatAmount('-120', { signDisplay: 'always' })).toBe('-120');
    expect(formatAmount('0', { signDisplay: 'always' })).toBe('+0');
  });

  it('never 用在已經有其他欄位表達方向的地方', () => {
    expect(formatAmount('-120', { signDisplay: 'never' })).toBe('120');
  });
});

describe('formatAmount 的 scale', () => {
  it('把整數 minor unit 切出小數,全程不碰浮點', () => {
    expect(formatAmount('1234567', { scale: 2 })).toBe('12,345.67');
    expect(formatAmount('5', { scale: 2 })).toBe('0.05');
    expect(formatAmount('0', { scale: 2 })).toBe('0.00');
    expect(formatAmount('-5', { scale: 2 })).toBe('-0.05');
  });

  it('大數配 scale 一樣不失真', () => {
    expect(formatAmount('9223372036854775807', { scale: 2 })).toBe('92,233,720,368,547,758.07');
  });

  it('擋掉不合法的 scale', () => {
    expect(() => formatAmount('1', { scale: -1 })).toThrow(RangeError);
    expect(() => formatAmount('1', { scale: 1.5 })).toThrow(RangeError);
    expect(() => formatAmount('1', { scale: 19 })).toThrow(RangeError);
  });
});

describe('sumAmounts', () => {
  it('加總大額也是 bigint 全程', () => {
    expect(sumAmounts(['9007199254740993', '9007199254740993'])).toBe(18014398509481986n);
  });

  it('空陣列是 0,不是 NaN', () => {
    expect(sumAmounts([])).toBe(0n);
  });

  it('混 bigint 與字串', () => {
    expect(sumAmounts([100n, '-30', 5n])).toBe(75n);
  });
});

describe('toMachineAmount', () => {
  it('給螢幕閱讀器的值沒有千分位', () => {
    expect(toMachineAmount('1234567')).toBe('1234567');
    expect(toMachineAmount('1234567', 2)).toBe('12345.67');
  });
});
