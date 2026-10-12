'use client';

import { useEffect } from 'react';
import type { SportsPresentation } from '../features/sportsbook/SportsbookBridge';
import { activityDisplay, type ActivityDisplay } from '../features/landing/activityDisplay';
import { tournamentDisplay, type TournamentDisplay } from '../features/landing/tournamentDisplay';
import { activityApi } from '../lib/api/activity';
import type { RankInfo } from '../lib/api/gen/hestia/activity/v1/common_pb';
import type { GetBracketResponse } from '../lib/api/gen/hestia/activity/v1/tournament_pb';

declare global {
  interface Window {
    __LUNJIAN?: {
      destroy: () => void;
      applySportsbookEvent?: (view: SportsPresentation) => void;
      updateActivity: (view: ActivityDisplay) => void;
      updateTournament: (view: TournamentDisplay) => void;
    };
    __LOADOUT?: { destroy: () => void };
  }
}
const CLASSIC = [
  '/lunjian/vendor/anime.min.js',
  '/lunjian/brush.js',
  '/lunjian/ink-title.js',
  '/lunjian/lunjian.js',
];

export function LunjianRuntime({ revision = '' }: { revision?: string }) {
  useEffect(() => {
    const version = revision ? `?v=${encodeURIComponent(revision)}` : '';
    const controller = new AbortController();
    // React retains precedence stylesheets across refreshes. Retire earlier lab
    // revisions only after this revision loads, so removed CSS cannot survive.
    const styles = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].filter(
      (link) => new URL(link.href, location.href).pathname === '/lunjian/lunjian.css',
    );
    const currentStyle = styles.find(
      (link) => new URL(link.href, location.href).searchParams.get('v') === revision,
    );
    if (currentStyle) {
      const activateStyle = () => {
        styles.forEach((link) => {
          link.disabled = link !== currentStyle;
        });
      };
      currentStyle.disabled = false;
      if (currentStyle.sheet) activateStyle();
      else
        currentStyle.addEventListener('load', activateStyle, {
          once: true,
          signal: controller.signal,
        });
    }
    const added: HTMLScriptElement[] = [];
    const slug = (process.env.NEXT_PUBLIC_TOURNAMENT_SLUG ?? '').trim();
    let view = activityDisplay(slug);
    let bracketView = tournamentDisplay(slug);
    let request: AbortController | undefined;
    let bracketRequest: AbortController | undefined;
    let bracketPoll: ReturnType<typeof setTimeout> | undefined;
    let bracketData: GetBracketResponse | undefined;
    let ranks: RankInfo[] = [];
    let bestOf = 0;
    const publish = () => window.__LUNJIAN?.updateActivity(view);
    const publishBracket = () => window.__LUNJIAN?.updateTournament(bracketView);
    const projectBracket = () => {
      if (!bracketData) return;
      bracketView = tournamentDisplay(slug, { bracket: bracketData, ranks, bestOf });
      publishBracket();
    };
    const refreshBracket = async (background = false) => {
      if (bracketPoll !== undefined) clearTimeout(bracketPoll);
      bracketRequest?.abort();
      bracketRequest = new AbortController();
      const current = bracketRequest;
      if (!background) {
        bracketData = undefined;
        bracketView = tournamentDisplay(slug);
        publishBracket();
      }
      if (!slug) return;
      try {
        const [bracket, rankList] = await Promise.all([
          activityApi.tournament.getBracket({ tournamentSlug: slug }, { signal: current.signal }),
          activityApi.tournament.listRanks({ tournamentSlug: slug }, { signal: current.signal }),
        ]);
        if (current.signal.aborted || controller.signal.aborted) return;
        bracketData = bracket;
        ranks = rankList.ranks;
        projectBracket();
      } catch {
        if (current.signal.aborted || controller.signal.aborted) return;
        bracketData = undefined;
        bracketView = tournamentDisplay(slug, 'error');
        publishBracket();
      }
      if (!current.signal.aborted && !controller.signal.aborted) {
        bracketPoll = setTimeout(() => void refreshBracket(true), 10_000);
      }
    };
    const refresh = async () => {
      request?.abort();
      request = new AbortController();
      const current = request;
      view = activityDisplay(slug);
      publish();
      if (!slug) return;
      try {
        const response = await activityApi.tournament.getTournament(
          { slug },
          { signal: current.signal },
        );
        if (!response.tournament) throw new Error('Tournament missing');
        if (current.signal.aborted || controller.signal.aborted) return;
        view = activityDisplay(slug, response.tournament.phase);
        bestOf = response.tournament.bestOf;
        projectBracket();
      } catch {
        if (current.signal.aborted || controller.signal.aborted) return;
        view = activityDisplay(slug, 'error');
      }
      publish();
    };
    document.addEventListener(
      'lunjian:retry',
      () => {
        void refresh();
        void refreshBracket();
      },
      { signal: controller.signal },
    );
    document.addEventListener('lunjian:retry-tournament', () => void refreshBracket(), {
      signal: controller.signal,
    });
    void refresh();
    void refreshBracket();
    const one = (src: string) =>
      new Promise<void>((resolve, reject) => {
        // Classic dependencies include lexical globals (INK). Keep one copy per
        // document, including across StrictMode and client-side route revisits.
        const shared = src !== '/lunjian/lunjian.js';
        const existing = shared
          ? document.querySelector<HTMLScriptElement>(`script[data-lunjian-dependency="${src}"]`)
          : null;
        if (existing?.dataset.loaded === 'true') {
          resolve();
          return;
        }
        const script = existing ?? document.createElement('script');
        script.src = shared ? src : src + version;
        script.async = false;
        script.addEventListener(
          'load',
          () => {
            script.dataset.loaded = 'true';
            resolve();
          },
          { once: true },
        );
        script.addEventListener(
          'error',
          () => {
            script.remove();
            reject(new Error(`無法載入 ${src}`));
          },
          { once: true },
        );
        controller.signal.addEventListener('abort', () => resolve(), { once: true });
        if (shared) script.dataset.lunjianDependency = src;
        else added.push(script);
        if (!existing) document.body.appendChild(script);
      });
    void (async () => {
      for (const src of CLASSIC) {
        if (controller.signal.aborted) return;
        await one(src);
      }
      if (controller.signal.aborted) return;
      publish();
      publishBracket();
      const module = document.createElement('script');
      module.type = 'module';
      module.id = 'lunjian-stage-mount';
      const mountToken = crypto.randomUUID();
      module.dataset.mountToken = mountToken;
      module.textContent = `import { mountStage3D } from '/lunjian/stage3d.js${version}'; if (document.getElementById('lunjian-stage-mount')?.dataset.mountToken === ${JSON.stringify(mountToken)}) mountStage3D();`;
      added.push(module);
      document.body.appendChild(module);
    })().catch((error: unknown) => {
      if (!controller.signal.aborted) {
        console.warn(error);
        document.body.classList.add('reading');
        document.body.removeAttribute('data-intro');
        document
          .querySelectorAll<HTMLElement>('.chapter-sticky,.site-header,main,.status-bar')
          .forEach((node) => {
            node.inert = false;
          });
        const boot = document.getElementById('boot');
        if (boot) boot.hidden = true;
      }
    });
    return () => {
      controller.abort();
      request?.abort();
      bracketRequest?.abort();
      if (bracketPoll !== undefined) clearTimeout(bracketPoll);
      window.__LUNJIAN?.destroy();
      for (const script of added) script.remove();
    };
  }, [revision]);
  return null;
}
