'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RegistrationScroll } from './RegistrationScroll';
import { readState, session, subscribe } from './database';
import { money } from './engine';
import { Modal, Sportsbook } from './Sportsbook';
import { RegistrationEntry } from './RegistrationEntry';
import { MatchTools } from './MatchTools';
import styles from './Sportsbook.module.css';
import type { Snapshot, Tournament } from './model';
export type SportsPresentation = Snapshot & {
  sportsEventId: string;
  demo: true;
  published: boolean;
  registration?: { open: boolean; published: boolean };
  bestOf: 3;
  phase: number;
};
export function present(e: Tournament): SportsPresentation {
  const rounds = [...new Set(e.matches.map((m) => m.round))]
    .sort((a, b) => a - b)
    .map((round) => ({
      round,
      label: round === Math.max(...e.matches.map((m) => m.round)) ? '決賽' : `第 ${round} 輪`,
      matches: e.matches.filter((m) => m.round === round),
    }));
  return {
    sportsEventId: e.id,
    players: e.players,
    rounds,
    demo: true,
    published: e.registration?.published ?? true,
    ...(e.registration
      ? { registration: { open: e.registration.open, published: e.registration.published } }
      : {}),
    bestOf: 3,
    phase:
      e.registration && !e.registration.published
        ? e.registration.open
          ? 1
          : 2
        : e.matches.length > 0 && e.matches.every((m) => m.status === 'done')
          ? 6
          : e.started
            ? 5
            : 4,
  };
}
type OpenDetail = {
  snapshot?: Snapshot;
  eventId?: string;
  matchId?: string;
  outcome?: string;
  registration?: boolean;
  member?: boolean;
  loadout?: string;
  tools?: boolean;
};
export function SportsbookBridge() {
  const [open, setOpen] = useState<OpenDetail | null>(null);
  const [scroll, setScroll] = useState<{ host: HTMLElement; eventId: string } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [registrationReady, setRegistrationReady] = useState(false);
  const [memberSignedIn, setMemberSignedIn] = useState(false);
  const toolsTrigger = useRef<HTMLElement | null>(null);
  const loadoutTrigger = useRef<HTMLAnchorElement | null>(null);
  const loadoutContinue = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => {
    if (open?.loadout && memberSignedIn) loadoutContinue.current?.focus({ preventScroll: true });
  }, [open?.loadout, memberSignedIn]);
  const resolvedRegistration = useRef('');
  const resolvedCallback = useRef((id: string) => {
    resolvedRegistration.current = id;
  });
  useLayoutEffect(() => {
    if (!scroll) return;
    const desk = scroll.host.parentElement;
    if (desk) desk.dataset.expanded = String(expanded && registrationReady);
    document
      .getElementById('register-cta')
      ?.setAttribute('aria-busy', String(expanded && !registrationReady));
    // Focus only after React hides the form, so revealing the invitation cannot expand the layout.
    if (!expanded) document.getElementById('register-cta')?.focus({ preventScroll: true });
    return () => {
      if (desk) delete desk.dataset.expanded;
    };
  }, [scroll, expanded, registrationReady]);
  useEffect(() => {
    let active = true,
      version = 0;
    let returnedToRegistration = false;
    let signedIn = false;
    const update = async () => {
      const v = ++version;
      try {
        const s = await readState();
        if (!active || v !== version) return;
        const u = s.members.find((m) => m.id === session() && !m.anonymous);
        signedIn = !!u;
        setMemberSignedIn(!!u);
        document.querySelectorAll<HTMLElement>('[data-my-loadout-label]').forEach((n) => {
          n.textContent = u ? '設定我的武學配置' : '登入並設定';
        });
        document.querySelectorAll<HTMLElement>('[data-my-loadout-description]').forEach((n) => {
          n.textContent = u
            ? '設定你的武學、武器與裝備，完成配置再帶回報名資料。'
            : '登入後設定你的武學、武器與裝備，完成配置再帶回報名資料。';
        });
        document.querySelectorAll<HTMLElement>('[data-member-label]').forEach((n) => {
          n.textContent = u ? u.name : '會員專區';
        });
        document.querySelectorAll<HTMLElement>('[data-sports-member]').forEach((n) => {
          n.textContent = u ? `${u.name} · ${money(u.balance)} 點` : '登入領 1,000 點';
          n.title = n.textContent;
        });
        const id = new URL(location.href).searchParams.get('sportsEvent');
        if (id) {
          const e = s.events.find((e) => e.id === id);
          if (e) window.__LUNJIAN?.applySportsbookEvent?.(present(e));
          const params = new URLSearchParams(location.search);
          const host = document.getElementById('registration-inline');
          if (
            !returnedToRegistration &&
            e &&
            host &&
            u &&
            params.has('loadoutRole') &&
            params.get('artsUser') === u.id &&
            location.hash === '#register'
          ) {
            returnedToRegistration = true;
            setScroll({ host, eventId: id });
            setExpanded(true);
          }
        }
      } catch {
        /* The center exposes database failures with retry. */
      }
    };
    const show = (e: Event) => {
      const detail = (e as CustomEvent<OpenDetail>).detail;
      setOpen(detail || {});
    };
    const showTools = (event: MouseEvent) => {
      const button = (event.target as Element).closest<HTMLElement>('[data-match-tools]');
      if (!button) return;
      toolsTrigger.current = button.closest('details')?.querySelector('summary') || button;
      toolsTrigger.current.focus({ preventScroll: true });
      setOpen({ tools: true });
    };
    const configureLoadout = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element).closest<HTMLAnchorElement>('[data-my-loadout]');
      if (!link || signedIn) return;
      event.preventDefault();
      loadoutTrigger.current = link;
      const url = new URL(link.href);
      setOpen({ member: true, loadout: url.pathname + url.search });
    };
    const register = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element).closest<HTMLAnchorElement>(
        '[data-registration-entry]',
      );
      if (!link) return;
      event.preventDefault();
      const eventId = new URL(link.href).searchParams.get('event') || '';
      const host = document.getElementById('registration-inline');
      if (host && link.id === 'register-cta') {
        setScroll((old) =>
          old &&
          old.host === host &&
          (old.eventId === eventId || resolvedRegistration.current === eventId)
            ? old
            : { host, eventId },
        );
        setExpanded(true);
      } else setOpen({ registration: true, eventId });
    };
    const select = (message: Event) => {
      const id = (message as CustomEvent<{ eventId: string }>).detail.eventId;
      const url = new URL(location.href);
      url.searchParams.set('preview', '1');
      url.searchParams.set('sportsEvent', id);
      history.replaceState(null, '', url);
      void update();
    };
    let enteredRegistration = false;
    const enterRegistration = () => {
      if (location.hash !== '#register') {
        enteredRegistration = false;
        return;
      }
      if (enteredRegistration) return;
      const host = document.getElementById('registration-inline');
      if (!host) return;
      enteredRegistration = true;
      const eventId = new URL(location.href).searchParams.get('sportsEvent') || '';
      setScroll((old) => (old?.host === host && old.eventId === eventId ? old : { host, eventId }));
      setExpanded(true);
    };
    const enterFromLink = (event: MouseEvent) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
      if (link && new URL(link.href).hash === '#register')
        queueMicrotask(() => {
          if (active) enterRegistration();
        });
    };
    document.addEventListener('click', enterFromLink);
    document.addEventListener('lunjian:chapter-change', enterRegistration);
    window.addEventListener('hashchange', enterRegistration);
    document.addEventListener('lunjian:ready', enterRegistration);
    enterRegistration();
    document.addEventListener('lunjian:sports-select', select);
    document.addEventListener('click', register);
    document.addEventListener('click', configureLoadout);
    document.addEventListener('click', showTools);
    const refresh = () => void update();
    document.addEventListener('lunjian:sports-open', show);
    document.addEventListener('lunjian:ready', refresh);
    window.addEventListener('lunjian:sports-session', refresh);
    window.addEventListener('focus', refresh);
    const off = subscribe(refresh);
    refresh();
    return () => {
      document.removeEventListener('click', enterFromLink);
      document.removeEventListener('lunjian:chapter-change', enterRegistration);
      window.removeEventListener('hashchange', enterRegistration);
      document.removeEventListener('lunjian:ready', enterRegistration);
      active = false;
      off();
      document.removeEventListener('lunjian:sports-select', select);
      document.removeEventListener('click', register);
      document.removeEventListener('click', configureLoadout);
      document.removeEventListener('click', showTools);
      document.removeEventListener('lunjian:sports-open', show);
      document.removeEventListener('lunjian:ready', refresh);
      window.removeEventListener('lunjian:sports-session', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return (
    <>
      {scroll &&
        createPortal(
          <RegistrationScroll expanded={expanded && registrationReady}>
            <RegistrationEntry
              eventId={scroll.eventId}
              embedded
              scrollForm
              onResolved={resolvedCallback.current}
              onReady={setRegistrationReady}
            />
          </RegistrationScroll>,
          scroll.host,
        )}
      {open ? (
        <Modal
          title={
            open.tools
              ? '對局小工具'
              : open.loadout
                ? '我的武學配置'
                : open.member
                  ? '會員專區'
                  : open.registration
                    ? '百業試鋒 · 報名表'
                    : '觀局雅集'
          }
          returnFocus={() =>
            open.tools
              ? toolsTrigger.current
              : open.loadout
                ? loadoutTrigger.current
                : document.querySelector<HTMLElement>(
                    open.member ? '[data-sports-center]' : '#duel [data-duel-center]',
                  )
          }
          paper={!open.tools && !open.member && !open.registration}
          wide={!open.tools && (!open.member || memberSignedIn)}
          onClose={() => setOpen(null)}
        >
          {open.tools ? (
            <MatchTools />
          ) : open.loadout && memberSignedIn ? (
            <div className={styles.app}>
              <p role="status">已登入，可以開始設定你的武學、武器與裝備。</p>
              <a
                ref={loadoutContinue}
                className={`${styles.primary} ${styles.loadoutContinue}`}
                href={open.loadout}
              >
                前往我的武學配置 <span aria-hidden="true">→</span>
              </a>
            </div>
          ) : open.registration ? (
            <RegistrationEntry eventId={open.eventId} embedded />
          ) : (
            <Sportsbook
              key={open.member ? 'member' : `arena:${open.eventId || ''}:${open.matchId || ''}`}
              memberOnly={!!open.member}
              authPurpose={open.loadout ? 'loadout' : undefined}
              embedded
              sourceSnapshot={open.snapshot}
              initialEventId={open.eventId}
              initialMatchId={open.matchId}
              initialOutcome={open.outcome}
            />
          )}
        </Modal>
      ) : null}
    </>
  );
}
