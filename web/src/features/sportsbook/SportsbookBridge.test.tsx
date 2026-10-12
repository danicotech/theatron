import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { apply, buildEvent, defaultSnapshot, initialState } from './engine';
import { SportsbookBridge } from './SportsbookBridge';
import * as db from './database';
vi.mock('./database', () => ({
  readState: vi.fn(),
  session: vi.fn(() => ''),
  subscribe: vi.fn(() => () => {}),
  execute: vi.fn(),
  saveSession: vi.fn(),
  register: vi.fn(),
  loginLocal: vi.fn(),
  discordLocal: vi.fn(),
}));
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
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
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  history.replaceState(null, '', '/');
  delete window.__LUNJIAN;
});
it('未指定活動的首頁點報名直接開四步表單，關閉返回原按鈕', async () => {
  const state = initialState();
  vi.mocked(db.readState).mockResolvedValue(state);
  vi.mocked(db.execute).mockImplementation((command) =>
    Promise.resolve(apply(state, command, crypto.randomUUID())),
  );
  render(
    <>
      <a data-registration-entry href="/sportsbook?entry=registration">
        開啟報名表
      </a>
      <SportsbookBridge />
    </>,
  );
  const link = screen.getByRole('link', { name: '開啟報名表' });
  link.focus();
  fireEvent.click(link);
  const dialog = await screen.findByRole('dialog', { name: '百業試鋒 · 報名表' });
  await within(dialog).findByRole('heading', { name: '赴約參賽' });
  expect(within(dialog).queryByRole('group', { name: '操作模式' })).not.toBeInTheDocument();
  expect(state.events).toHaveLength(1);
  await waitFor(() =>
    expect(new URL(location.href).searchParams.get('sportsEvent')).toBe(state.events[0]!.id),
  );
  fireEvent.click(within(dialog).getByRole('button', { name: '關閉視窗' }));
  expect(link).toHaveFocus();
});
it('本機資料庫失敗時顯示重試，不宣稱已開啟或報名成功', async () => {
  vi.mocked(db.readState).mockResolvedValue(initialState());
  vi.mocked(db.execute).mockRejectedValue(new Error('本機儲存失敗'));
  render(
    <>
      <a data-registration-entry href="/sportsbook?entry=registration">
        開啟報名表
      </a>
      <SportsbookBridge />
    </>,
  );
  fireEvent.click(screen.getByRole('link', { name: '開啟報名表' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('本機儲存失敗');
  expect(screen.getByRole('button', { name: '重新讀取報名表' })).toBeEnabled();
  expect(screen.queryByRole('heading', { name: '赴約參賽' })).not.toBeInTheDocument();
});
it('首頁開啟指定場次，關閉還原觸發者，卸載後停止同步與監聽', async () => {
  const state = initialState(),
    event = buildEvent(state, defaultSnapshot(4), '試玩');
  const applySportsbookEvent = vi.fn(),
    off = vi.fn();
  window.__LUNJIAN = {
    applySportsbookEvent,
    destroy: vi.fn(),
    updateActivity: vi.fn(),
    updateTournament: vi.fn(),
  };
  vi.mocked(db.readState).mockResolvedValue(state);
  vi.mocked(db.subscribe).mockReturnValue(off);
  history.replaceState(null, '', `/?preview=1&sportsEvent=${event.id}#duel`);
  const { unmount } = render(
    <>
      <button data-sports-member>開啟雅集</button>
      <SportsbookBridge />
    </>,
  );
  await waitFor(() => expect(applySportsbookEvent).toHaveBeenCalled());
  const trigger = screen.getByRole('button');
  trigger.focus();
  act(() => {
    document.dispatchEvent(
      new CustomEvent('lunjian:sports-open', {
        detail: { eventId: event.id, matchId: 'm1-1', outcome: 'p2' },
      }),
    );
  });
  const dialog = await screen.findByRole('dialog', { name: '觀局雅集' });
  const heading = await within(dialog).findByRole('heading', { name: '整場勝負' });
  expect(
    within(heading.closest('section')!).getByRole('button', { name: /選擇.*柳三更/ }),
  ).toHaveAttribute('data-highlight', 'true');
  const login = within(dialog).getByRole('button', { name: '登入／註冊領 1,000 點' });
  login.focus();
  fireEvent.click(login);
  const auth = await screen.findByRole('dialog', { name: '會員登入與註冊' });
  fireEvent(auth, new Event('cancel', { bubbles: true, cancelable: true }));
  expect(screen.queryByRole('dialog', { name: '會員登入與註冊' })).not.toBeInTheDocument();
  expect(dialog).toHaveAttribute('open');
  expect(login).toHaveFocus();
  fireEvent.click(within(dialog).getByRole('button', { name: '關閉視窗' }));
  expect(document.activeElement).toBe(trigger);
  unmount();
  expect(off).toHaveBeenCalled();
  const reads = vi.mocked(db.readState).mock.calls.length;
  act(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('lunjian:ready'));
  });
  expect(db.readState).toHaveBeenCalledTimes(reads);
});

it('首次展卷等待活動與表單兩階段資料完成，不先展開短讀取畫面', async () => {
  const state = initialState();
  const id = apply(state, { type: 'registration-open' }, crypto.randomUUID());
  let resolveEntry!: (value: typeof state) => void;
  let resolveForm!: (value: typeof state) => void;
  vi.mocked(db.readState)
    .mockResolvedValueOnce(state)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveEntry = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveForm = resolve;
        }),
    );
  render(
    <>
      <div className="registration-desk">
        <div id="registration-inline" />
        <a id="register-cta" data-registration-entry href={`/sportsbook?event=${id}`}>
          展卷
        </a>
      </div>
      <SportsbookBridge />
    </>,
  );
  fireEvent.click(screen.getByRole('link', { name: '展卷' }));
  await waitFor(() => expect(resolveEntry).toBeDefined());
  expect(document.querySelector('.registration-desk')).toHaveAttribute('data-expanded', 'false');
  expect(screen.queryByRole('region', { name: '報名參賽' })).toBeNull();
  await act(async () => {
    resolveEntry(state);
    await Promise.resolve();
  });
  await waitFor(() => expect(resolveForm).toBeDefined());
  expect(screen.queryByRole('region', { name: '報名參賽' })).toBeNull();
  await act(async () => {
    resolveForm(state);
    await Promise.resolve();
  });
  expect(await screen.findByRole('region', { name: '報名參賽' })).toBeVisible();
  expect(document.querySelector('.registration-desk')).toHaveAttribute('data-expanded', 'true');
});

it('報名章節展開書卷而非外層視窗，收卷保留未送出的內容', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  const state = initialState();
  vi.mocked(db.session).mockReturnValue('');
  vi.mocked(db.readState).mockResolvedValue(state);
  vi.mocked(db.execute).mockImplementation((command) =>
    Promise.resolve(apply(state, command, crypto.randomUUID())),
  );
  const { unmount } = render(
    <>
      <div className="registration-desk">
        <div id="registration-inline" />
        <a id="register-cta" data-registration-entry href="/sportsbook?entry=registration">
          展卷報名
        </a>
      </div>
      <SportsbookBridge />
    </>,
  );
  fireEvent.click(screen.getByRole('link', { name: '展卷報名' }));
  const scroll = await screen.findByRole('region', { name: '報名參賽' });
  await within(scroll).findByRole('list', { name: '報名進度' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const check = within(scroll).getByRole('checkbox', { name: '我已閱讀並了解賽制與讓武原則' });
  fireEvent.click(check);
  expect(within(scroll).queryByRole('button', { name: '返回讓武' })).toBeNull();
  expect(check).toBeChecked();
  expect(state.events).toHaveLength(1);
  unmount();
});

it('示範對局的報名入口解析到報名活動，已讀後可進下一步且不改原對局', async () => {
  const state = initialState();
  const event = buildEvent(state, defaultSnapshot(4), '示範對局');
  const original = JSON.stringify(event);
  state.members.push({
    id: 'u',
    login: 'tester',
    name: '測試帳號',
    salt: '',
    hash: '',
    discord: '',
    balance: '1000',
  });
  vi.mocked(db.session).mockReturnValue('u');
  vi.mocked(db.readState).mockResolvedValue(state);
  vi.mocked(db.execute).mockImplementation((command) =>
    Promise.resolve(apply(state, command, crypto.randomUUID())),
  );
  history.replaceState(null, '', `/?preview=1&sportsEvent=${event.id}#register`);
  render(
    <>
      <div className="registration-desk">
        <div id="registration-inline" />
      </div>
      <SportsbookBridge />
    </>,
  );
  const next = await screen.findByRole('button', { name: '下一步' });
  fireEvent.click(next);
  expect(screen.queryByRole('textbox', { name: /遊戲 ID/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: '我已閱讀並了解賽制與讓武原則' }));
  fireEvent.click(next);
  expect(await screen.findByRole('textbox', { name: /遊戲 ID/ })).toBeVisible();
  expect(JSON.stringify(event)).toBe(original);
  expect(state.events.filter((e) => e.registration)).toHaveLength(1);
});

it('武學配置先登入，取消返回入口；登入後保留活動及返回報名的連結', async () => {
  const state = initialState();
  vi.mocked(db.session).mockReturnValue('');
  vi.mocked(db.readState).mockResolvedValue(state);
  const href = '/loadout?preview=1&sportsEvent=chosen-event&returnTo=register';
  render(
    <>
      <a data-my-loadout href={href}>
        <span data-my-loadout-label>登入並設定</span>
      </a>
      <p data-my-loadout-description />
      <SportsbookBridge />
    </>,
  );
  const trigger = screen.getByRole('link', { name: '登入並設定' });
  trigger.focus();
  fireEvent.click(trigger);
  let dialog = await screen.findByRole('dialog', { name: '我的武學配置' });
  await within(dialog).findByRole('heading', { name: '登入後設定武學配置' });
  expect(within(dialog).queryByRole('link', { name: /前往我的武學配置/ })).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: '關閉視窗' }));
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  dialog = await screen.findByRole('dialog', { name: '我的武學配置' });
  state.members.push({
    id: 'loadout-user',
    login: 'user',
    name: '配置會員',
    salt: '',
    hash: '',
    discord: '',
    balance: '1000',
  });
  vi.mocked(db.session).mockReturnValue('loadout-user');
  act(() => {
    window.dispatchEvent(new Event('lunjian:sports-session'));
  });
  const next = await within(dialog).findByRole('link', { name: /前往我的武學配置/ });
  expect(next).toHaveAttribute('href', href);
  await waitFor(() => expect(next).toHaveFocus());
  expect(trigger).toHaveTextContent('設定我的武學配置');
  fireEvent.click(within(dialog).getByRole('button', { name: '關閉視窗' }));
  expect(trigger).toHaveFocus();
});
