'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function HomeNavigation({ revision }: { revision: string }) {
  const router = useRouter();
  useEffect(() => {
    const lifetime = new AbortController();
    const handle = (event: Event) => {
      const { href, prefetch } = (event as CustomEvent<{ href: string; prefetch?: boolean }>)
        .detail;
      const url = new URL(href, location.href);
      if (url.origin !== location.origin || url.pathname !== '/home') return;
      if (prefetch) router.prefetch(href);
      else router.push(href, { scroll: false });
    };
    document.addEventListener('lunjian:home-navigate', handle, { signal: lifetime.signal });
    const script = document.createElement('script');
    script.type = 'module';
    script.id = 'home-navigation-mount';
    const token = crypto.randomUUID();
    script.dataset.token = token;
    script.textContent = `import {mountHomeReturn} from '/lunjian/home-return.js?v=${encodeURIComponent(revision)}';if(document.getElementById('home-navigation-mount')?.dataset.token===${JSON.stringify(token)}){const controller=new AbortController();document.addEventListener('lunjian:navigation-unmount',e=>{if(e.detail===${JSON.stringify(token)})controller.abort();},{once:true});const send=(href,prefetch=false)=>document.dispatchEvent(new CustomEvent('lunjian:home-navigate',{detail:{href,prefetch}}));mountHomeReturn({navigate:href=>send(href),prefetch:href=>send(href,true)},controller.signal);}`;
    document.body.append(script);
    return () => {
      lifetime.abort();
      document.dispatchEvent(new CustomEvent('lunjian:navigation-unmount', { detail: token }));
      script.remove();
    };
  }, [revision, router]);
  return null;
}
