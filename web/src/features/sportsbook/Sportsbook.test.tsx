import { readFileSync } from 'node:fs';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { expectNoAxeViolations } from '@theatron/ui/testing';
import { apply, buildEvent, defaultSnapshot, initialState, marketOdds } from './engine';
import type { Command, State } from './model';
import { Sportsbook } from './Sportsbook';
import * as db from './database';
vi.mock('./database', () => ({
  readState: vi.fn(),
  execute: vi.fn(),
  session: vi.fn(),
  saveSession: vi.fn(),
  subscribe: vi.fn(() => () => {}),
  register: vi.fn(),
  loginLocal: vi.fn(),
  discordLocal: vi.fn(),
}));
const roleCatalog = JSON.parse(readFileSync('web/public/loadout/data/catalog.json', 'utf8')) as {
  builds: { key: string }[];
};
let state: State;
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(roleCatalog) }),
  );
  history.replaceState(null, '', '/sportsbook');
  state = initialState();
  buildEvent(state, defaultSnapshot(4), '試玩一');
  apply(
    state,
    {
      type: 'register',
      member: {
        id: 'u',
        login: 'user',
        name: '測試會員',
        salt: 's',
        hash: 'h',
        discord: '',
        balance: '0',
      },
    },
    'reg',
  );
  vi.mocked(db.readState).mockImplementation(() => Promise.resolve(structuredClone(state)));
  vi.mocked(db.session).mockReturnValue('u');
  vi.mocked(db.execute).mockImplementation((c: Command, key = 'op-' + crypto.randomUUID()) => {
    try {
      const next = structuredClone(state),
        result = apply(next, c, key);
      state = next;
      return Promise.resolve(result);
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error('交易失敗'));
    }
  });
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    },
    close: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.removeAttribute('open');
      },
    },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
function openSlipSettings() {
  fireEvent.click(screen.getByRole('button', { name: /查看我的選擇/ }));
  const dialog = within(screen.getByRole('dialog', { name: '我的選擇' }));
  fireEvent.click(dialog.getByText('進階設定（選填）'));
  return dialog;
}
function closeSlipSettings() {
  fireEvent.click(screen.getByRole('button', { name: /完成，回去填點數|返回挑選結果/ }));
}

it('切換頁籤收合手機注單但保留草稿，下注後回選盤不留下遮擋', async () => {
  render(<Sportsbook initialEventId={state.events[0]!.id} />);
  const heading = await screen.findByRole('heading', { name: '整場勝負' });
  fireEvent.click(within(heading.closest('section')!).getAllByRole('button', { name: /選擇/ })[0]!);
  fireEvent.click(screen.getByRole('button', { name: /查看注單 ↑/ }));
  fireEvent.change(screen.getByLabelText('每筆本金（點）'), { target: { value: '100' } });
  expect(screen.getByRole('complementary', { name: '我的注單' })).toHaveAttribute(
    'data-open',
    'true',
  );
  fireEvent.change(screen.getByRole('combobox', { name: '投注類型' }), {
    target: { value: 'place' },
  });
  expect(screen.getByRole('complementary', { name: '我的注單' })).toHaveAttribute(
    'data-open',
    'false',
  );
  expect(screen.getByLabelText('每筆本金（點）')).toHaveValue('100');
  expect(screen.getByRole('button', { name: /查看我的選擇/ })).toHaveTextContent('1');
  fireEvent.click(screen.getByRole('button', { name: /查看注單 ↑/ }));
  fireEvent.click(screen.getByRole('button', { name: '檢查注單' }));
  fireEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: '確認扣點下注' }),
  );
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '投注區' }));
  fireEvent.change(screen.getByRole('combobox', { name: '投注類型' }), {
    target: { value: 'place' },
  });
  expect(screen.getByRole('complementary', { name: '我的注單' })).toHaveAttribute(
    'data-open',
    'false',
  );
  expect(screen.queryByLabelText('每筆本金（點）')).toBeNull();
});
describe('運彩中心實際操作', () => {
  it('盤口設定錯誤聚焦在視窗內，修改輸入清除提示後可重新儲存', async () => {
    history.replaceState(null, '', '/sportsbook?mode=manage');
    render(<Sportsbook embedded initialEventId={state.events[0]!.id} />);
    await screen.findByRole('heading', { name: '整場勝負' });
    fireEvent.click(screen.getByRole('button', { name: '管理模式' }));
    fireEvent.click(screen.getByText('盤口與賠率設定', { exact: true }));
    fireEvent.click(screen.getAllByRole('button', { name: '設定／作廢' })[0]!);
    const dialog = within(screen.getByRole('dialog', { name: '設定 整場勝負' }));
    fireEvent.input(dialog.getAllByLabelText('固定賠率')[0]!, { target: { value: 'abc' } });
    fireEvent.click(dialog.getByRole('button', { name: '儲存設定' }));
    await waitFor(() => expect(dialog.getByRole('alert')).toHaveFocus());
    expect(dialog.getByRole('alert')).toHaveTextContent('最多三位小數');
    fireEvent.input(dialog.getAllByLabelText('固定賠率')[0]!, { target: { value: '2.50' } });
    expect(dialog.queryByRole('alert')).toBeNull();
    fireEvent.click(dialog.getByRole('button', { name: '儲存設定' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(state.markets.find((m) => m.kind === 'winner')!.options[0]!.fixed).toBe('2500');
  });
  it('時間盤已有注單時直接鎖定門檻，賠率仍可調整', async () => {
    const event = state.events[0]!;
    const time = state.markets.find((m) => m.kind === 'total')!;
    const outcome = time.options[0]!.id;
    apply(
      state,
      {
        type: 'bet',
        userId: 'u',
        eventId: event.id,
        stake: '100',
        legs: [{ marketId: time.id, outcome, odds: marketOdds(time)[outcome]!, label: '時間' }],
      },
      'lock-line',
    );
    history.replaceState(null, '', '/sportsbook?mode=manage');
    render(<Sportsbook embedded initialEventId={event.id} />);
    await screen.findByRole('heading', { name: '整場勝負' });
    fireEvent.click(screen.getByRole('button', { name: '管理模式' }));
    fireEvent.click(screen.getByText('盤口與賠率設定', { exact: true }));
    const row = screen.getByText(/^整場總時間 · 可下注/).parentElement!;
    fireEvent.click(within(row).getByRole('button', { name: '設定／作廢' }));
    const dialog = within(screen.getByRole('dialog', { name: '設定 整場總時間' }));
    expect(dialog.getByLabelText('秒數門檻（時間盤）')).toHaveAttribute('readonly');
    expect(dialog.getByText(/此盤已有注單，秒數門檻已鎖定/)).toBeInTheDocument();
    expect(dialog.getAllByLabelText('固定賠率')[0]).not.toHaveAttribute('readonly');
  });
  it('會員後續被對應到選手時，既有注單草稿也在確認前擋下', async () => {
    const event = state.events[0]!;
    const first = render(<Sportsbook initialEventId={event.id} />);
    const heading = await screen.findByRole('heading', { name: '整場勝負' });
    fireEvent.click(
      within(heading.closest('section')!).getAllByRole('button', { name: /選擇/ })[0]!,
    );
    fireEvent.change(screen.getByLabelText(/每[筆組]本金（點）/), { target: { value: '100' } });
    first.unmount();
    event.links.u = event.matches[0]!.p1;
    render(<Sportsbook initialEventId={event.id} />);
    await screen.findByRole('heading', { name: '整場勝負' });
    await waitFor(() => expect(screen.getByLabelText(/每[筆組]本金（點）/)).toHaveValue('100'));
    fireEvent.click(screen.getByRole('button', { name: '檢查注單' }));
    const slip = within(screen.getByRole('complementary', { name: '我的注單' }));
    expect(slip.getByRole('alert')).toHaveTextContent('不能投注自己參與的場次');
    await waitFor(() => expect(slip.getByRole('alert')).toHaveFocus());
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(state.bets).toHaveLength(0);
    expect(state.members[0]!.balance).toBe('1000');
  });
  it('參賽者選盤時即顯示限制，自己的對局及名次不可加入，其他場次可下注', async () => {
    const event = state.events[0]!;
    event.links.u = event.matches[0]!.p1;
    render(<Sportsbook initialEventId={event.id} />);
    const heading = await screen.findByRole('heading', { name: '整場勝負' });
    let market = within(heading.closest('section')!);
    expect(market.getByText('不能投注自己參與的場次。可切換其他場次觀局。')).toBeInTheDocument();
    expect(market.getByText(/僅供觀局/)).toBeInTheDocument();
    expect(
      market.getAllByRole('button', { name: /選擇/ }).every((b) => b.hasAttribute('disabled')),
    ).toBe(true);
    expect(market.getAllByRole('button', { name: '投票' })[0]).toBeEnabled();
    fireEvent.change(screen.getByLabelText('選擇場次'), { target: { value: 'm1-1' } });
    market = within(screen.getByRole('heading', { name: '整場勝負' }).closest('section')!);
    expect(market.getAllByRole('button', { name: /選擇/ })[0]).toBeEnabled();
    fireEvent.change(screen.getByRole('combobox', { name: '投注類型' }), {
      target: { value: 'place' },
    });
    const place = within(screen.getByRole('heading', { name: '冠軍' }).closest('section')!);
    expect(place.getByText('參賽者不能投注本屆名次盤。')).toBeInTheDocument();
    expect(
      place.getAllByRole('button', { name: /選擇/ }).every((b) => b.hasAttribute('disabled')),
    ).toBe(true);
    expect(state.members[0]!.balance).toBe('1000');
    expect(state.bets).toHaveLength(0);
  });
  it('加入單注→二次確認→扣點→顯示我的注單', async () => {
    render(<Sportsbook initialEventId={state.events[0]!.id} />);
    const h = await screen.findByRole('heading', { name: '整場勝負' }),
      market = within(h.closest('section')!);
    fireEvent.click(market.getAllByRole('button', { name: /選擇/ })[0]!);
    fireEvent.change(screen.getByLabelText(/每[筆組]本金（點）/), { target: { value: '100' } });
    screen.getByRole('button', { name: '檢查注單' }).focus();
    fireEvent.click(screen.getByRole('button', { name: '檢查注單' }));
    const dialog = screen.getByRole('alertdialog', { name: '確認本機下注' });
    expect(dialog).toHaveTextContent('總賠率 1.900');
    expect(state.bets).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: '確認扣點下注' }));
    await waitFor(() => expect(state.bets).toHaveLength(1));
    expect(state.members[0]!.balance).toBe('900');
    expect(await screen.findByText('待結算')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
  });
  it('未填本金即可看跨場賠率相乘，同場換玩法替換原選擇', async () => {
    render(<Sportsbook initialEventId={state.events[0]!.id} />);
    const first = await screen.findByRole('heading', { name: '整場勝負' });
    fireEvent.change(screen.getByLabelText('投注方式'), { target: { value: 'parlay' } });
    fireEvent.click(within(first.closest('section')!).getAllByRole('button', { name: /選擇/ })[0]!);
    fireEvent.change(screen.getByLabelText('選擇場次'), { target: { value: 'm1-1' } });
    const second = within(screen.getByRole('heading', { name: '整場勝負' }).closest('section')!);
    fireEvent.click(second.getAllByRole('button', { name: /選擇/ })[0]!);
    expect(screen.getByLabelText(/每[筆組]本金（點）/)).toHaveValue('');
    expect(screen.getByRole('region', { name: '注單賠率' })).toHaveTextContent('3.610 倍');
    const score = within(screen.getByRole('heading', { name: 'BO3 比分' }).closest('section')!);
    fireEvent.click(score.getAllByRole('button', { name: /選擇/ })[0]!);
    expect(screen.getByRole('region', { name: '注單賠率' })).toHaveTextContent('7.220 倍');
    openSlipSettings();
    expect(screen.getByLabelText('賠率算式')).toHaveTextContent('1.900 × 3.800 = 7.220 倍');
    expect(screen.getAllByRole('button', { name: /^移除 / })).toHaveLength(2);
    fireEvent.click(screen.getByRole('checkbox', { name: '1 場一組' }));
    expect(screen.getByRole('region', { name: '注單賠率' })).toHaveTextContent(
      '3 組，分別計算賠率',
    );
    expect(screen.getByText('查看 3 個組合的賠率')).toBeInTheDocument();
    closeSlipSettings();
    expect(state.bets).toHaveLength(0);
  });
  it('名次改選取代原注單，登出不保留上一位會員的投注草稿', async () => {
    render(<Sportsbook initialEventId={state.events[0]!.id} />);
    await screen.findByRole('heading', { name: '整場勝負' });
    fireEvent.change(screen.getByRole('combobox', { name: '投注類型' }), {
      target: { value: 'place' },
    });
    const h = screen.getByRole('heading', { name: '冠軍' });
    fireEvent.click(within(h.closest('section')!).getAllByRole('button', { name: /選擇/ })[0]!);
    fireEvent.change(screen.getByLabelText(/每[筆組]本金（點）/), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: '登出' }));
    await waitFor(() => expect(screen.queryByLabelText(/每[筆組]本金（點）/)).toBeNull());
    expect(screen.queryByRole('button', { name: /移除 冠軍/ })).toBeNull();
  });
  it('儲存失敗顯示錯誤，不宣稱兌換成功', async () => {
    render(<Sportsbook initialEventId={state.events[0]!.id} />);
    await screen.findByRole('heading', { name: '整場勝負' });
    fireEvent.click(screen.getByRole('button', { name: '獎品兌換' }));
    fireEvent.click(screen.getAllByRole('button', { name: '申請兌換' })[0]!);
    vi.mocked(db.execute).mockRejectedValueOnce(new Error('本機儲存失敗；本次操作未成立。'));
    fireEvent.click(
      within(screen.getByRole('alertdialog', { name: '確認示範兌換' })).getByRole('button', {
        name: '確認扣點兌換',
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole('alertdialog')).toHaveTextContent('本次操作未成立'),
    );
    expect(state.redemptions).toHaveLength(0);
    expect(state.members[0]!.balance).toBe('1000');
  });
  it('確認期间其他分頁改票，更新報價並要求重新確認，不提前扣點', async () => {
    state.markets.forEach((m) => {
      m.mode = 'popular';
    });
    render(<Sportsbook initialEventId={state.events[0]!.id} />);
    const h = await screen.findByRole('heading', { name: '整場勝負' });
    fireEvent.click(within(h.closest('section')!).getAllByRole('button', { name: /選擇/ })[0]!);
    fireEvent.change(screen.getByLabelText(/每[筆組]本金（點）/), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: '檢查注單' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('1.900');
    const m = state.markets.find((m) => m.kind === 'winner')!;
    apply(state, { type: 'vote', userId: 'u', marketId: m.id, outcome: 'p1' }, 'external-vote');
    fireEvent.focus(window);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    const slip = within(screen.getByRole('complementary', { name: '我的注單' }));
    expect(slip.getByRole('alert')).toHaveTextContent('盤口或賠率已更新');
    await waitFor(() => expect(slip.getByRole('alert')).toHaveFocus());
    expect(state.bets).toHaveLength(0);
    expect(state.members[0]!.balance).toBe('1000');
    fireEvent.click(screen.getByRole('button', { name: '檢查注單' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('1.854');
  });
  it('會員每盤一票且跨盤並存，不再提供匿名入口', async () => {
    render(<Sportsbook initialEventId={state.events[0]!.id} />);
    await screen.findByRole('heading', { name: '整場勝負' });
    expect(screen.queryByRole('button', { name: '匿名試玩' })).toBeNull();
    const winner = within(screen.getByRole('heading', { name: '整場勝負' }).closest('section')!);
    fireEvent.click(winner.getAllByRole('button', { name: '投票' })[0]!);
    await waitFor(() =>
      expect(winner.getByRole('button', { name: '已投' })).toHaveAttribute('aria-pressed', 'true'),
    );
    const score = within(screen.getByRole('heading', { name: 'BO3 比分' }).closest('section')!);
    fireEvent.click(score.getAllByRole('button', { name: '投票' })[1]!);
    await waitFor(() =>
      expect(score.getByRole('button', { name: '已投' })).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(winner.getByRole('button', { name: '已投' })).toBeInTheDocument();
    expect(state.members.find((m) => m.id === 'u')!.balance).toBe('1000');
  });
  it('同場勝負、比分與時間各自投注，一次確認建立三張獨立單注', async () => {
    render(<Sportsbook initialEventId={state.events[0]!.id} />);
    await screen.findByRole('heading', { name: '整場勝負' });
    expect(screen.getByLabelText('投注方式')).toHaveValue('singles');
    for (const name of ['整場勝負', 'BO3 比分', /整場總時間/]) {
      const heading = screen.getByRole('heading', { name });
      fireEvent.click(
        within(heading.closest('section')!).getAllByRole('button', { name: /選擇/ })[0]!,
      );
    }
    expect(screen.getByRole('button', { name: '查看我的選擇（3）' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '注單賠率' })).toHaveTextContent(
      '3 筆單注，各自結算',
    );
    fireEvent.change(screen.getByLabelText('每筆本金（點）'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: '檢查注單' }));
    const dialog = screen.getByRole('alertdialog', { name: '確認本機下注' });
    expect(dialog).toHaveTextContent('總本金 300');
    expect(state.bets).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: '確認扣點下注' }));
    await waitFor(() => expect(state.bets).toHaveLength(3));
    expect(state.bets.every((b) => b.legs.length === 1 && b.stake === '100')).toBe(true);
    expect(state.members[0]!.balance).toBe('700');
  });
  it('包牌選項展開兩組，顯示總本金後只扣一次並保存各組', async () => {
    render(<Sportsbook initialEventId={state.events[0]!.id} />);
    await screen.findByRole('heading', { name: '整場勝負' });
    fireEvent.change(screen.getByLabelText('投注方式'), { target: { value: 'parlay' } });
    openSlipSettings();
    fireEvent.click(screen.getByRole('checkbox', { name: /包牌/ }));
    closeSlipSettings();
    const first = within(screen.getByRole('heading', { name: '整場勝負' }).closest('section')!);
    fireEvent.click(first.getAllByRole('button', { name: /選擇/ })[0]!);
    fireEvent.click(first.getAllByRole('button', { name: /選擇/ })[1]!);
    fireEvent.change(screen.getByLabelText('選擇場次'), { target: { value: 'm1-1' } });
    const second = within(screen.getByRole('heading', { name: '整場勝負' }).closest('section')!);
    fireEvent.click(second.getAllByRole('button', { name: /選擇/ })[0]!);
    expect(screen.getByRole('region', { name: '注單賠率' })).toHaveTextContent(
      '2 組，分別計算賠率',
    );
    openSlipSettings();
    expect(screen.getByText('查看 2 個組合的賠率')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '2 場一組' })).toBeChecked();
    closeSlipSettings();
    fireEvent.change(screen.getByLabelText(/每[筆組]本金（點）/), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: '檢查注單' }));
    const dialog = screen.getByRole('alertdialog', { name: '確認本機下注' });
    expect(dialog).toHaveTextContent('2 組，總本金 100');
    expect(dialog).toHaveTextContent('最高返還 181');
    expect(state.bets).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: '確認扣點下注' }));
    await waitFor(() => expect(state.bets).toHaveLength(1));
    expect(state.bets[0]!.combinations).toHaveLength(2);
    expect(state.members[0]!.balance).toBe('900');
  });
  it('選盤不自動展開底部面板，完整清單按需開啟，關閉後還原焦點', async () => {
    render(<Sportsbook initialEventId={state.events[0]!.id} />);
    const h = await screen.findByRole('heading', { name: '整場勝負' });
    fireEvent.click(within(h.closest('section')!).getAllByRole('button', { name: /選擇/ })[0]!);
    expect(screen.getByRole('complementary', { name: '我的注單' })).toHaveAttribute(
      'data-open',
      'false',
    );
    expect(screen.queryByRole('button', { name: /^移除 / })).toBeNull();
    const trigger = screen.getByRole('button', { name: '查看我的選擇（1）' });
    trigger.focus();
    const editor = openSlipSettings();
    expect(editor.getByRole('button', { name: /^移除 / })).toBeInTheDocument();
    closeSlipSettings();
    expect(trigger).toHaveFocus();
    fireEvent.change(screen.getByLabelText('每筆本金（點）'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: '檢查注單' }));
    expect(screen.getByLabelText('待確認選項')).toHaveTextContent('整場勝負');
    expect(state.bets).toHaveLength(0);
  });
  it('注單過高時取消固定，縮回視窗內才固定並清除尺寸監聽', async () => {
    let panelHeight = 1200;
    let notify: () => void = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notify = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () => ({ height: panelHeight }) as DOMRect,
    );
    const rendered = render(<Sportsbook initialEventId={state.events[0]!.id} />);
    const panel = await screen.findByRole('complementary', { name: '我的注單' });
    await waitFor(() => expect(panel).toHaveAttribute('data-fits', 'false'));
    panelHeight = 320;
    act(() => notify());
    expect(panel).toHaveAttribute('data-fits', 'true');
    panelHeight = 1200;
    fireEvent.resize(window);
    expect(panel).toHaveAttribute('data-fits', 'false');
    rendered.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});

it('檢視與管理分開：會員依說明、報名、角色與確認完成報名', async () => {
  const id = apply(
    state,
    { type: 'activity-create', name: '報名測試', capacity: 4 },
    'create-enrollment',
  );
  history.replaceState(null, '', '/sportsbook?mode=manage');
  render(<Sportsbook embedded initialEventId={id} />);
  await screen.findByRole('heading', { name: '對局預覽' });
  expect(screen.queryByRole('button', { name: '建立活動' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '我的參賽' }));
  await expectNoAxeViolations(screen.getByRole('region', { name: '百業試鋒報名表' }));
  fireEvent.click(screen.getByLabelText('我已閱讀並了解賽制與讓武原則'));
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  expect(screen.getByLabelText('遊戲 ID')).toHaveFocus();
  expect(screen.getByLabelText('遊戲 ID')).toHaveAttribute('aria-invalid', 'true');
  await expectNoAxeViolations(screen.getByRole('region', { name: '百業試鋒報名表' }));
  fireEvent.change(screen.getByLabelText('遊戲 ID'), { target: { value: 'hero123' } });
  fireEvent.change(screen.getByLabelText('角色姓名'), { target: { value: '江上客' } });
  fireEvent.change(screen.getByLabelText('對戰經驗'), { target: { value: '剛開始接觸論劍' } });
  fireEvent.change(screen.getByLabelText('可參賽時段'), { target: { value: '週末晚上' } });
  fireEvent.change(screen.getByLabelText('Discord 名稱'), { target: { value: 'private-contact' } });
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  await expectNoAxeViolations(screen.getByRole('region', { name: '百業試鋒報名表' }));
  localStorage.setItem(
    'lunjian.loadout.v3',
    JSON.stringify({
      v: 3,
      roles: [{ id: 1, name: '江上客', data: { v: 3, build: roleCatalog.builds[0]!.key } }],
    }),
  );
  fireEvent(window, new Event('storage'));
  fireEvent.click(await screen.findByRole('button', { name: /江上客.*套用角色/ }));
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  await expectNoAxeViolations(screen.getByRole('region', { name: '百業試鋒報名表' }));
  expect(state.events.find((e) => e.id === id)!.registration!.entries).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: '確認完成報名' }));
  await screen.findByText('本機報名已完成');
  // Receipt insertion precedes its focus effect; assert the eventual focus,
  // including when parallel browser/build checks slow the test worker.
  await waitFor(() => expect(screen.getByRole('heading', { name: '江上客' })).toHaveFocus());
  const entry = state.events.find((e) => e.id === id)!.registration!.entries[0]!;
  expect(entry).toMatchObject({
    userId: 'u',
    gameId: 'hero123',
    name: '江上客',
    status: 'confirmed',
    profile: { experience: '剛開始接觸論劍', availability: '週末晚上', discord: 'private-contact' },
  });
  fireEvent.click(screen.getByRole('button', { name: '修改報名資料與角色' }));
  expect(screen.getByLabelText('可參賽時段')).toHaveValue('週末晚上');
  fireEvent.change(screen.getByLabelText('可參賽時段'), { target: { value: '週六晚上' } });
  fireEvent.click(screen.getByRole('button', { name: '儲存修改' }));
  await screen.findByText('本機報名已完成');
  expect(
    state.events.find((e) => e.id === id)!.registration!.entries[0]!.profile!.availability,
  ).toBe('週六晚上');
  fireEvent.click(screen.getByRole('button', { name: '管理模式' }));
  expect(screen.queryByRole('complementary')).toBeNull();
  expect(screen.getByRole('heading', { name: '活動與報名名單' })).toBeInTheDocument();
  expect(screen.getByLabelText('報名人數上限')).toHaveValue(4);
  expect(screen.getByText('江上客 · 已完成報名')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '檢視模式' }));
  expect(screen.queryByRole('heading', { name: '雅集事務' })).toBeNull();
});

it('返回備戰方案接回同一會員草稿，切換會員不導入別人的文字', async () => {
  const id = apply(
    state,
    { type: 'activity-create', name: '報名測試', capacity: 4 },
    'return-event',
  );
  apply(
    state,
    {
      type: 'enroll',
      eventId: id,
      userId: 'u',
      gameId: 'hero',
      name: '江上客',
      character: { style: '劍', weapon: '劍', equipment: '甲', arts: '原武學' },
      rulesAccepted: true,
      complete: false,
    },
    'save-draft',
  );
  history.replaceState(
    null,
    '',
    `/sportsbook?event=${id}&tab=participation&artsUser=u&arts=${encodeURIComponent('備戰匯入文字')}`,
  );
  const view = render(<Sportsbook />);
  expect(await screen.findByText('備戰匯入文字')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '儲存草稿' }));
  await waitFor(() =>
    expect(state.events.find((e) => e.id === id)!.registration!.entries[0]!.character.arts).toBe(
      '備戰匯入文字',
    ),
  );
  view.unmount();
  vi.mocked(db.session).mockReturnValue('');
  render(<Sportsbook />);
  await screen.findByRole('heading', { name: '赴約參賽' });
  expect(screen.queryByLabelText('武學與配裝說明')).toBeNull();
  expect(screen.getByText('請登入或註冊會員，以便保留你的報名與角色資料。')).toBeInTheDocument();
});

it('管理者關閉報名、確認發布並切換新對局', async () => {
  const id = apply(
    state,
    { type: 'activity-create', name: '排賽測試', capacity: 4 },
    'manage-event',
  );
  apply(
    state,
    {
      type: 'register',
      member: {
        id: 'v',
        login: 'viewer',
        name: '另一位',
        salt: 's',
        hash: 'h',
        discord: '',
        balance: '0',
      },
    },
    'reg-v',
  );
  for (const userId of ['u', 'v'])
    apply(
      state,
      {
        type: 'enroll',
        eventId: id,
        userId,
        gameId: userId,
        name: userId,
        character: { style: '劍', weapon: '劍', equipment: '甲', arts: '太白' },
        rulesAccepted: true,
        complete: true,
      },
      'enroll-' + userId,
    );
  history.replaceState(null, '', '/sportsbook?mode=manage');
  render(<Sportsbook embedded initialEventId={id} />);
  await screen.findByRole('heading', { name: '對局預覽' });
  fireEvent.click(screen.getByRole('button', { name: '管理模式' }));
  expect(screen.getByRole('button', { name: '發布對局（2 人）' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('報名狀態'), { target: { value: 'no' } });
  fireEvent.click(screen.getByRole('button', { name: '儲存活動設定' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '發布對局（2 人）' })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole('button', { name: '發布對局（2 人）' }));
  const confirm = screen.getByRole('alertdialog', { name: '確認發布對局' });
  expect(state.events.find((e) => e.id === id)!.matches).toHaveLength(0);
  fireEvent.click(within(confirm).getByRole('button', { name: '發布對局' }));
  await waitFor(() =>
    expect(state.events.find((e) => e.id === id)!.registration!.published).toBe(true),
  );
  await waitFor(() => expect(screen.getByLabelText('切換管理對局')).toHaveValue('m1-0'));
  expect(screen.getByLabelText('報名人數上限')).toBeDisabled();
  expect(state.events.find((e) => e.id === id)!.links.u).toBeTruthy();
  expect(state.markets.filter((m) => m.eventId === id).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: '檢視模式' }));
  fireEvent.click(screen.getByRole('button', { name: '我的參賽' }));
  const scrollIntoView = vi.fn();
  Object.defineProperty(screen.getByRole('main'), 'scrollIntoView', { value: scrollIntoView });
  fireEvent.click(screen.getByRole('button', { name: '查看我的對局 · 第 1 輪' }));
  await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
  expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' });
  expect(screen.getByLabelText('選擇場次')).toHaveValue('m1-0');
});
it('舊匿名登入退出但保留餘額與帳本，不轉入其他會員', async () => {
  const guest = apply(state, { type: 'guest' }, 'guest-old');
  vi.mocked(db.session).mockReturnValue(guest);
  render(<Sportsbook initialEventId={state.events[0]!.id} />);
  await screen.findByText(/已切回檢視模式/);
  expect(db.saveSession).toHaveBeenCalledWith('');
  expect(state.members.find((m) => m.id === guest)!.balance).toBe('1000');
  expect(screen.queryByRole('button', { name: '匿名試玩' })).toBeNull();
  expect(screen.getByRole('button', { name: '登入／註冊領 1,000 點' })).toBeInTheDocument();
});

it('交易等待中停用確認視窗，Escape 不關閉，失敗後可返回修改', async () => {
  render(<Sportsbook initialEventId={state.events[0]!.id} />);
  const h = await screen.findByRole('heading', { name: '整場勝負' });
  fireEvent.click(within(h.closest('section')!).getAllByRole('button', { name: /選擇/ })[0]!);
  fireEvent.change(screen.getByLabelText(/每[筆組]本金（點）/), { target: { value: '100' } });
  fireEvent.click(screen.getByRole('button', { name: '檢查注單' }));
  let reject!: (e: Error) => void;
  vi.mocked(db.execute).mockImplementationOnce(
    () =>
      new Promise((_, no) => {
        reject = no;
      }),
  );
  const dialog = screen.getByRole('alertdialog', { name: '確認本機下注' });
  await expectNoAxeViolations(dialog);
  fireEvent.click(within(dialog).getByRole('button', { name: '確認扣點下注' }));
  expect(dialog).toHaveAttribute('aria-busy', 'true');
  expect(within(dialog).getByRole('button', { name: '關閉視窗' })).toBeDisabled();
  expect(within(dialog).getByRole('button', { name: '返回修改' })).toBeDisabled();
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(dialog).toHaveAttribute('open');
  expect(db.execute).toHaveBeenCalledTimes(1);
  await act(async () => {
    reject(new Error('儲存失敗，未扣點'));
    await Promise.resolve();
  });
  expect(dialog).not.toHaveAttribute('aria-busy');
  expect(within(dialog).getByRole('alert')).toHaveTextContent('未扣點');
  fireEvent.click(within(dialog).getByRole('button', { name: '返回修改' }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(screen.getByLabelText(/每[筆組]本金（點）/)).toHaveValue('100');
  expect(state.members[0]!.balance).toBe('1000');
});

it('下注檢查錯誤只出現在注單內，不歸到先前投票，修改本金後清除', async () => {
  render(<Sportsbook initialEventId={state.events[0]!.id} />);
  const heading = await screen.findByRole('heading', { name: '整場勝負' });
  const market = within(heading.closest('section')!);
  fireEvent.click(market.getAllByRole('button', { name: '投票' })[0]!);
  await market.findByRole('button', { name: '已投' });
  fireEvent.click(market.getAllByRole('button', { name: /選擇/ })[0]!);
  const slip = within(screen.getByRole('complementary', { name: '我的注單' }));
  fireEvent.change(slip.getByLabelText('每筆本金（點）'), { target: { value: '2000' } });
  fireEvent.click(slip.getByRole('button', { name: '檢查注單' }));
  const error = slip.getByRole('alert');
  expect(error).toHaveTextContent('可用點數不足。');
  expect(error).toHaveFocus();
  expect(screen.getAllByRole('alert')).toEqual([error]);
  expect(market.queryByRole('alert')).toBeNull();
  expect(state.bets).toHaveLength(0);
  fireEvent.change(slip.getByLabelText('每筆本金（點）'), { target: { value: '100' } });
  expect(slip.queryByRole('alert')).toBeNull();
  fireEvent.click(slip.getByRole('button', { name: '檢查注單' }));
  expect(screen.getByRole('alertdialog', { name: '確認本機下注' })).toBeInTheDocument();
});

it('報名草稿儲存失敗時在表單旁說明，原輸入不遺失', async () => {
  const id = apply(
    state,
    { type: 'activity-create', name: '失敗測試', capacity: 4 },
    'failed-enroll',
  );
  render(<Sportsbook initialEventId={id} />);
  await screen.findByRole('heading', { name: '對局預覽' });
  fireEvent.click(screen.getByRole('button', { name: '我的參賽' }));
  fireEvent.click(screen.getByLabelText('我已閱讀並了解賽制與讓武原則'));
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  fireEvent.change(screen.getByLabelText('遊戲 ID'), { target: { value: 'myhero' } });
  vi.mocked(db.execute).mockRejectedValueOnce(new Error('儲存空間不足'));
  fireEvent.click(screen.getByRole('button', { name: '儲存草稿' }));
  const form = screen.getByRole('region', { name: '百業試鋒報名表' });
  await waitFor(() => expect(within(form).getByRole('alert')).toHaveTextContent('儲存空間不足'));
  expect(screen.getByLabelText('遊戲 ID')).toHaveValue('myhero');
  expect(state.events.find((e) => e.id === id)!.registration!.entries).toHaveLength(0);
});

it('報名截止與額滿先顯示原因，不引導新會員填完才拒絕', async () => {
  const id = apply(
    state,
    { type: 'activity-create', name: '名額測試', capacity: 2 },
    'capacity-event',
  );
  const event = state.events.find((e) => e.id === id)!;
  event.registration!.entries = ['other1', 'other2'].map((userId) => ({
    userId,
    playerId: userId,
    name: userId,
    gameId: userId,
    status: 'confirmed' as const,
    rulesAccepted: true,
    character: { style: '劍', weapon: '劍', equipment: '甲', arts: '無' },
  }));
  const view = render(<Sportsbook initialEventId={id} />);
  await screen.findByRole('heading', { name: '對局預覽' });
  fireEvent.click(screen.getByRole('button', { name: '我的參賽' }));
  expect(screen.getByRole('heading', { name: '報名名額已滿' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '下一步' })).toBeNull();
  view.unmount();
  event.registration!.open = false;
  render(<Sportsbook initialEventId={id} />);
  await screen.findByRole('heading', { name: '對局預覽' });
  fireEvent.click(screen.getByRole('button', { name: '我的參賽' }));
  expect(screen.getByRole('heading', { name: '報名已截止' })).toBeInTheDocument();
});

it('逐局賽果識別對局、不合法 BO3 聚焦錯誤，修正或取消後清除', async () => {
  history.replaceState(null, '', '/sportsbook?mode=manage');
  render(<Sportsbook embedded initialEventId={state.events[0]!.id} />);
  await screen.findByRole('heading', { name: '整場勝負' });
  fireEvent.click(screen.getByRole('button', { name: '管理模式' }));
  fireEvent.click(screen.getByRole('button', { name: '填寫逐局賽果' }));
  const modal = screen.getByRole('dialog', { name: '逐局賽果草稿' });
  expect(within(modal).getByText(/第 1 輪 · 第 1 場 · 聞人夜 ／ 白十七/)).toBeInTheDocument();
  const match = state.events[0]!.matches[0]!;
  const winners = within(modal).getAllByLabelText('勝者');
  const seconds = within(modal).getAllByLabelText('實際秒數');
  fireEvent.change(winners[0]!, { target: { value: match.p1 } });
  fireEvent.change(winners[1]!, { target: { value: match.p2 } });
  fireEvent.change(seconds[0]!, { target: { value: '90' } });
  fireEvent.change(seconds[1]!, { target: { value: '90' } });
  fireEvent.submit(modal.querySelector('form')!);
  await waitFor(() => expect(within(modal).getByRole('alert')).toHaveFocus());
  expect(within(modal).getByRole('alert')).toHaveTextContent('BO3 尚未產生勝者');
  expect(state.events[0]!.matches[0]!.draft).toHaveLength(0);
  fireEvent.change(winners[1]!, { target: { value: match.p1 } });
  expect(within(modal).queryByRole('alert')).toBeNull();
  fireEvent.click(within(modal).getByRole('button', { name: '關閉視窗' }));
  expect(state.events[0]!.matches[0]!.draft).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: '填寫逐局賽果' }));
  expect(within(screen.getByRole('dialog')).queryByRole('alert')).toBeNull();
  expect(within(screen.getByRole('dialog')).getAllByLabelText('勝者')[0]).toHaveValue('');
});

it('公開觀局與會員入口不提供管理或模擬登入', async () => {
  const view = render(<Sportsbook initialEventId={state.events[0]!.id} />);
  await screen.findByRole('heading', { name: '整場勝負' });
  expect(screen.queryByRole('button', { name: '管理模式' })).toBeNull();
  expect(screen.queryByRole('button', { name: '檢視模式' })).toBeNull();
  view.unmount();
  vi.mocked(db.session).mockReturnValue('');
  render(<Sportsbook memberOnly />);
  await screen.findByLabelText('帳號');
  expect(screen.queryByRole('button', { name: 'Discord 模擬' })).toBeNull();
  expect(screen.queryByRole('button', { name: '場次盤' })).toBeNull();
  vi.mocked(db.session).mockReturnValue('u');
  await act(async () => {
    window.dispatchEvent(new Event('lunjian:sports-session'));
    await Promise.resolve();
  });
  await screen.findByRole('heading', { name: '測試會員，別來無恙。' });
});

it('未選結果時不顯示點數表，進階設定預設收合，所有功能直接列在導覽', async () => {
  render(<Sportsbook initialEventId={state.events[0]!.id} />);
  await screen.findByRole('heading', { name: '整場勝負' });
  expect(screen.queryByLabelText('每筆本金（點）')).toBeNull();
  expect(screen.queryByText('更多')).toBeNull();
  const nav = screen.getByRole('navigation', { name: '觀局雅集' });
  expect(within(nav).getAllByRole('button')).toHaveLength(7);
  expect(within(nav).getByRole('button', { name: '對局小工具' })).toBeVisible();
  expect(screen.getByRole('button', { name: '點數紀錄' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /查看我的選擇/ }));
  const dialog = screen.getByRole('dialog', { name: '我的選擇' });
  expect(within(dialog).getByText('還沒選擇結果')).toBeVisible();
  expect(within(dialog).getByText('進階設定（選填）').closest('details')).not.toHaveAttribute(
    'open',
  );
  expect(within(dialog).queryByRole('button', { name: '更新賠率' })).toBeNull();
  expect(within(dialog).getByRole('button', { name: '返回挑選結果' })).toBeVisible();
});

it('我的獎品只顯示自己的申請及各狀態，只有待審核可取消', async () => {
  state.redemptions = ['pending', 'approved', 'delivered', 'cancelled'].map((status, i) => ({
    id: `r${i}`,
    userId: 'u',
    prizeId: 'p',
    name: `我的獎品${i}`,
    price: '300',
    status: status as State['redemptions'][number]['status'],
    created: Date.now() + i,
  }));
  state.redemptions.push({
    ...state.redemptions[0]!,
    id: 'other',
    userId: 'other',
    name: '別人的獎品',
  });
  render(<Sportsbook initialEventId={state.events[0]!.id} />);
  await screen.findByRole('heading', { name: '整場勝負' });
  fireEvent.click(screen.getByRole('button', { name: '我的獎品' }));
  expect(screen.getByRole('heading', { name: '我的獎品' })).toBeVisible();
  expect(screen.getByText('我的獎品0')).toBeVisible();
  expect(screen.getByText('我的獎品3')).toBeVisible();
  expect(screen.queryByText('別人的獎品')).toBeNull();
  expect(screen.getAllByRole('button', { name: '取消並退款' })).toHaveLength(1);
});
it('我的獎品空白時提供兌換入口，未登入時要求登入', async () => {
  render(<Sportsbook initialEventId={state.events[0]!.id} />);
  await screen.findByRole('heading', { name: '整場勝負' });
  fireEvent.click(screen.getByRole('button', { name: '我的獎品' }));
  expect(screen.getByText('尚未兌換獎品。')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '前往獎品兌換' }));
  expect(screen.getByRole('heading', { name: '以點數換一份心意' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '登出' }));
  fireEvent.click(screen.getByRole('button', { name: '我的獎品' }));
  expect(await screen.findByRole('button', { name: '登入查看' })).toBeVisible();
});

it('統一投注區保留左右比分歸屬並可查看示範配置與 BP', async () => {
  const dossier = JSON.parse(
    readFileSync('web/public/lunjian/dossier-demo.json', 'utf8'),
  ) as unknown;
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(dossier),
  } as Response);
  render(<Sportsbook initialEventId={state.events[0]!.id} />);
  const heading = await screen.findByRole('heading', { name: 'BO3 比分' });
  const score = within(heading.closest('section')!);
  expect(score.getByRole('button', { name: /選擇 2:0/ }).closest('[data-side]')).toHaveAttribute(
    'data-side',
    'left',
  );
  expect(score.getByRole('button', { name: /選擇 0:2/ }).closest('[data-side]')).toHaveAttribute(
    'data-side',
    'right',
  );
  expect(score.getByRole('button', { name: /選擇 2:1/ }).closest('[data-side]')).toHaveAttribute(
    'data-side',
    'left',
  );
  expect(score.getByRole('button', { name: /選擇 1:2/ }).closest('[data-side]')).toHaveAttribute(
    'data-side',
    'right',
  );
  fireEvent.click(screen.getAllByRole('button', { name: /查看.*備戰配置/ })[0]!);
  const detail = screen.getByRole('dialog', { name: /備戰配置/ });
  expect(await within(detail).findByRole('heading', { name: '裝備' })).toBeVisible();
  expect(within(detail).getByText('示範配置 · 非選手實際配裝')).toBeVisible();
  expect(within(detail).getByRole('heading', { name: '對方點名的 BP 限制 · 示範' })).toBeVisible();
});

it('已讀清單完成後可前進，返回先前步驟仍可點回已到達步驟且保留輸入', async () => {
  const id = apply(
    state,
    { type: 'activity-create', name: '流程測試', capacity: 4 },
    'flow-enroll',
  );
  render(<Sportsbook initialEventId={id} />);
  await screen.findByRole('heading', { name: '對局預覽' });
  fireEvent.click(screen.getByRole('button', { name: '我的參賽' }));
  expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  expect(screen.getByRole('link', { name: '賽制' })).toHaveAttribute(
    'href',
    expect.stringContaining('#rules'),
  );
  expect(screen.getByRole('link', { name: '讓武原則' })).toHaveAttribute(
    'href',
    expect.stringContaining('#invitation'),
  );
  fireEvent.click(screen.getByLabelText('我已閱讀並了解賽制與讓武原則'));
  expect(screen.getByLabelText('我已閱讀並了解賽制與讓武原則')).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  fireEvent.change(screen.getByLabelText('遊戲 ID'), { target: { value: 'keep-me' } });
  const nav = screen.getByRole('list', { name: '報名進度' });
  fireEvent.click(within(nav).getByRole('button', { name: /了解說明/ }));
  expect(within(nav).getByRole('button', { name: /填寫報名/ })).toBeEnabled();
  fireEvent.click(within(nav).getByRole('button', { name: /填寫報名/ }));
  expect(screen.getByLabelText('遊戲 ID')).toHaveValue('keep-me');
});
