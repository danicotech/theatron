import catalog from '../../../public/loadout/data/catalog.json';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { expectNoAxeViolations } from '@theatron/ui/testing';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PlayerStatus,
  Rank,
  RankInfoSchema,
  TournamentPhase,
} from '../../lib/api/gen/hestia/activity/v1/common_pb';

import { MyPlayer } from './MyPlayer';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const api = vi.hoisted(() => ({
  getMyPlayer: vi.fn(),
  listRanks: vi.fn(),
  updateRegistration: vi.fn(),
}));

vi.mock('../../lib/api/activity', () => ({
  activityApi: {
    signup: { getMyPlayer: api.getMyPlayer, updateRegistration: api.updateRegistration },
    tournament: { listRanks: api.listRanks },
  },
}));

const RANKS = [
  create(RankInfoSchema, { rank: Rank.KAISHAN, name: '開山', title: '初試之境' }),
  create(RankInfoSchema, { rank: Rank.FEIHUA, name: '飛花', title: '純熟之境' }),
];

function ok(over: Record<string, unknown> = {}, phase = TournamentPhase.SIGNUP) {
  return {
    registration: {
      displayName: '李璃',
      discordName: 'liLi_discord',
      selfRatedRank: Rank.FEIHUA,
      ladderRank: '玄鐵',
      ladderScore: 1820,
      artsNote: '常用太玄經',
      availabilityNote: '',
    },
    player: {
      displayName: '李璃',
      gameId: 'liLi',
      userPublicId: 'member-1',
      rank: Rank.UNSPECIFIED,
      status: PlayerStatus.ACTIVE,
      seedNo: 0,
      ...over,
    },
    tournament: { slug: 's', name: '百業試鋒 2026', phase },
  };
}

describe('MyPlayer', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(catalog) }),
    );
    api.getMyPlayer.mockReset();
    api.listRanks.mockReset();
    api.updateRegistration.mockReset();
    api.updateRegistration.mockResolvedValue({});
    api.listRanks.mockResolvedValue({ ranks: RANKS, bpPerRankGap: 8n });
  });

  // 使用者實際回報的問題:進站成功與沒進站在畫面上長得一樣。
  it('說得出我是誰', async () => {
    api.getMyPlayer.mockResolvedValue(ok());
    render(<MyPlayer slug="s" />);
    expect(await screen.findByRole('heading', { name: '李璃' })).toBeInTheDocument();
    expect(screen.getByText('liLi')).toBeInTheDocument();
    expect(screen.getByText('參賽中')).toBeInTheDocument();
  });

  it('還沒評段時段位是未評定,不是空白', async () => {
    api.getMyPlayer.mockResolvedValue(ok());
    render(<MyPlayer slug="s" />);
    expect(await screen.findByRole('img', { name: '未評定段位' })).toBeInTheDocument();
  });

  it('評完段位就顯示段位', async () => {
    api.getMyPlayer.mockResolvedValue(ok({ rank: Rank.FEIHUA }));
    render(<MyPlayer slug="s" />);
    expect(await screen.findByRole('img', { name: /飛花/ })).toBeInTheDocument();
  });

  it('沒抽籤就不顯示籤位欄位', async () => {
    api.getMyPlayer.mockResolvedValue(ok());
    render(<MyPlayer slug="s" />);
    await screen.findByRole('heading', { name: '李璃' });
    expect(screen.queryByText('籤位')).not.toBeInTheDocument();
  });

  // 沒進站不是錯誤畫面,是還沒做那一步 —— 給路,不要道歉。
  it('沒進站時給進站與報名兩條路', async () => {
    api.getMyPlayer.mockRejectedValue(new ConnectError('未認證', Code.Unauthenticated));
    render(<MyPlayer slug="s" />);
    expect(await screen.findByRole('link', { name: '登入會員' })).toHaveAttribute(
      'href',
      '/t/s/login',
    );
    expect(screen.getByRole('link', { name: '還沒報名' })).toHaveAttribute('href', '/t/s/signup');
  });

  it('每個狀態都說得出現在在等什麼', async () => {
    api.getMyPlayer.mockResolvedValue(ok({ status: PlayerStatus.WITHDRAWN }));
    render(<MyPlayer slug="s" />);
    expect(await screen.findByText(/已經棄賽/)).toBeInTheDocument();
  });

  it('看得到自己填了什麼,沒填的欄位寫「未填」而不是空白', async () => {
    api.getMyPlayer.mockResolvedValue(ok());
    render(<MyPlayer slug="s" />);
    expect(await screen.findByText('liLi_discord')).toBeInTheDocument();
    expect(screen.getByText('玄鐵')).toBeInTheDocument();
    expect(screen.getByText('常用太玄經')).toBeInTheDocument();
    expect(screen.getAllByText('未填').length).toBeGreaterThan(0);
  });

  it('報名期可以改,送出的是整份資料', async () => {
    api.getMyPlayer.mockResolvedValue(ok());
    render(<MyPlayer slug="s" />);
    await userEvent.click(await screen.findByRole('button', { name: '修改' }));

    await userEvent.selectOptions(screen.getByLabelText('論劍段位'), '飛花');
    await userEvent.click(screen.getByRole('button', { name: '儲存' }));

    expect(api.updateRegistration).toHaveBeenCalledTimes(1);
    const sent = api.updateRegistration.mock.calls[0]?.[0] as {
      registration: Record<string, unknown>;
    };
    expect(sent.registration).toMatchObject({
      discordName: 'liLi_discord',
      ladderRank: '飛花',
      ladderScore: 1820,
      artsNote: '常用太玄經',
    });
  });

  // 表單帶入既有的值,不是叫人重打一次。
  it('修改表單預先填好目前的內容', async () => {
    api.getMyPlayer.mockResolvedValue(ok());
    render(<MyPlayer slug="s" />);
    await userEvent.click(await screen.findByRole('button', { name: '修改' }));
    expect(screen.getByLabelText('論劍段位')).toHaveValue('玄鐵');
    expect(screen.getByLabelText('常用武學')).toHaveValue('常用太玄經');
    expect(screen.queryByLabelText('論劍積分')).not.toBeInTheDocument();
  });

  it('取消不送出任何東西', async () => {
    api.getMyPlayer.mockResolvedValue(ok());
    render(<MyPlayer slug="s" />);
    await userEvent.click(await screen.findByRole('button', { name: '修改' }));
    await userEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(api.updateRegistration).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '修改' })).toBeInTheDocument();
  });

  // 報名截止之後那些內容就是評段的依據,不該再動。
  it('報名期以外沒有修改按鈕,並說明為什麼', async () => {
    api.getMyPlayer.mockResolvedValue(ok({}, TournamentPhase.RANKING));
    render(<MyPlayer slug="s" />);
    await screen.findByRole('heading', { name: '李璃' });
    expect(screen.queryByRole('button', { name: '修改' })).not.toBeInTheDocument();
    expect(screen.getByText(/報名已截止，參賽資料已鎖定/)).toBeInTheDocument();
  });

  it('儲存失敗時顯示伺服器給的理由,而且留在編輯畫面', async () => {
    const { Code: C, ConnectError: CE } = await import('@connectrpc/connect');
    api.getMyPlayer.mockResolvedValue(ok());
    api.updateRegistration.mockRejectedValue(
      new CE('目前賽事階段不允許這個操作', C.FailedPrecondition),
    );
    render(<MyPlayer slug="s" />);
    await userEvent.click(await screen.findByRole('button', { name: '修改' }));
    await userEvent.click(screen.getByRole('button', { name: '儲存' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('目前賽事階段不允許這個操作');
    expect(screen.getByRole('button', { name: '儲存' })).toBeInTheDocument();
  });

  it('沒有無障礙違規', async () => {
    api.getMyPlayer.mockResolvedValue(ok({ rank: Rank.FEIHUA, seedNo: 3 }));
    const { container } = render(<MyPlayer slug="s" />);
    await screen.findByRole('heading', { name: '李璃' });
    await expectNoAxeViolations(container);
  });
});

vi.mock('../realtime/useTournamentRealtime', () => ({
  useTournamentRealtime: () => ({ status: 'ready', revision: 0, ranks: [] }),
}));

// 個人資料及角色配置共用全量更新 API，分頁編輯不可清掉另一頁的資料。
it('修改我的報名保留已保存的四項角色配置', async () => {
  const original = ok();
  const character = { style: '鳴金', weapon: '劍', equipment: '明川', arts: '太玄' };
  api.getMyPlayer.mockResolvedValue({
    ...original,
    registration: { ...original.registration, character },
  });
  api.listRanks.mockResolvedValue({ ranks: RANKS });
  api.updateRegistration.mockResolvedValue({});
  render(<MyPlayer slug="s" view="registration" />);
  await userEvent.click(await screen.findByRole('button', { name: '修改' }));
  expect(screen.queryByLabelText('流派')).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('論劍段位'), '飛花');
  await userEvent.click(screen.getByRole('button', { name: '儲存' }));
  const sent = api.updateRegistration.mock.lastCall?.[0] as {
    registration: Record<string, unknown>;
  };
  expect(sent.registration).toMatchObject({
    discordName: 'liLi_discord',
    ladderRank: '飛花',
    character,
  });
});
it('修改角色配置保留個人報名資料', async () => {
  const original = ok();
  localStorage.setItem(
    'lunjian.loadout.v3',
    JSON.stringify({
      v: 3,
      roles: [{ id: 1, name: '已保存方案', data: { build: catalog.builds[0]!.key } }],
    }),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(catalog) }),
  );
  api.getMyPlayer.mockResolvedValue(original);
  api.listRanks.mockResolvedValue({ ranks: RANKS });
  api.updateRegistration.mockResolvedValue({});
  render(<MyPlayer slug="s" view="character" />);
  await screen.findByRole('link', { name: '編輯個人武庫 ↗' });
  expect(screen.queryByLabelText('Discord 名稱')).not.toBeInTheDocument();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(catalog) }),
  );
  await screen.findByRole('combobox', { name: '武庫方案' });
  await userEvent.click(screen.getByRole('button', { name: '確認更新參賽配置' }));

  const sent = api.updateRegistration.mock.lastCall?.[0] as {
    registration: Record<string, unknown>;
  };
  expect(sent.registration).toMatchObject({
    discordName: 'liLi_discord',
    displayName: '李璃',
    character: { style: '裂石鈞' },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

it.each([
  TournamentPhase.SIGNUP,
  TournamentPhase.SIGNUP_CLOSED,
  TournamentPhase.RANKING,
  TournamentPhase.RANKED,
  TournamentPhase.DRAWING,
])('allows changing the competition loadout before start: %s', async (phase) => {
  const original = ok({}, phase);
  Object.assign(original.registration, {
    character: { style: '原參賽流派', weapon: '原武器', equipment: '', arts: '' },
  });
  localStorage.setItem(
    'lunjian.loadout.v3',
    JSON.stringify({
      v: 3,
      roles: [{ id: 2, name: '重新選擇方案', data: { build: catalog.builds[0]!.key } }],
    }),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(catalog) }),
  );
  api.updateRegistration.mockReset().mockResolvedValue({});
  api.getMyPlayer.mockResolvedValue(original);
  api.listRanks.mockResolvedValue({ ranks: RANKS });
  render(<MyPlayer slug="s" view="character" />);
  await screen.findByRole('link', { name: '編輯個人武庫 ↗' });
  expect(screen.queryByText('本屆參賽配置已鎖定')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '編輯個人武庫 ↗' })).toBeInTheDocument();
  expect(screen.getByText('開賽前 · 可更換參賽配置')).toBeInTheDocument();
  await userEvent.selectOptions(
    await screen.findByRole('combobox', { name: '武庫方案' }),
    'library:2',
  );
  expect(screen.getByRole('heading', { name: '待確認配置' })).toBeInTheDocument();
  expect(api.updateRegistration).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: '確認更新參賽配置' }));
  expect(api.updateRegistration).toHaveBeenCalledTimes(1);
  const sent = api.updateRegistration.mock.lastCall?.[0] as {
    registration: { character: { snapshotJson: string } };
  };
  expect(sent.registration.character).toMatchObject({
    style: '裂石鈞',
  });
  expect(sent.registration.character.snapshotJson).toContain('"version":1');
});
it.each([TournamentPhase.IN_PROGRESS, TournamentPhase.FINISHED])(
  'locks only the competition snapshot after start: %s',
  async (phase) => {
    api.getMyPlayer.mockResolvedValue(ok({}, phase));
    api.listRanks.mockResolvedValue({ ranks: RANKS });
    render(<MyPlayer slug="s" view="character" />);
    expect(await screen.findByRole('link', { name: '編輯個人武庫 ↗' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '修改' })).not.toBeInTheDocument();
    expect(screen.getByText(/本屆參賽配置已鎖定/)).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '武庫方案' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '確認更新參賽配置' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '個人武庫說明' })).toBeInTheDocument();
  },
);
