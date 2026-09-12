import { expectNoAxeViolations } from '@theatron/ui/testing';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateTournamentForm } from './CreateTournamentForm';

// vi.mock 的 factory 會被提升到檔案最上面,所以它引用得到的東西必須也被提升。
// 用 vi.hoisted 取得同一個 mock,而不是在 factory 裡包一層轉呼叫 ——
// 包一層會讓回傳值變成 any,而那正是型別檢查要擋的東西。
const { createTournament } = vi.hoisted(() => ({ createTournament: vi.fn() }));

vi.mock('../../lib/api/activity', () => ({
  activityApi: { judge: { createTournament } },
}));

// 逐一輸入,不要 Promise.all —— 併發的 userEvent 會互相打斷,
// 結果是某幾欄靜默變成空字串。
async function fill(labels: Record<string, string>) {
  for (const [label, value] of Object.entries(labels)) {
    await userEvent.type(screen.getByLabelText(label), value);
  }
}

describe('CreateTournamentForm', () => {
  beforeEach(() => {
    createTournament.mockReset();
    createTournament.mockResolvedValue({
      tournament: { slug: '2026-baiye-shifeng', name: '百業試鋒' },
      handicapItemCount: 34,
    });
  });

  it('沒填的規則旋鈕送 0,讓伺服器用預設 —— 不在前端抄一份預設值', async () => {
    const onCreated = vi.fn();
    render(<CreateTournamentForm onCreated={onCreated} />);
    await fill({
      賽事名稱: '百業試鋒',
      網址代號: '2026-baiye-shifeng',
      社群: '01J0COMMUNITY',
    });
    await userEvent.click(screen.getByRole('button', { name: '開賽事' }));

    expect(createTournament).toHaveBeenCalledTimes(1);
    expect(createTournament.mock.calls[0]?.[0]).toMatchObject({
      slug: '2026-baiye-shifeng',
      bpPerRankGap: 0n,
      signupBonus: 0n,
      prizes: { champion: 0n, runnerUp: 0n, third: 0n, participation: 0n },
    });
    expect(onCreated).toHaveBeenCalledWith({
      slug: '2026-baiye-shifeng',
      name: '百業試鋒',
      handicapItemCount: 34,
    });
  });

  // 單淘汰推不出季軍,設了獎金會讓賽後整批發獎被拒 —— 現在講比賽後講便宜。
  it('填了季軍獎金才出現警告,而且說的是「整批拒發」', async () => {
    render(<CreateTournamentForm onCreated={vi.fn()} />);
    expect(screen.queryByText(/季軍賽/)).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('季軍'), '100');
    expect(screen.getByRole('status')).toHaveTextContent('整批拒發');
  });

  it('季軍填 0 不算設了獎金', async () => {
    render(<CreateTournamentForm onCreated={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('季軍'), '0');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('代號被占用時,錯誤指到代號那一欄,而不是只丟一句話', async () => {
    const { ConnectError, Code } = await import('@connectrpc/connect');
    const err = new ConnectError('這個代號已經有人用了', Code.AlreadyExists);
    err.metadata.set('hestia-error-reason', 'tournament_slug_taken');
    createTournament.mockRejectedValue(err);

    render(<CreateTournamentForm onCreated={vi.fn()} />);
    await fill({ 賽事名稱: 'x', 網址代號: 'taken', 社群: '01J0' });
    await userEvent.click(screen.getByRole('button', { name: '開賽事' }));

    expect(screen.getByRole('alert')).toHaveTextContent('這個代號已經有人用了');
    expect(screen.getByLabelText('網址代號')).toHaveAttribute('aria-invalid', 'true');
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(<CreateTournamentForm onCreated={vi.fn()} />);
    await expectNoAxeViolations(container);
  });
});
