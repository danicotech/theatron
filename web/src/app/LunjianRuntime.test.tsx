import { create } from '@bufbuild/protobuf';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TournamentPhase } from '../lib/api/gen/hestia/activity/v1/common_pb';
import {
  GetBracketResponseSchema,
  ListRanksResponseSchema,
  GetTournamentResponseSchema,
} from '../lib/api/gen/hestia/activity/v1/tournament_pb';
import { LunjianRuntime } from './LunjianRuntime';

const api = vi.hoisted(() => ({ getTournament: vi.fn(), getBracket: vi.fn(), listRanks: vi.fn() }));
vi.mock('../lib/api/activity', () => ({ activityApi: { tournament: api } }));

beforeEach(() => {
  Object.values(api).forEach((method) => method.mockReset());
  api.getBracket.mockResolvedValue(create(GetBracketResponseSchema));
  api.listRanks.mockResolvedValue(create(ListRanksResponseSchema));
  vi.stubEnv('NEXT_PUBLIC_TOURNAMENT_SLUG', 'test-event');
  window.__LUNJIAN = { updateActivity: vi.fn(), updateTournament: vi.fn(), destroy: vi.fn() };
});
afterEach(() => {
  cleanup();
  delete window.__LUNJIAN;
  document.querySelectorAll('script[data-lunjian-dependency]').forEach((script) => script.remove());
  document.querySelectorAll('link[data-test-style]').forEach((link) => link.remove());
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('活動 API 整合', () => {
  it('新版樣式載入後停用舊版，避免已刪除的銀章和定位規則殘留', () => {
    vi.stubEnv('NEXT_PUBLIC_TOURNAMENT_SLUG', '');
    const links = ['/lunjian/lunjian.css?v=old', '/lunjian/lunjian.css?v=new', '/other.css'].map(
      (href) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.dataset.testStyle = '';
        document.head.appendChild(link);
        return link;
      },
    );
    render(<LunjianRuntime revision="new" />);
    expect(links[0]!.disabled).not.toBe(true);
    fireEvent.load(links[1]!);
    expect(links[0]!.disabled).toBe(true);
    expect(links[1]!.disabled).toBe(false);
    expect(links[2]!.disabled).not.toBe(true);
  });
  it('未設定活動時不請求 API', () => {
    vi.stubEnv('NEXT_PUBLIC_TOURNAMENT_SLUG', '');
    render(<LunjianRuntime />);
    expect(api.getTournament).not.toHaveBeenCalled();
    expect(api.getBracket).not.toHaveBeenCalled();
    expect(api.listRanks).not.toHaveBeenCalled();
    expect(window.__LUNJIAN!.updateTournament).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'unconfigured' }),
    );
    expect(window.__LUNJIAN!.updateActivity).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'unconfigured' }),
    );
  });
  it('先顯示載入中，再以生成 API 回應更新 CTA', async () => {
    api.getTournament.mockResolvedValue(
      create(GetTournamentResponseSchema, { tournament: { phase: TournamentPhase.SIGNUP } }),
    );
    render(<LunjianRuntime />);
    expect(window.__LUNJIAN!.updateActivity).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'loading' }),
    );
    await waitFor(() =>
      expect(window.__LUNJIAN!.updateActivity).toHaveBeenLastCalledWith(
        expect.objectContaining({ href: '/t/test-event/signup', label: '報名參賽' }),
      ),
    );
    const call = api.getTournament.mock.calls[0] as [{ slug: string }, { signal: AbortSignal }];
    expect(call[0]).toEqual({ slug: 'test-event' });
    expect(call[1].signal).toBeInstanceOf(AbortSignal);
  });
  it('失敗保留錯誤狀態，重試才重新取得階段', async () => {
    api.getTournament
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(
        create(GetTournamentResponseSchema, { tournament: { phase: TournamentPhase.FINISHED } }),
      );
    render(<LunjianRuntime />);
    await waitFor(() =>
      expect(window.__LUNJIAN!.updateActivity).toHaveBeenLastCalledWith(
        expect.objectContaining({ kind: 'error', href: '#rules' }),
      ),
    );
    act(() => {
      document.dispatchEvent(new Event('lunjian:retry'));
    });
    await waitFor(() =>
      expect(window.__LUNJIAN!.updateActivity).toHaveBeenLastCalledWith(
        expect.objectContaining({ href: '/t/test-event/bracket' }),
      ),
    );
  });
  it('離開時中止請求並清除重試監聽', () => {
    api.getTournament.mockImplementation(() => new Promise(() => {}));
    const { unmount } = render(<LunjianRuntime />);
    const call = api.getTournament.mock.calls[0] as [{ slug: string }, { signal: AbortSignal }];
    unmount();
    expect(call[1].signal.aborted).toBe(true);
    document.dispatchEvent(new Event('lunjian:retry'));
    expect(api.getTournament).toHaveBeenCalledOnce();
  });
  it('生成版本更新時重新掛載主動畫並使用相同版本的 3D 模組', async () => {
    vi.stubEnv('NEXT_PUBLIC_TOURNAMENT_SLUG', '');
    const destroy = window.__LUNJIAN!.destroy;
    const view = render(<LunjianRuntime revision="first" />);
    for (const src of ['vendor/anime.min.js', 'brush.js', 'ink-title.js', 'lunjian.js?v=first']) {
      const script = await waitFor(() => {
        const element = document.querySelector(`script[src="/lunjian/${src}"]`);
        expect(element).not.toBeNull();
        return element!;
      });
      act(() => {
        fireEvent.load(script);
      });
    }
    await waitFor(() =>
      expect(document.querySelector('#lunjian-stage-mount')?.textContent).toContain(
        'stage3d.js?v=first',
      ),
    );
    const oldToken = document.getElementById('lunjian-stage-mount')?.dataset.mountToken;
    expect(oldToken).toBeTruthy();
    view.rerender(<LunjianRuntime revision="second" />);
    expect(destroy).toHaveBeenCalledOnce();
    expect(document.querySelector('script[src="/lunjian/lunjian.js?v=first"]')).toBeNull();
    expect(document.querySelector('#lunjian-stage-mount')).toBeNull();
    const next = await waitFor(() => {
      const script = document.querySelector('script[src="/lunjian/lunjian.js?v=second"]');
      expect(script).not.toBeNull();
      return script!;
    });
    act(() => {
      fireEvent.load(next);
    });
    await waitFor(() =>
      expect(document.querySelector('#lunjian-stage-mount')?.textContent).toContain(
        'stage3d.js?v=second',
      ),
    );
    const newMount = document.getElementById('lunjian-stage-mount');
    expect(newMount?.dataset.mountToken).not.toBe(oldToken);
    expect(newMount?.textContent).toContain(
      `dataset.mountToken === ${JSON.stringify(newMount?.dataset.mountToken)}`,
    );
    expect(document.querySelectorAll('script[data-lunjian-dependency]')).toHaveLength(3);
  });
  it('重新掛載沿用已載入的墨字依賴，不重複宣告全域常數', async () => {
    vi.stubEnv('NEXT_PUBLIC_TOURNAMENT_SLUG', '');
    const first = render(<LunjianRuntime />);
    for (const src of ['vendor/anime.min.js', 'brush.js', 'ink-title.js']) {
      const script = await waitFor(() => {
        const element = document.querySelector(`script[src="/lunjian/${src}"]`);
        expect(element).not.toBeNull();
        return element!;
      });
      act(() => {
        fireEvent.load(script);
      });
    }
    first.unmount();
    render(<LunjianRuntime />);
    await waitFor(() =>
      expect(document.querySelector('script[src="/lunjian/lunjian.js"]')).not.toBeNull(),
    );
    expect(document.querySelectorAll('script[data-lunjian-dependency]')).toHaveLength(3);
    expect(document.querySelectorAll('script[src="/lunjian/ink-title.js"]')).toHaveLength(1);
  });
});

describe('首頁公開對戰表整合', () => {
  it('使用生成 API 並獨立提供公開選手與正式局數', async () => {
    api.getTournament.mockResolvedValue(
      create(GetTournamentResponseSchema, {
        tournament: { phase: TournamentPhase.IN_PROGRESS, bestOf: 5 },
      }),
    );
    api.getBracket.mockResolvedValue(
      create(GetBracketResponseSchema, {
        bracketPublished: true,
        players: [{ publicId: 'p1', displayName: '公開俠客' }],
      }),
    );
    render(<LunjianRuntime />);
    expect(window.__LUNJIAN!.updateTournament).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'loading' }),
    );
    await waitFor(() =>
      expect(window.__LUNJIAN!.updateTournament).toHaveBeenLastCalledWith(
        expect.objectContaining({
          kind: 'ready',
          published: true,
          bestOf: 5,
          players: [expect.objectContaining({ id: 'p1', name: '公開俠客' })],
        }),
      ),
    );
    for (const method of [api.getBracket, api.listRanks]) {
      const call = method.mock.calls[0] as [{ tournamentSlug: string }, { signal: AbortSignal }];
      expect(call[0]).toEqual({ tournamentSlug: 'test-event' });
      expect(call[1].signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('對戰表失敗不改活動 CTA；獨立重試不重送活動 API', async () => {
    api.getTournament.mockResolvedValue(
      create(GetTournamentResponseSchema, { tournament: { phase: TournamentPhase.SIGNUP } }),
    );
    api.getBracket
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(create(GetBracketResponseSchema, { bracketPublished: true }));
    render(<LunjianRuntime />);
    await waitFor(() =>
      expect(window.__LUNJIAN!.updateTournament).toHaveBeenLastCalledWith(
        expect.objectContaining({ kind: 'error', players: [], rounds: [] }),
      ),
    );
    expect(window.__LUNJIAN!.updateActivity).toHaveBeenLastCalledWith(
      expect.objectContaining({ href: '/t/test-event/signup', kind: 'ready' }),
    );
    act(() => {
      document.dispatchEvent(new Event('lunjian:retry-tournament'));
    });
    await waitFor(() =>
      expect(window.__LUNJIAN!.updateTournament).toHaveBeenLastCalledWith(
        expect.objectContaining({ kind: 'ready', published: true }),
      ),
    );
    expect(api.getTournament).toHaveBeenCalledOnce();
    expect(api.getBracket).toHaveBeenCalledTimes(2);
  });

  it('忽略被重試取代的慢回應，卸載中止兩條 API 並移除重試監聽', async () => {
    let oldResponse!: (
      response: ReturnType<typeof create<typeof GetBracketResponseSchema>>,
    ) => void;
    api.getTournament.mockImplementation(() => new Promise(() => {}));
    api.getBracket
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            oldResponse = resolve;
          }),
      )
      .mockResolvedValueOnce(
        create(GetBracketResponseSchema, {
          bracketPublished: true,
          players: [{ publicId: 'new', displayName: '新資料' }],
        }),
      );
    const { unmount } = render(<LunjianRuntime />);
    const oldCall = api.getBracket.mock.calls[0] as [unknown, { signal: AbortSignal }];
    const oldSignal = oldCall[1].signal;
    act(() => {
      document.dispatchEvent(new Event('lunjian:retry-tournament'));
    });
    await waitFor(() =>
      expect(window.__LUNJIAN!.updateTournament).toHaveBeenLastCalledWith(
        expect.objectContaining({
          kind: 'ready',
          players: [expect.objectContaining({ id: 'new' })],
        }),
      ),
    );
    expect(oldSignal.aborted).toBe(true);
    await act(async () => {
      oldResponse(
        create(GetBracketResponseSchema, {
          bracketPublished: true,
          players: [{ publicId: 'old' }],
        }),
      );
      await Promise.resolve();
    });
    expect(window.__LUNJIAN!.updateTournament).toHaveBeenLastCalledWith(
      expect.objectContaining({ players: [expect.objectContaining({ id: 'new' })] }),
    );
    const activeCall = api.getBracket.mock.calls[1] as [unknown, { signal: AbortSignal }];
    const activeSignal = activeCall[1].signal;
    const activityCall = api.getTournament.mock.calls[0] as [unknown, { signal: AbortSignal }];
    const activitySignal = activityCall[1].signal;
    unmount();
    expect(activeSignal.aborted).toBe(true);
    expect(activitySignal.aborted).toBe(true);
    document.dispatchEvent(new Event('lunjian:retry-tournament'));
    expect(api.getBracket).toHaveBeenCalledTimes(2);
  });

  it('背景更新不先清空對戰表，卸載清除輪詢計時', async () => {
    vi.useFakeTimers();
    api.getTournament.mockResolvedValue(
      create(GetTournamentResponseSchema, { tournament: { phase: TournamentPhase.IN_PROGRESS } }),
    );
    const { unmount } = render(<LunjianRuntime />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const update = vi.mocked(window.__LUNJIAN!.updateTournament);
    update.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(api.getBracket).toHaveBeenCalledTimes(2);
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'loading' }));
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(api.getBracket).toHaveBeenCalledTimes(2);
  });
});
