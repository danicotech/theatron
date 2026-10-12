'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export function HomeRuntime({ revision }: { revision: string }) {
  const router = useRouter();
  useEffect(() => {
    const lifetime = new AbortController();
    const query = new URLSearchParams(location.search);
    document.querySelectorAll<HTMLAnchorElement>('.baiye-home a[href^="/#"]').forEach((a) => {
      const u = new URL(a.href);
      for (const key of ['sportsEvent', 'slug', 'preview']) {
        const value = query.get(key);
        if (value) u.searchParams.set(key, value);
      }
      a.href = u.href;
    });
    const chapterLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('.baiye-home a[href]'),
    ).filter(
      (a) =>
        new URL(a.href).origin === location.origin &&
        new URL(a.href).pathname === '/' &&
        new URL(a.href).hash,
    );
    for (const href of new Set(chapterLinks.map((a) => a.pathname + a.search)))
      router.prefetch(href);
    for (const anchor of chapterLinks)
      anchor.addEventListener(
        'click',
        (event) => {
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          document.dispatchEvent(new Event('lunjian:home-handoff'));
          router.push(anchor.pathname + anchor.search + anchor.hash, { scroll: false });
        },
        { signal: lifetime.signal },
      );
    const button = document.querySelector('[data-sports-center]');
    const open = () =>
      document.dispatchEvent(
        new CustomEvent('lunjian:sports-open', {
          detail: { member: true, eventId: query.get('sportsEvent') || undefined },
        }),
      );
    button?.addEventListener('click', open, { signal: lifetime.signal });
    const menu = document.querySelector<HTMLDetailsElement>('.nav-more');
    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape' && menu?.open) {
          menu.open = false;
          menu.querySelector('summary')?.focus();
        }
      },
      { signal: lifetime.signal },
    );
    document.addEventListener(
      'click',
      (e) => {
        if (menu && !menu.contains(e.target as Node)) menu.open = false;
      },
      { signal: lifetime.signal },
    );
    const module = document.createElement('script');
    module.type = 'module';
    module.id = 'home-stage-mount';
    const token = crypto.randomUUID();
    module.dataset.token = token;
    module.textContent = `import {mountHomeStage} from '/lunjian/home-stage.js?v=${encodeURIComponent(revision)}';if(document.getElementById('home-stage-mount')?.dataset.token===${JSON.stringify(token)}){const controller=new AbortController();document.addEventListener('lunjian:home-unmount',e=>{if(e.detail===${JSON.stringify(token)})controller.abort();},{once:true});mountHomeStage(document.getElementById('home-world'),controller.signal);}`;
    document.body.appendChild(module);
    return () => {
      lifetime.abort();
      document.dispatchEvent(new CustomEvent('lunjian:home-unmount', { detail: token }));
      module.remove();
    };
  }, [revision, router]);
  return null;
}
