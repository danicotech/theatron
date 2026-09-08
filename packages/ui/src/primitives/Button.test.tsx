import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { expectNoAxeViolations } from '../test/axe';

import { Button } from './Button';

describe('Button', () => {
  it('渲染成 button 而不是可點的 div', () => {
    render(<Button>報名參賽</Button>);
    const button = screen.getByRole('button', { name: '報名參賽' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('type', 'button');
  });

  it('點擊會呼叫 onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>送出注單</Button>);
    await userEvent.click(screen.getByRole('button', { name: '送出注單' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('loading 期間停用並標上 aria-busy —— 連點會送出兩張注單', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        送出注單
      </Button>,
    );
    const button = screen.getByRole('button', { name: '送出注單' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disabled 不會被標成 busy', () => {
    render(<Button disabled>送出注單</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute('aria-busy');
  });

  it('三個 variant 各自吃到自己的 class,不共用', () => {
    const { rerender } = render(<Button variant="money">購買</Button>);
    expect(screen.getByRole('button').className).toContain('money');

    rerender(<Button variant="danger">判定勝者</Button>);
    expect(screen.getByRole('button').className).toContain('danger');

    rerender(<Button>取消</Button>);
    const cls = screen.getByRole('button').className;
    expect(cls).not.toContain('money');
    expect(cls).not.toContain('danger');
  });

  it('可以用鍵盤 focus', async () => {
    render(<Button>報名參賽</Button>);
    await userEvent.tab();
    expect(screen.getByRole('button')).toHaveFocus();
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(
      <Button variant="money" size="lg">
        送出注單
      </Button>,
    );
    await expectNoAxeViolations(container);
  });
});
