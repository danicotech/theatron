import { create } from '@bufbuild/protobuf';
import { expectNoAxeViolations } from '@theatron/ui/testing';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Rank, RankInfoSchema } from '../../lib/api/gen/hestia/activity/v1/common_pb';

import { PlayerLogin } from './PlayerLogin';
import { SignupForm } from './SignupForm';

const api = vi.hoisted(() => ({ register: vi.fn(), login: vi.fn(), listRanks: vi.fn() }));
const push = vi.hoisted(() => vi.fn());

vi.mock('../../lib/api/activity', () => ({
  activityApi: {
    signup: { register: api.register, login: api.login },
    tournament: { listRanks: api.listRanks },
  },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const RANKS = [
  create(RankInfoSchema, { rank: Rank.KAISHAN, name: '開山', title: '初試之境' }),
  create(RankInfoSchema, { rank: Rank.FEIHUA, name: '飛花', title: '純熟之境' }),
];

describe('SignupForm', () => {
  beforeEach(() => {
    Object.values(api).forEach((m) => {
      m.mockReset();
    });
    push.mockReset();
    api.listRanks.mockResolvedValue({ ranks: RANKS, bpPerRankGap: 8n });
    api.register.mockResolvedValue({ player: { displayName: '李璃' } });
  });

  // 使用者 2026-09-13 定案:只有遊戲ID 必填。
  it('只填遊戲ID 就送得出去,其餘欄位送空值', async () => {
    render(<SignupForm slug="s" onDone={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('遊戲ID'), '李璃');
    await userEvent.click(screen.getByRole('button', { name: '報名參賽' }));

    expect(api.register).toHaveBeenCalledWith({
      tournamentSlug: 's',
      gameId: '李璃',
      displayName: '',
      discordName: '',
      selfRatedRank: Rank.UNSPECIFIED,
      ladderRank: '',
      ladderScore: 0,
      artsNote: '',
      availabilityNote: '',
    });
  });

  it('自評段位可以選,也可以再點一次取消', async () => {
    render(<SignupForm slug="s" onDone={vi.fn()} />);
    const feihua = await screen.findByRole('button', { name: /飛花/ });
    await userEvent.click(feihua);
    expect(feihua).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(feihua);
    expect(feihua).toHaveAttribute('aria-pressed', 'false');
  });

  // 段位清單讀不到不該讓人報不了名 —— 自評本來就是選填。
  it('段位清單讀不到仍然報得了名', async () => {
    api.listRanks.mockRejectedValue(new Error('boom'));
    const onDone = vi.fn();
    render(<SignupForm slug="s" onDone={onDone} />);
    await userEvent.type(screen.getByLabelText('遊戲ID'), '無名');
    await userEvent.click(screen.getByRole('button', { name: '報名參賽' }));
    expect(onDone).toHaveBeenCalledWith('李璃');
  });

  it('沒有無障礙違規', async () => {
    const { container } = render(<SignupForm slug="s" onDone={vi.fn()} />);
    await screen.findByRole('button', { name: /飛花/ });
    await expectNoAxeViolations(container);
  });
});

describe('PlayerLogin', () => {
  beforeEach(() => {
    api.login.mockReset();
    push.mockReset();
    api.login.mockResolvedValue({});
  });

  // 沒有通行碼欄位:送出去的東西裡不該有它,畫面上也不該有。
  it('只送遊戲ID,沒有通行碼', async () => {
    render(<PlayerLogin slug="s" />);
    expect(screen.queryByLabelText(/通行碼/)).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('遊戲ID'), '李璃');
    await userEvent.click(screen.getByRole('button', { name: '進站' }));
    expect(api.login).toHaveBeenCalledWith({ tournamentSlug: 's', gameId: '李璃' });
    expect(push).toHaveBeenCalledWith('/t/s');
  });

  it('空的遊戲ID 不送出', async () => {
    render(<PlayerLogin slug="s" />);
    await userEvent.click(screen.getByRole('button', { name: '進站' }));
    expect(api.login).not.toHaveBeenCalled();
  });
});
