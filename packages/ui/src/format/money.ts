// 金額處理。整份 repo 只有這裡可以決定「一個金額長什麼樣子」。
//
// 為什麼不用 number:
//   後端金額一律 int64(專案鐵則 3),protobuf 的 JSON 編碼把 64 位整數寫成字串以保精度。
//   JS 的 number 是 double,超過 2^53 - 1 就靜默失真 —— 不會丟錯,只會少幾塊錢。
//   9007199254740993 進 Number 出來是 9007199254740992。對不上帳幾乎無法事後修復。
//
// 所以:這個檔案裡不出現 Number()、parseInt、parseFloat、toFixed、toLocaleString。
// money.guard.test.ts 會掃這個檔案的原始碼把關,不靠自律。

/** 金額的合法輸入。刻意不含 number —— 型別擋一次,執行期再擋一次。 */
export type MoneyValue = bigint | string;

const INTEGER_STRING = /^[+-]?\d+$/;

/** 千分位分隔符固定,不跟著 locale 走:賠率單的欄位對齊是功能,不是在地化。 */
const GROUP_SEPARATOR = ',';
const DECIMAL_SEPARATOR = '.';

export interface FormatAmountOptions {
  /** 小數位數。後端目前的代幣是整數,scale 留給未來有 minor unit 的幣別。 */
  scale?: number;
  /** 是否插千分位。賠率欄位有時候不要。 */
  grouping?: boolean;
  /** auto = 只有負數顯示符號;always = 正數也加 +;never = 不顯示符號。 */
  signDisplay?: 'auto' | 'always' | 'never';
}

/**
 * 把後端來的金額轉成 bigint。
 * 收到 number 直接丟錯:那代表呼叫端某處已經把字串餵進 Number 了,錯在上游。
 */
export function toAmount(value: MoneyValue): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value !== 'string') {
    throw new TypeError(
      '金額只接受 bigint 或整數字串。收到 number 代表上游已經失真過了(> 2^53 會靜默錯),請往回找。',
    );
  }
  const trimmed = value.trim();
  if (!INTEGER_STRING.test(trimmed)) {
    throw new TypeError(`不是合法的整數金額字串:${JSON.stringify(value)}`);
  }
  return BigInt(trimmed);
}

/** 加總。串關、注單小計都走這裡,不要在呼叫端自己 reduce 成 number。 */
export function sumAmounts(values: readonly MoneyValue[]): bigint {
  let total = 0n;
  for (const value of values) total += toAmount(value);
  return total;
}

function assertScale(scale: number): void {
  const ok = typeof scale === 'number' && scale >= 0 && scale <= 18 && (scale | 0) === scale;
  if (!ok) throw new RangeError('scale 必須是 0 到 18 的整數');
}

function group(digits: string): string {
  let out = '';
  for (let i = digits.length; i > 0; i -= 3) {
    const start = i - 3 > 0 ? i - 3 : 0;
    out = digits.slice(start, i) + (out === '' ? '' : GROUP_SEPARATOR + out);
  }
  return out;
}

/**
 * 顯示層格式化。回傳字串,呼叫端不要再拿去做算術。
 */
export function formatAmount(value: MoneyValue, options: FormatAmountOptions = {}): string {
  const { scale = 0, grouping = true, signDisplay = 'auto' } = options;
  assertScale(scale);

  const amount = toAmount(value);
  const negative = amount < 0n;
  const magnitude = (negative ? -amount : amount).toString();

  let integerDigits = magnitude;
  let fractionDigits = '';
  if (scale > 0) {
    const padded = magnitude.padStart(scale + 1, '0');
    integerDigits = padded.slice(0, padded.length - scale);
    fractionDigits = padded.slice(padded.length - scale);
  }

  const body =
    (grouping ? group(integerDigits) : integerDigits) +
    (fractionDigits === '' ? '' : DECIMAL_SEPARATOR + fractionDigits);

  if (signDisplay === 'never') return body;
  if (negative) return `-${body}`;
  if (signDisplay === 'always') return `+${body}`;
  return body;
}

/**
 * 給螢幕閱讀器與 <time>/<data> 用的原始值:沒有千分位、沒有 + 號。
 * 視覺上的千分位對聽的人是噪音。
 */
export function toMachineAmount(value: MoneyValue, scale = 0): string {
  return formatAmount(value, { scale, grouping: false, signDisplay: 'auto' });
}
