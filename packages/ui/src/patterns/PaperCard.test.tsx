import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '../test/axe';

import { PaperCard } from './PaperCard';

describe('PaperCard', () => {
  // 用 dt/dd 而不是查 ARIA 角色:`<dl>` 裡包 `<div>` 分列是合法 HTML,
  // 但 jsdom 不把它對映成 term/definition。要驗的是「這是成對的資料」,
  // 而在 DOM 裡那件事就是 dt/dd,不是角色名。
  it('條目是 dl,標籤與值成對 —— 告示的欄位是有結構的資料,不是排版', () => {
    const { container } = render(
      <PaperCard
        title="論劍"
        rows={[
          { label: '開賽日期', value: '待公布' },
          { label: '報名截止', value: '待公布' },
        ]}
      />,
    );
    expect(container.querySelectorAll('dl dt')).toHaveLength(2);
    expect(container.querySelectorAll('dl dd')).toHaveLength(2);
    expect(screen.getByText('開賽日期').tagName).toBe('DT');
  });

  it('標題層級可指定 —— 紙可能是頁面的第二層,也可能是一段裡的第三層', () => {
    const { rerender } = render(<PaperCard title="戰帖" headingLevel={2} />);
    expect(screen.getByRole('heading', { level: 2, name: /戰帖/ })).toBeInTheDocument();
    rerender(<PaperCard title="戰帖" />);
    expect(screen.getByRole('heading', { level: 3, name: /戰帖/ })).toBeInTheDocument();
  });

  // 副標是標題的一部分,不是第二個標題 —— 多一層標題會讓大綱多一個沒有內容的節點。
  it('副標唸在標題裡,不另外成為一個標題', () => {
    render(<PaperCard title="論劍" subtitle="武俠競技大會" />);
    const heading = screen.getByRole('heading');
    expect(heading.textContent).toBe('論劍武俠競技大會');
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  // 內框與印是裝飾:一個是「這是正式文件」的訊號,一個旁邊已經有字了。
  // 兩個都唸出來只會在每一張紙前面多兩段沒有意義的聲音。
  it('內框與印不進無障礙樹', () => {
    const { container } = render(
      <PaperCard title="論劍" stamp={<svg data-testid="seal" />} kicker="江湖令" />,
    );
    const hidden = container.querySelectorAll('[aria-hidden="true"]');
    expect(hidden.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByTestId('seal')?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('沒有內容的段落不留空殼', () => {
    const { container } = render(<PaperCard title="論劍" />);
    expect(container.querySelector('dl')).toBeNull();
    expect(container.querySelector('p')).toBeNull();
  });

  it('頁首只有其中一邊時仍然成立', () => {
    render(<PaperCard kicker="江湖令" />);
    expect(screen.getByText('江湖令')).toBeInTheDocument();
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(
      <PaperCard
        kicker="江湖令"
        index="PUBLIC NOTICE / 001"
        title="論劍"
        subtitle="武俠競技大會"
        rows={[{ label: '獎金', value: '待公布', mono: true }]}
        note="正式報名辦法將於本頁公告。"
        action={<a href="#schedule">看賽事進程</a>}
      />,
    );
    await expectNoAxeViolations(container);
  });
});
