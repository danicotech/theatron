import { Code, ConnectError } from '@connectrpc/connect';
import { expectNoAxeViolations } from '@theatron/ui/testing';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JudgeLogin } from './JudgeLogin';

const localLogin = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => ({ value: new URLSearchParams() }));

vi.mock('../../lib/api/client', () => ({ platformApi: { auth: { localLogin } } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => search.value,
}));

describe('JudgeLogin', () => {
  beforeEach(() => {
    localLogin.mockReset();
    push.mockReset();
    localLogin.mockResolvedValue({});
    search.value = new URLSearchParams();
  });

  it('送出登入名與通行碼,成功後回到裁判台', async () => {
    render(<JudgeLogin />);
    await userEvent.type(screen.getByLabelText('登入名'), '  御風羽  ');
    await userEvent.type(screen.getByLabelText('通行碼'), 'ABCD2345EFGH');
    await userEvent.click(screen.getByRole('button', { name: '登入' }));

    expect(localLogin).toHaveBeenCalledWith({ loginName: '御風羽', passcode: 'ABCD2345EFGH' });
    expect(push).toHaveBeenCalledWith('/judge');
  });

  it('帶著回程來就回到那一頁', async () => {
    search.value = new URLSearchParams('next=/judge/2026-baiye-shifeng');
    render(<JudgeLogin />);
    await userEvent.type(screen.getByLabelText('登入名'), 'lin');
    await userEvent.type(screen.getByLabelText('通行碼'), 'ABCD2345EFGH');
    await userEvent.click(screen.getByRole('button', { name: '登入' }));
    expect(push).toHaveBeenCalledWith('/judge/2026-baiye-shifeng');
  });

  // next 來自網址列,是外部輸入。絕對網址會把人導去站外。
  it.each(['https://evil.example/x', '//evil.example/x', 'javascript:alert(1)'])(
    '站外的回程 %s 一律退回裁判台',
    async (bad) => {
      search.value = new URLSearchParams(`next=${bad}`);
      render(<JudgeLogin />);
      await userEvent.type(screen.getByLabelText('登入名'), 'lin');
      await userEvent.type(screen.getByLabelText('通行碼'), 'ABCD2345EFGH');
      await userEvent.click(screen.getByRole('button', { name: '登入' }));
      expect(push).toHaveBeenCalledWith('/judge');
    },
  );

  it('失敗時顯示伺服器給的那一句,而且不說是哪裡錯', async () => {
    localLogin.mockRejectedValue(new ConnectError('登入名或通行碼不正確', Code.Unauthenticated));
    render(<JudgeLogin />);
    await userEvent.type(screen.getByLabelText('登入名'), 'lin');
    await userEvent.type(screen.getByLabelText('通行碼'), 'WRONG2345EFG');
    await userEvent.click(screen.getByRole('button', { name: '登入' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('登入名或通行碼不正確');
    expect(push).not.toHaveBeenCalled();
  });

  it('欄位沒填滿不打伺服器', async () => {
    render(<JudgeLogin />);
    await userEvent.type(screen.getByLabelText('登入名'), 'lin');
    await userEvent.click(screen.getByRole('button', { name: '登入' }));
    expect(localLogin).not.toHaveBeenCalled();
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(<JudgeLogin />);
    await expectNoAxeViolations(container);
  });
});
