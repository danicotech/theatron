import { create, fromJson, toJson } from '@bufbuild/protobuf';
import { formatAmount, toAmount } from '@theatron/ui';
import { describe, expect, it } from 'vitest';

import { BalanceSchema } from './gen/hestia/platform/v1/common_pb';

// 這一組測的是**契約本身**,不是我們寫的程式:
// 後端金額是 int64,protobuf 的 JSON 編碼會把它寫成字串。
// 只要生成鏈或 protobuf-es 的行為變了(例如哪天 int64 變成 number),
// 這裡會先紅,而不是等到帳對不上才發現。

const OVER_2_53 = '9007199254740993'; // 2^53 + 1,Number 接不住的第一個整數
const INT64_MAX = '9223372036854775807';

describe('生成型別的金額欄位', () => {
  it('int64 在 TS 這側是 bigint,不是 number', () => {
    const balance = create(BalanceSchema, { currency: 'PT', amount: 1n });
    expect(typeof balance.amount).toBe('bigint');
  });

  it('JSON 編出來是字串 —— 這是刻意的,為了保精度', () => {
    const balance = create(BalanceSchema, { currency: 'PT', amount: BigInt(OVER_2_53) });
    const json = toJson(BalanceSchema, balance) as { amount: string };
    expect(json.amount).toBe(OVER_2_53);
    expect(typeof json.amount).toBe('string');
  });

  it('從 JSON 字串解回來一個 bit 都沒掉', () => {
    const balance = fromJson(BalanceSchema, { currency: 'PT', amount: INT64_MAX });
    expect(balance.amount).toBe(9223372036854775807n);
  });

  it('生成的 bigint 可以直接餵給顯示層,中間不需要任何轉換', () => {
    const balance = create(BalanceSchema, { currency: 'PT', amount: BigInt(OVER_2_53) });
    expect(formatAmount(balance.amount)).toBe('9,007,199,254,740,993');
    expect(toAmount(balance.amount)).toBe(9007199254740993n);
  });

  it('對照組:同一個值走 Number 就少一塊錢', () => {
    expect(String(globalThis.Number(OVER_2_53))).toBe('9007199254740992');
  });
});
