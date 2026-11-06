'use client';

import { useEffect } from 'react';
import type { SportsPresentation } from '../features/sportsbook/SportsbookBridge';
import { activityDisplay, type ActivityDisplay } from '../features/landing/activityDisplay';
import { tournamentDisplay, type TournamentDisplay } from '../features/landing/tournamentDisplay';
import { tournamentRealtime } from '../features/realtime/tournamentRealtime';
import { mountChapterOpening } from '../features/chrome/homeOpening';
import { performanceProbe } from '../features/chrome/performanceProbe';
import '../features/chrome/home-opening.css';

declare global {
  interface Window {
    __LUNJIAN?: {
      destroy: () => void;
      enterStage?: () => void;
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
    performanceProbe(controller.signal);
    // The server primes this gate before the first paint, including client navigation.
    // Release only after the requested chapter and its animation start states exist.
    const revealEntry = () =>
      document.querySelector('.chapter-entry')?.removeAttribute('data-entry-pending');
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
    const store = tournamentRealtime(slug);
    const publish = () => window.__LUNJIAN?.updateActivity(view);
    const publishBracket = () => window.__LUNJIAN?.updateTournament(bracketView);
    const sync = () => {
      const state = store.getSnapshot();
      view = activityDisplay(
        slug,
        state.status === 'ready' && state.tournament
          ? state.tournament.phase
          : state.status === 'error' || state.status === 'reconnecting'
            ? 'error'
            : 'loading',
      );
      if (state.status === 'reconnecting') view.status = '連線中斷，正在重新同步';
      if (state.bracket && state.tournament)
        bracketView = tournamentDisplay(slug, {
          bracket: state.bracket,
          ranks: state.ranks,
          bestOf: state.tournament.bestOf,
        });
      if (!state.bracket && state.status === 'error')
        bracketView = tournamentDisplay(slug, 'error');
      publish();
      publishBracket();
    };
    const unsubscribe = slug ? store.subscribe(sync) : () => {};
    document.addEventListener('lunjian:retry', store.reconnect, { signal: controller.signal });
    document.addEventListener('lunjian:retry-tournament', store.reconnect, {
      signal: controller.signal,
    });
    sync();
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
      revealEntry();
      publish();
      publishBracket();
      mountChapterOpening(
        document.getElementById('boot')?.parentElement ?? null,
        controller.signal,
        () => window.__LUNJIAN?.enterStage?.(),
      );
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
        revealEntry();
      }
    });
    return () => {
      controller.abort();
      unsubscribe();
      window.__LUNJIAN?.destroy();
      for (const script of added) script.remove();
    };
  }, [revision]);
  return null;
}
