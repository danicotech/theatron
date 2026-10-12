import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TournamentDisplay } from '../landing/tournamentDisplay';
import { WuxiaBracket } from './WuxiaBracket';

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
const data = (): TournamentDisplay => ({
  kind: 'ready',
  slug: 'autumn/cup',
  published: true,
  bestOf: 3,
  players: [
    { id: 'a', name: '蒼松', rank: 2, rankName: '斷水', seed: 1 },
    { id: 'b', name: '夜雨', rank: 3, rankName: '飛花', seed: 2 },
  ],
  rounds: [
    {
      round: 1,
      label: '決賽',
      matches: [
        {
          id: 'final/one',
          round: 1,
          slot: 0,
          p1: 'a',
          p2: 'b',
          winner: '',
          status: 'live',
          bye: false,
          kind: 'bracket',
          s1: 1,
          s2: 1,
        },
      ],
    },
  ],
});
beforeEach(() => {
  navigation.push.mockReset();
});
describe('裁判共用晉級樹', () => {
  it('點名帖或比分前往正確裁判場次，畫面不直接判賽果', async () => {
    const view = render(
      <StrictMode>
        <WuxiaBracket data={data()} />
      </StrictMode>,
    );
    await userEvent.click(screen.getByRole('button', { name: '藍方，夜雨，開啟本場裁判台' }));
    expect(navigation.push).toHaveBeenLastCalledWith('/judge/autumn%2Fcup/m/final%2Fone');
    await userEvent.click(screen.getByRole('button', { name: /蒼松 對 夜雨.*開啟本場裁判台/ }));
    expect(navigation.push).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: /確定判/ })).not.toBeInTheDocument();
    const old = screen.getByRole('button', { name: '藍方，夜雨，開啟本場裁判台' });
    view.unmount();
    old.click();
    expect(navigation.push).toHaveBeenCalledTimes(2);
  });
  it('只依伺服器更新顯示冠軍與勝敗，輪詢保留正在操作的選手焦點', () => {
    const initial = data(),
      view = render(<WuxiaBracket data={initial} />);
    expect(screen.getByRole('button', { name: '冠軍待定，查看決賽' })).toBeInTheDocument();
    screen.getByRole('button', { name: '紅方，蒼松，開啟本場裁判台' }).focus();
    const done = data();
    done.rounds[0]!.matches[0] = {
      ...done.rounds[0]!.matches[0]!,
      winner: 'a',
      status: 'done',
      s1: 2,
    };
    view.rerender(<WuxiaBracket data={done} />);
    expect(screen.getByRole('button', { name: '冠軍 蒼松，查看決賽' })).toBeInTheDocument();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: '紅方，蒼松，開啟本場裁判台' }),
    );
    expect(screen.getByRole('button', { name: '藍方，夜雨，開啟本場裁判台' })).toHaveAttribute(
      'data-eliminated',
      'true',
    );
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
