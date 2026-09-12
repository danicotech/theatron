import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '../test/axe';

import { PhaseTrack, type PhaseTrackStep } from './PhaseTrack';

const steps: PhaseTrackStep[] = [
  { key: 'signup', label: '報名' },
  { key: 'ranking', label: '評段' },
  { key: 'ranked', label: '段位公布', hint: '刻意排在抽籤之前' },
  { key: 'drawing', label: '抽籤' },
  { key: 'in_progress', label: '比賽中' },
];

describe('PhaseTrack', () => {
  it('是導覽地標,每一階段都列出來', () => {
    render(<PhaseTrack steps={steps} current="ranked" />);
    expect(screen.getByRole('navigation', { name: '賽事階段' })).toBeInTheDocument();
    for (const s of steps) {
      expect(screen.getByText(s.label)).toBeInTheDocument();
    }
  });

  it('只有當前階段帶 aria-current,讀螢幕的人才知道走到哪', () => {
    render(<PhaseTrack steps={steps} current="drawing" />);
    const current = screen.getAllByRole('listitem').filter((li) => li.getAttribute('aria-current'));
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('抽籤');
  });

  it('當前階段之前算完成,之後算未到達', () => {
    const { container } = render(<PhaseTrack steps={steps} current="ranked" />);
    const items = Array.from(container.querySelectorAll('li'));
    expect(items[0]?.className).toContain('done');
    expect(items[1]?.className).toContain('done');
    expect(items[2]?.className).toContain('current');
    expect(items[3]?.className).toContain('todo');
  });

  // 階段是後端回來的字串。認不得的值不該讓整條軌道消失,
  // 也不該隨便亮一格 —— 亮錯格比不亮更糟。
  it('current 認不得時,沒有任何一格是當前', () => {
    const { container } = render(<PhaseTrack steps={steps} current="unspecified" />);
    expect(container.querySelectorAll('[aria-current]')).toHaveLength(0);
    expect(container.querySelectorAll('li')).toHaveLength(steps.length);
  });

  it('編號只給眼睛看,不進無障礙樹', () => {
    const { container } = render(<PhaseTrack steps={steps} current="signup" />);
    // 「1」是視覺編號,朗讀出來只會干擾;階段名稱才是內容。
    const first = container.querySelector('li');
    const index = Array.from(first?.children ?? []).find((el) => el.textContent === '1');
    expect(index).toBeDefined();
    expect(index).toHaveAttribute('aria-hidden', 'true');
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(<PhaseTrack steps={steps} current="ranking" />);
    await expectNoAxeViolations(container);
  });
});
