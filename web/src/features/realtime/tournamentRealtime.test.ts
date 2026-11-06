import { create } from '@bufbuild/protobuf';
import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { activityApi } from '../../lib/api/activity';
import { TournamentPhase } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import {
  GetTournamentResponseSchema,
  GetBracketResponseSchema,
  ListRanksResponseSchema,
} from '../../lib/api/gen/hestia/activity/v1/tournament_pb';
import {
  WatchTournamentResponseSchema,
  type WatchTournamentResponse,
} from '../../lib/api/gen/hestia/activity/v1/watch_pb';
import { TournamentRealtime } from './tournamentRealtime';

function fixture() {
  const queue: WatchTournamentResponse[] = [];
  let wake = () => {};
  const send = (heartbeat = false) => {
    queue.push(
      create(WatchTournamentResponseSchema, {
        update: heartbeat
          ? { case: 'heartbeat', value: {} }
          : { case: 'registrationChanged', value: {} },
      }),
    );
    wake();
  };
  const watch = vi.fn(async function* (_request: unknown, options: { signal: AbortSignal }) {
    send(true);
    while (!options.signal.aborted) {
      if (!queue.length)
        await new Promise<void>((resolve) => {
          wake = resolve;
          options.signal.addEventListener('abort', () => resolve(), { once: true });
        });
      const event = queue.shift();
      if (event && !options.signal.aborted) yield event;
    }
  });
  const response = (name: string) =>
    create(GetTournamentResponseSchema, {
      tournament: {
        slug: 'test',
        name,
        phase: TournamentPhase.SIGNUP,
      },
    });
  const getTournament = vi.fn().mockResolvedValue(response('current'));
  const api = {
    ...activityApi,
    watch: { watchTournament: watch },
    tournament: {
      ...activityApi.tournament,
      getTournament,
      getBracket: vi.fn().mockResolvedValue(create(GetBracketResponseSchema)),
      listRanks: vi.fn().mockResolvedValue(create(ListRanksResponseSchema)),
    },
  } as typeof activityApi;
  return { store: new TournamentRealtime('test', api), watch, send, getTournament, response };
}
describe('活動共用即時同步', () => {
  it('多個訂閱者共用一條流，heartbeat 之後才讀快照，最後卸載中止流', async () => {
    const f = fixture();
    const off = f.store.subscribe(() => {});
    const off2 = f.store.subscribe(() => {});
    expect(f.getTournament).not.toHaveBeenCalled();
    await waitFor(() => expect(f.store.getSnapshot().status).toBe('ready'));
    expect(f.watch).toHaveBeenCalledOnce();
    off();
    expect(f.watch.mock.calls[0]![1].signal.aborted).toBe(false);
    off2();
    expect(f.watch.mock.calls[0]![1].signal.aborted).toBe(true);
  });
  it('快照期間有新事件時丟棄舊回應，重讀後才發布', async () => {
    const f = fixture();
    let resolve!: (value: ReturnType<typeof f.response>) => void;
    f.getTournament.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const names: (string | undefined)[] = [];
    const off = f.store.subscribe(() => {
      names.push(f.store.getSnapshot().tournament?.name);
    });
    await waitFor(() => expect(f.getTournament).toHaveBeenCalledOnce());
    f.send();
    await Promise.resolve();
    await Promise.resolve();
    resolve(f.response('stale'));
    await waitFor(() => expect(f.store.getSnapshot().status).toBe('ready'));
    expect(names).not.toContain('stale');
    expect(f.store.getSnapshot().tournament?.name).toBe('current');
    expect(f.getTournament).toHaveBeenCalledTimes(2);
    off();
  });
  it('大量失效事件合併重讀，離線標記過期，重連重新快照', async () => {
    const f = fixture();
    const off = f.store.subscribe(() => {});
    await waitFor(() => expect(f.store.getSnapshot().status).toBe('ready'));
    for (let i = 0; i < 20; i++) f.send();
    await waitFor(() => expect(f.getTournament).toHaveBeenCalledTimes(2));
    window.dispatchEvent(new Event('offline'));
    expect(f.store.getSnapshot().status).toBe('reconnecting');
    expect(f.store.getSnapshot().tournament?.name).toBe('current');
    window.dispatchEvent(new Event('online'));
    await waitFor(() => expect(f.store.getSnapshot().status).toBe('ready'));
    expect(f.getTournament).toHaveBeenCalledTimes(3);
    off();
  });
});
