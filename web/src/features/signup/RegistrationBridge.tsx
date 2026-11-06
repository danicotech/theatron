'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SportsbookBridge } from '../sportsbook/SportsbookBridge';
import { RegistrationScroll } from '../sportsbook/RegistrationScroll';
import { SignupPage } from './SignupPage';

/** Formal home uses the same form as /t/:slug/signup. Demo remains explicitly selected. */
export function RegistrationBridge() {
  const [demo, setDemo] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [opened, setOpened] = useState(false);
  const slug = (process.env.NEXT_PUBLIC_TOURNAMENT_SLUG ?? '').trim();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('preview') === '1' || params.has('sportsEvent')) {
      setDemo(true);
      return;
    }
    const controller = new AbortController();
    const ready = () => {
      setHost(document.getElementById('registration-inline'));
      document.querySelectorAll('[data-member-label]').forEach((el) => {
        el.textContent = '會員專區';
      });
      document.querySelectorAll('[data-sports-member]').forEach((el) => {
        el.textContent = '報名・武庫';
      });
    };
    const enter = () => {
      if (slug && location.hash === '#register') {
        setOpened(true);
        setExpanded(true);
      }
    };
    document.addEventListener('lunjian:chapter-change', enter, { signal: controller.signal });
    document.addEventListener('lunjian:ready', enter, { signal: controller.signal });
    window.addEventListener('hashchange', enter, { signal: controller.signal });
    ready();
    enter();
    document.addEventListener('lunjian:ready', ready, { signal: controller.signal });
    document.addEventListener(
      'click',
      (event) => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
          return;
        const target = event.target instanceof Element ? event.target : null;
        const entry = target?.closest<HTMLAnchorElement>('#register-cta');
        if (
          entry &&
          slug &&
          new URL(entry.href).pathname === `/t/${encodeURIComponent(slug)}/enroll`
        ) {
          event.preventDefault();
          setOpened(true);
          setExpanded(true);
        }
        if (target?.closest('[data-match-tools]')) {
          event.preventDefault();
          event.stopImmediatePropagation();
          location.assign('/tools');
          return;
        }
        if (target?.closest('[data-sports-center]') && slug) {
          event.preventDefault();
          event.stopImmediatePropagation();
          location.assign(`/t/${encodeURIComponent(slug)}/me`);
        }
      },
      { capture: true, signal: controller.signal },
    );
    return () => controller.abort();
  }, [slug]);
  useEffect(() => {
    if (!host?.parentElement) return;
    const desk = host.parentElement;
    desk.dataset.expanded = String(expanded);
    return () => {
      delete desk.dataset.expanded;
    };
  }, [host, expanded]);
  if (demo) return <SportsbookBridge />;
  if (!host || !slug) return null;
  return createPortal(
    <RegistrationScroll expanded={expanded}>
      {opened ? <SignupPage slug={slug} /> : null}
    </RegistrationScroll>,
    host,
  );
}
