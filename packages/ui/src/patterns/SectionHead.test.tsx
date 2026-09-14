import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '../test/axe';

import { SectionHead } from './SectionHead';

describe('SectionHead', () => {
  it('小節預設是 h2,可以降成 h3', () => {
    const { rerender } = render(<SectionHead>段位</SectionHead>);
    expect(screen.getByRole('heading', { level: 2, name: '段位' })).toBeInTheDocument();
    rerender(<SectionHead level={3}>段位</SectionHead>);
    expect(screen.getByRole('heading', { level: 3, name: '段位' })).toBeInTheDocument();
  });

  // 英文是同一件事的第二種寫法。唸兩次只是噪音,而且會讓大綱多一個假的項目。
  it('英文不進無障礙樹,也不影響標題的可及名稱', () => {
    render(
      <SectionHead en="THE RANKS" id="ranks">
        段位
      </SectionHead>,
    );
    expect(screen.getByRole('heading', { name: '段位' })).toHaveAttribute('id', 'ranks');
    expect(screen.getByText('THE RANKS')).toHaveAttribute('aria-hidden', 'true');
  });

  it('沒給英文就只有標題', () => {
    const { container } = render(<SectionHead>賽程</SectionHead>);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });

  it('題字掛在標題裡 —— 它說的是這一節在辦什麼事', () => {
    render(
      <SectionHead mark={<span data-testid="mark" />} en="THE ROAD">
        賽程
      </SectionHead>,
    );
    const heading = screen.getByRole('heading');
    expect(heading.querySelector('[data-testid="mark"]')).not.toBeNull();
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(
      <SectionHead en="THE FORMAT" id="format">
        賽制
      </SectionHead>,
    );
    await expectNoAxeViolations(container);
  });
});
