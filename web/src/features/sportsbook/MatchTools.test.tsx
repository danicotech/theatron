import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { diceValue, handWinner, MatchTools } from './MatchTools';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it('判定九種猜拳組合，雙方交換時勝負反轉', () => {
  const hands = ['剪刀', '石頭', '布'] as const;
  for (const a of hands)
    for (const b of hands) {
      const result = handWinner(a, b);
      expect(result === 0).toBe(a === b);
      if (a !== b) expect(handWinner(b, a)).toBe(result === 1 ? 2 : 1);
    }
  expect(handWinner('剪刀', '布')).toBe(1);
  expect(handWinner('布', '石頭')).toBe(1);
  expect(handWinner('石頭', '剪刀')).toBe(1);
});
it('骰子排除有偏餘數，再回傳一至六點', () => {
  const values = [4294967295, 4294967292, 5];
  const random = vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
    (array as Uint32Array)[0] = values.shift()!;
    return array;
  });
  expect(diceValue()).toBe(6);
  expect(random).toHaveBeenCalledTimes(3);
});
it('甲方出拳後隱藏答案，乙方確認接手再選，最後一起揭曉', () => {
  render(<MatchTools />);
  fireEvent.click(screen.getByRole('button', { name: '剪刀石頭布' }));
  fireEvent.click(screen.getByRole('button', { name: '剪刀' }));
  expect(screen.queryByText('剪刀', { exact: true })).toBeNull();
  expect(screen.queryByRole('button', { name: '石頭' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '我是 乙方，開始選擇' }));
  fireEvent.click(screen.getByRole('button', { name: '布' }));
  expect(screen.getByRole('status')).toHaveTextContent('甲方 勝出');
  fireEvent.click(screen.getByRole('button', { name: '再猜一次' }));
  expect(screen.getByRole('heading', { name: '甲方，請出拳' })).toBeVisible();
});
it('切換工具和卸載都取消尚未完成的擲骰動畫', async () => {
  vi.useFakeTimers();
  const { unmount } = render(<MatchTools />);
  fireEvent.click(screen.getByRole('button', { name: '雙方擲骰' }));
  expect(screen.getByRole('button', { name: '擲骰中…' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '剪刀石頭布' }));
  await act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole('status')).toHaveTextContent('等待雙方結果');
  fireEvent.click(screen.getByRole('button', { name: '擲骰比大小' }));
  fireEvent.click(screen.getByRole('button', { name: '雙方擲骰' }));
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
