import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SCHEDULE } from '../content';
import { bloomOf, dateState } from '../dates';
import { Blossom } from '../Plum';
import { PlumDates } from './PlumDates';

describe('梅枝時程', () => {
  it('四個日期都在,而且順序是先後', () => {
    render(<PlumDates now={new Date(2026, 9, 15)} />);
    const list = screen.getByTestId('plum-dates');
    const names = Array.from(
      list.querySelectorAll('li'),
      (li) => li.querySelector('b')?.textContent,
    );
    expect(names).toEqual(['開放報名', '報名截止', '初賽', '決賽']);
    expect(names).toHaveLength(SCHEDULE.length);
  });

  // 現在整份內容還是 {{PLACEHOLDER}},所以四朵都該是「不知道」而不是「還沒到」。
  it('日期還沒定案時四朵都是花苞,而且明講待公布', () => {
    render(<PlumDates now={new Date(2026, 9, 15)} />);
    const list = screen.getByTestId('plum-dates');
    for (const li of list.querySelectorAll('li')) {
      expect(li).toHaveAttribute('data-date-state', 'unknown');
      expect(within(li as HTMLElement).getByText('日期待公布')).toBeInTheDocument();
      expect(within(li as HTMLElement).getByText('待公布')).toBeInTheDocument();
      // 花沒開:data-open 只在全開時才有。
      expect(li.querySelector('svg[data-open]')).toBeNull();
    }
  });

  // 「到期才開」這條規則:規則本身在 dates.test.ts 驗,這裡驗它真的接到花上 ——
  // 兩者分開才看得出斷掉的是規則還是接線。
  it('到期的那一朵才開,沒到期的是花苞', () => {
    const now = new Date(2026, 9, 15);
    const { rerender } = render(
      <Blossom open={bloomOf(dateState('2026-11-01', now))} label="初賽 尚未到期" />,
    );
    expect(screen.getByLabelText('初賽 尚未到期')).not.toHaveAttribute('data-open');

    rerender(<Blossom open={bloomOf(dateState('2026-10-15', now))} label="初賽 已到期" />);
    expect(screen.getByLabelText('初賽 已到期')).toHaveAttribute('data-open');
  });

  it('每一朵旁邊都有字,不只靠花開不開傳達事實', () => {
    render(<PlumDates now={new Date(2026, 9, 15)} />);
    const list = screen.getByTestId('plum-dates');
    for (const li of list.querySelectorAll('li')) {
      // 名稱、日期、狀態三行都在。
      expect(li.querySelector('b')?.textContent).toBeTruthy();
      expect(li.querySelector('time')?.textContent).toBeTruthy();
      expect(li.textContent).toContain('待公布');
    }
  });

  // 沒有有效日期時不該吐一個空的 datetime 屬性 —— 那是一個說謊的機器可讀欄位。
  it('日期未定時 <time> 不帶 datetime', () => {
    render(<PlumDates now={new Date(2026, 9, 15)} />);
    for (const t of screen.getByTestId('plum-dates').querySelectorAll('time')) {
      expect(t.hasAttribute('datetime')).toBe(false);
    }
  });
});
