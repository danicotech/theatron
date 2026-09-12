import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '../test/axe';

import { BracketTree, type BracketRoundView } from './BracketTree';

const rounds: BracketRoundView[] = [
  {
    round: 1,
    label: '首輪',
    matches: [
      {
        id: 'm1',
        state: 'done',
        top: { name: '李璃', rank: { level: 3, total: 4, name: '飛花' }, won: true },
        bottom: { name: 'A冷', rank: { level: 1, total: 4, name: '開山' } },
        onWinnerPath: true,
      },
      { id: 'm2', state: 'live', top: { name: '無名' }, bottom: { name: '風十一' } },
    ],
  },
  {
    round: 2,
    label: '決賽',
    matches: [{ id: 'm3', state: 'upcoming', top: { name: '李璃' }, bottom: undefined }],
  },
];

describe('BracketTree', () => {
  it('每一輪都畫出來,而且輪次名稱由呼叫端給', () => {
    render(<BracketTree rounds={rounds} />);
    expect(screen.getByRole('region', { name: '首輪' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '決賽' })).toBeInTheDocument();
  });

  // 手機是分輪檢視 —— 切換器是那個佈局的一部分,不是裝飾。
  it('輪次切換器列出每一輪,點了就換', async () => {
    render(<BracketTree rounds={rounds} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['首輪', '決賽']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(tabs[1] as HTMLElement);
    expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
  });

  // 規範要求預設落在「有事情正在發生的那一輪」,而不是第 1 輪。
  it('預設輪次由呼叫端指定', () => {
    render(<BracketTree rounds={rounds} defaultRound={2} />);
    expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('資料晚一步到時,預設輪次仍然跟上', () => {
    const { rerender } = render(<BracketTree rounds={rounds} />);
    expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true');
    rerender(<BracketTree rounds={rounds} defaultRound={2} />);
    expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
  });

  // 空位是「上一輪還沒打完」,不是壞掉。留白看起來就是壞掉。
  it('還沒確定的對手寫「待定」', () => {
    render(<BracketTree rounds={rounds} />);
    expect(screen.getByText('待定')).toBeInTheDocument();
  });

  it('勝者看得出來,而且只有勝者', () => {
    const { container } = render(<BracketTree rounds={rounds} />);
    const won = Array.from(container.querySelectorAll('span')).filter((s) =>
      s.className.includes('won'),
    );
    expect(won).toHaveLength(1);
    expect(won[0]).toHaveTextContent('李璃');
  });

  it('進行中的脈動點對輔助技術隱藏 —— 它是狀態的重複表達,不是內容', () => {
    const { container } = render(<BracketTree rounds={rounds} />);
    const dots = container.querySelectorAll('[aria-hidden="true"]');
    expect(dots.length).toBeGreaterThan(0);
    expect(container.innerHTML).toContain('liveDot');
  });

  it('可點的場次是連結,不可點的不是', () => {
    const withHref: BracketRoundView[] = [
      { round: 1, label: '首輪', matches: [{ ...rounds[0]!.matches[0]!, href: '/m/1' }] },
    ];
    render(<BracketTree rounds={withHref} matchLabel={() => '第 1 場'} />);
    expect(screen.getByRole('link', { name: '第 1 場' })).toHaveAttribute('href', '/m/1');
  });

  it('沒有輪次時不畫任何東西', () => {
    const { container } = render(<BracketTree rounds={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(
      <BracketTree rounds={rounds} matchLabel={(_, i) => `第 ${i + 1} 場`} />,
    );
    await expectNoAxeViolations(container);
  });
});
