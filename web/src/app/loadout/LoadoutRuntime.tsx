'use client';

import { useEffect } from 'react';
import { LOADOUT_VERSION } from './loadoutMarkup';

export function LoadoutRuntime() {
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'module';
    script.id = 'loadout-mount';
    const slug = (process.env.NEXT_PUBLIC_TOURNAMENT_SLUG ?? '').trim();
    script.textContent = `import { mountLoadout } from '/loadout/loadout.js?v=${LOADOUT_VERSION}'; if (document.getElementById('loadout-mount')) mountLoadout({slug:${JSON.stringify(slug)}});`;
    document.body.appendChild(script);
    return () => {
      script.remove();
      window.__LOADOUT?.destroy();
    };
  }, []);
  return null;
}
