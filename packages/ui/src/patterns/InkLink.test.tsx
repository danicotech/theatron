import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '../test/axe';

import { InkLink } from './InkLink';

describe('InkLink', () => {
  it('是連結,不是按鈕 —— 目的地是另一個位置', () => {
    render(<InkLink href="/t/demo/rules">規則</InkLink>);
    const a = screen.getByRole('link', { name: '規則' });
    expect(a).toHaveAttribute('href', '/t/demo/rules');
  });

  // 箭頭說的是「這會帶你去別的地方」,而那件事連結本身已經說了。
  it('箭頭不進無障礙樹,也不進可及名稱', () => {
    render(<InkLink href="#x">對戰表</InkLink>);
    expect(screen.getByRole('link').textContent).toContain('↗');
    expect(screen.getByRole('link', { name: '對戰表' })).toBeInTheDocument();
  });

  it('說明文字唸得到,因為它說的是連結本身沒說的事', () => {
    render(
      <InkLink href="#x" hint="段位、BP、讓武項目">
        規則
      </InkLink>,
    );
    expect(screen.getByRole('link', { name: /段位、BP、讓武項目/ })).toBeInTheDocument();
  });

  it('朱紅是另一種色調,不是另一種元件', () => {
    const { container, rerender } = render(
      <InkLink href="#x" tone="vermilion">
        報名
      </InkLink>,
    );
    expect(container.querySelector('a')?.className).toContain('vermilion');
    rerender(<InkLink href="#x">報名</InkLink>);
    expect(container.querySelector('a')?.className).toContain('ink');
  });

  it('其餘 anchor 屬性照傳', () => {
    render(
      <InkLink href="https://example.test" target="_blank" rel="noreferrer">
        外部
      </InkLink>,
    );
    const a = screen.getByRole('link');
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', 'noreferrer');
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(
      <InkLink href="#x" hint="看完整讓武項目" tone="vermilion">
        規則
      </InkLink>,
    );
    await expectNoAxeViolations(container);
  });
});
