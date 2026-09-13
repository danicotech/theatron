import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '../test/axe';

import { ChapterHead } from './ChapterHead';

describe('ChapterHead', () => {
  it('標題是 h1,印記與小字都在畫面上', () => {
    render(<ChapterHead number="貳" eyebrow="百業試鋒 · 對戰表" title="2026 春季賽" />);
    expect(screen.getByRole('heading', { level: 1, name: '2026 春季賽' })).toBeInTheDocument();
    expect(screen.getByText('貳')).toBeInTheDocument();
    expect(screen.getByText('百業試鋒 · 對戰表')).toBeInTheDocument();
  });

  // 印記是視覺章節記號。朗讀「壹」在標題前面只會干擾,所以它不進無障礙樹。
  it('印記只給眼睛看', () => {
    render(<ChapterHead number="壹" title="t" />);
    expect(screen.getByText('壹')).toHaveAttribute('aria-hidden', 'true');
  });

  it('事實列是 dl,數值標了 mono 才用等寬', () => {
    render(
      <ChapterHead
        number="壹"
        title="t"
        facts={[
          { label: '已報名', value: '12', mono: true },
          { label: '季軍戰', value: '有' },
        ]}
      />,
    );
    expect(screen.getByText('已報名').closest('dl')).not.toBeNull();
    expect(screen.getByText('12').className).toContain('mono');
    expect(screen.getByText('有').className).not.toContain('mono');
  });

  it('沒給的東西就不畫:沒有引言、沒有事實列、沒有附件', () => {
    const { container } = render(<ChapterHead number="壹" title="t" />);
    expect(container.querySelector('p')).toBeNull();
    expect(container.querySelector('dl')).toBeNull();
    expect(container.querySelectorAll('.aside')).toHaveLength(0);
  });

  it('引言與附件會出現', () => {
    render(
      <ChapterHead
        number="裁"
        title="t"
        lede="段位差決定讓武 BP。"
        aside={<a href="/judge/s">← 裁判台</a>}
      />,
    );
    expect(screen.getByText('段位差決定讓武 BP。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← 裁判台' })).toBeInTheDocument();
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(
      <ChapterHead
        number="參"
        eyebrow="百業試鋒 · 規則"
        title="段位定其差,BP 量其讓"
        lede="引言"
        facts={[{ label: '每差一段', value: '8 BP', mono: true }]}
        aside={<a href="/t/s">回賽事首頁</a>}
      />,
    );
    await expectNoAxeViolations(container);
  });
});
