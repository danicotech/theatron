import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '../test/axe';

import { Amount } from './Amount';

describe('Amount', () => {
  it('顯示千分位,機器可讀的值沒有千分位', () => {
    render(<Amount value="1234567" currency="PT" />);
    expect(screen.getByText('1,234,567')).toBeInTheDocument();
    expect(screen.getByText('PT')).toBeInTheDocument();
    const data = document.querySelector('data');
    expect(data).toHaveAttribute('value', '1234567');
  });

  it('超過 2^53 的金額原樣顯示', () => {
    render(<Amount value="9007199254740993" />);
    expect(screen.getByText('9,007,199,254,740,993')).toBeInTheDocument();
  });

  it('int64 最大值原樣顯示', () => {
    render(<Amount value={9223372036854775807n} />);
    expect(screen.getByText('9,223,372,036,854,775,807')).toBeInTheDocument();
  });

  it('拒絕 number,直接丟錯而不是顯示錯的數字', () => {
    // @ts-expect-error 型別已經擋掉,這裡驗執行期不會默默算錯
    expect(() => render(<Amount value={1234} />)).toThrow(TypeError);
  });

  it('label 會組成螢幕閱讀器唸得出來的整句', () => {
    render(<Amount value="-500" currency="PT" label="扣點" />);
    expect(screen.getByLabelText('扣點 -500PT')).toBeInTheDocument();
  });

  it('signDisplay always 讓帳本看得出方向', () => {
    render(<Amount value="500" signDisplay="always" />);
    expect(screen.getByText('+500')).toBeInTheDocument();
  });

  it('沒給 currency 就不渲染幣別標籤', () => {
    const { container } = render(<Amount value="10" />);
    expect(container.textContent).toBe('10');
  });

  it('tone 決定語意色的 class:錢是錢,贏是贏', () => {
    const { container, rerender } = render(<Amount value="10" />);
    expect(container.querySelector('data')?.className).toContain('money');

    rerender(<Amount value="10" tone="win" />);
    expect(container.querySelector('data')?.className).toContain('win');
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(<Amount value="1234567" currency="PT" label="餘額" size="lg" />);
    await expectNoAxeViolations(container);
  });
});
