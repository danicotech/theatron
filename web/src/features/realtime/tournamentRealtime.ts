import { Code, ConnectError } from '@connectrpc/connect';
import { activityApi } from '../../lib/api/activity';
import type { RankInfo, Tournament } from '../../lib/api/gen/hestia/activity/v1/common_pb';
import type { GetBracketResponse } from '../../lib/api/gen/hestia/activity/v1/tournament_pb';

export type Connection = 'connecting' | 'syncing' | 'ready' | 'reconnecting' | 'error';
export interface TournamentSnapshot {
  status: Connection;
  tournament: Tournament | undefined;
  ranks: RankInfo[];
  bracket: GetBracketResponse | undefined;
  revision: number;
  error: string | undefined;
}
const initial = (): TournamentSnapshot => ({
  status: 'connecting',
  tournament: undefined,
  ranks: [],
  bracket: undefined,
  revision: 0,
  error: undefined,
});

/** One stream per activity. Events invalidate authoritative reads; emittedAt is not a version. */
export class TournamentRealtime {
  private state = initial();
  private listeners = new Set<() => void>();
  private connection: AbortController | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private heartbeatTimer: ReturnType<typeof setTimeout> | undefined;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private dirty = 0;
  private attempt = 0;
  private live = false;
  private running: AbortController | undefined;

  constructor(
    readonly slug: string,
    private api = activityApi,
  ) {}
  getSnapshot = () => this.state;
  getServerSnapshot = () => SERVER_SNAPSHOT;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      window.addEventListener('online', this.reconnect);
      window.addEventListener('offline', this.offline);
      document.addEventListener('visibilitychange', this.foreground);
      this.reconnect();
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.cancel();
        window.removeEventListener('online', this.reconnect);
        window.removeEventListener('offline', this.offline);
        document.removeEventListener('visibilitychange', this.foreground);
        this.state = initial();
      }
    };
  };
  private set(patch: Partial<TournamentSnapshot>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private cancel() {
    this.connection?.abort();
    this.connection = undefined;
    this.live = false;
    this.running = undefined;
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.heartbeatTimer);
    clearTimeout(this.refreshTimer);
  }
  private foreground = () => {
    if (document.visibilityState === 'visible') this.reconnect();
  };
  private offline = () => {
    this.cancel();
    this.set({ status: 'reconnecting', error: undefined });
  };
  reconnect = () => {
    this.cancel();
    if (!this.listeners.size || !this.slug) return;
    this.set({ status: this.state.tournament ? 'reconnecting' : 'connecting', error: undefined });
    const controller = new AbortController();
    this.connection = controller;
    void this.watch(controller);
  };
  private armHeartbeat(controller: AbortController) {
    clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = setTimeout(() => {
      if (this.connection === controller) this.reconnect();
    }, 45_000);
  }
  private async watch(controller: AbortController) {
    this.armHeartbeat(controller);
    try {
      for await (const event of this.api.watch.watchTournament(
        { tournamentSlug: this.slug },
        { signal: controller.signal },
      )) {
        if (controller.signal.aborted) return;
        this.armHeartbeat(controller);
        if (!this.live) {
          if (event.update.case !== 'heartbeat') continue;
          this.live = true;
          this.invalidate();
        } else if (event.update.case !== 'heartbeat') {
          // Unknown events also invalidate; never silently skip a new server feature.
          this.invalidate();
        }
      }
      throw new Error('即時連線已中斷');
    } catch (error) {
      if (controller.signal.aborted) return;
      const ce = ConnectError.from(error);
      this.cancel();
      const terminal = [Code.PermissionDenied, Code.Unauthenticated, Code.NotFound].includes(
        ce.code,
      );
      this.set({
        status: terminal ? 'error' : 'reconnecting',
        error: terminal ? ce.rawMessage : undefined,
      });
      if (!terminal) {
        const delay = Math.min(15_000, 500 * 2 ** this.attempt++) * (0.75 + Math.random() * 0.5);
        this.reconnectTimer = setTimeout(this.reconnect, delay);
      }
    }
  }
  invalidate = () => {
    this.dirty++;
    if (!this.live) return;
    this.set({ status: 'syncing' });
    if (this.running) return;
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => void this.refresh(), 40);
  };
  private async refresh() {
    const controller = this.connection;
    if (!controller || !this.live || this.running) return;
    this.running = controller;
    try {
      while (!controller.signal.aborted) {
        const generation = this.dirty;
        const options = { signal: controller.signal };
        const [t, r, b] = await Promise.all([
          this.api.tournament.getTournament({ slug: this.slug }, options),
          this.api.tournament.listRanks({ tournamentSlug: this.slug }, options),
          this.api.tournament.getBracket({ tournamentSlug: this.slug }, options),
        ]);
        if (controller.signal.aborted) return;
        if (generation !== this.dirty) continue;
        if (!t.tournament) throw new Error('找不到這一屆賽事');
        this.attempt = 0;
        this.set({
          status: 'ready',
          tournament: t.tournament,
          ranks: r.ranks,
          bracket: b,
          revision: this.state.revision + 1,
          error: undefined,
        });
        return;
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        this.set({ status: 'error', error: ConnectError.from(error).rawMessage });
        this.reconnectTimer = setTimeout(this.reconnect, 3000);
      }
    } finally {
      if (this.running === controller) this.running = undefined;
    }
  }
}
const SERVER_SNAPSHOT = initial();
const stores = new Map<string, TournamentRealtime>();
export function tournamentRealtime(slug: string): TournamentRealtime {
  let store = stores.get(slug);
  if (!store) {
    store = new TournamentRealtime(slug);
    stores.set(slug, store);
  }
  return store;
}
