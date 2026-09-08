import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '../test/axe';

import { Button } from './Button';
import { Card, CardBody, CardFooter, CardHeader } from './Card';

describe('Card', () => {
  it('是有語意的區塊,標頭有 header 角色', () => {
    render(
      <Card aria-label="第 3 場">
        <CardHeader label="準決賽" title="Nova vs Vex" />
        <CardBody>兩位選手上下排列</CardBody>
      </Card>,
    );
    expect(screen.getByRole('region', { name: '第 3 場' })).toBeInTheDocument();
    expect(screen.getByText('準決賽')).toBeInTheDocument();
    expect(screen.getByText('Nova vs Vex')).toBeInTheDocument();
  });

  it('live 會加上自己的 class,而脈動的紅點對輔助技術隱藏', () => {
    const { container } = render(
      <Card live aria-label="進行中">
        <CardHeader label="進行中" live />
      </Card>,
    );
    expect(container.querySelector('section')?.className).toContain('live');
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  });

  it('沒有給 label / title / aside 就不留空節點', () => {
    const { container } = render(
      <Card aria-label="空">
        <CardHeader />
      </Card>,
    );
    expect(container.querySelector('header')?.textContent).toBe('');
  });

  it('footer 放動作', () => {
    render(
      <Card aria-label="商品">
        <CardBody>顏色變更卡</CardBody>
        <CardFooter>
          <Button variant="money">購買</Button>
        </CardFooter>
      </Card>,
    );
    expect(screen.getByRole('button', { name: '購買' })).toBeInTheDocument();
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(
      <Card aria-label="第 3 場">
        <CardHeader label="準決賽" title="Nova vs Vex" />
        <CardBody>內容</CardBody>
        <CardFooter>
          <Button>加入注單</Button>
        </CardFooter>
      </Card>,
    );
    await expectNoAxeViolations(container);
  });
});
