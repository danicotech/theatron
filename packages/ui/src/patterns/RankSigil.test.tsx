import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '../test/axe';

import { RankSigil } from './RankSigil';

describe('RankSigil', () => {
  it('段位唸得出來,刻度不進無障礙樹', () => {
    render(<RankSigil level={3} total={4} name="飛花" title="純熟之境" />);
    expect(screen.getByRole('img', { name: '段位 飛花 純熟之境' })).toBeInTheDocument();
  });

  it('亮的刻度數等於階數 —— 高低要看得出來,不能只靠顏色', () => {
    const { container } = render(<RankSigil level={2} total={4} name="斷水" />);
    const marks = container.querySelector('span[aria-hidden="true"]')?.children;
    expect(marks).toHaveLength(4);
    const on = Array.from(marks ?? []).filter((m) => m.className.includes('on'));
    expect(on).toHaveLength(2);
  });

  it('最高階把刻度全亮', () => {
    const { container } = render(<RankSigil level={4} total={4} name="無我" />);
    const marks = Array.from(container.querySelector('span[aria-hidden="true"]')?.children ?? []);
    expect(marks.filter((m) => m.className.includes('on'))).toHaveLength(4);
  });

  // 裁判還沒評段是常態,不是錯誤狀態,所以不標紅。
  it('未評定時刻度全暗,且說得出來是未評定', () => {
    const { container } = render(<RankSigil level={0} total={4} name="" />);
    expect(screen.getByRole('img', { name: '未評定段位' })).toBeInTheDocument();
    const marks = Array.from(container.querySelector('span[aria-hidden="true"]')?.children ?? []);
    expect(marks.filter((m) => m.className.includes('on'))).toHaveLength(0);
    expect(screen.getByText('未評定')).toBeInTheDocument();
  });

  it('給了名稱但階數是 0 仍視為未評定', () => {
    render(<RankSigil level={0} total={4} name="開山" title="初試之境" />);
    expect(screen.getByRole('img', { name: '未評定段位' })).toBeInTheDocument();
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(<RankSigil level={1} total={4} name="開山" title="初試之境" />);
    await expectNoAxeViolations(container);
  });
});
