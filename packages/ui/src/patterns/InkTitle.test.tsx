import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '../test/axe';

import { InkTitle } from './InkTitle';

describe('InkTitle', () => {
  it('唸得出來那幅字寫的是什麼', () => {
    render(<InkTitle src="/type/ink-rules.svg" text="賽制" ratio={1.82} />);
    expect(screen.getByRole('img', { name: '賽制' })).toBeInTheDocument();
  });

  // 墨跡是黑的,直接貼在夜色上等於看不見。這個元件唯一的技術理由就是
  // 把 SVG 當遮罩、顏色交給樣式層,所以遮罩來源沒接上就等於整個元件失效。
  it('把 SVG 接成遮罩來源,而不是 <img>', () => {
    const { container } = render(<InkTitle src="/type/ink-signup.svg" text="報名" ratio={2} />);
    const el = container.querySelector('[role="img"]') as HTMLElement;
    expect(container.querySelector('img')).toBeNull();
    expect(el.style.getPropertyValue('--ink-src')).toBe('url(/type/ink-signup.svg)');
    expect(el.style.getPropertyValue('--ink-ratio')).toBe('2');
  });

  it('底色由 props 決定 —— 元件不知道自己被放在什麼顏色上面', () => {
    const { container, rerender } = render(
      <InkTitle src="/type/x.svg" text="戰帖" ratio={1.5} on="paper" />,
    );
    const cls = () => (container.querySelector('[role="img"]') as HTMLElement).className;
    expect(cls()).toContain('paper');
    rerender(<InkTitle src="/type/x.svg" text="戰帖" ratio={1.5} />);
    expect(cls()).toContain('dark');
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(
      <InkTitle src="/type/ink-war-letter.svg" text="戰帖" ratio={1.65} size="lead" />,
    );
    await expectNoAxeViolations(container);
  });
});
