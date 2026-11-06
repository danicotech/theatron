'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LoadoutPreview } from './LoadoutPreview';
import { readLoadoutSnapshot } from './loadoutSnapshot';
import { loadoutPreview, type Preview, type PreviewItem } from './loadoutPreviewModel';

type DemoItem = { name: string; image?: string; note?: string; stats?: [string, string][] };
export type DossierProfile = {
  build?: { name: string; image: string };
  sections: { kind: string; items: DemoItem[] }[];
};
type Detail = {
  host: HTMLElement;
  character?: {
    style: string;
    weapon: string;
    equipment: string;
    arts: string;
    snapshotJson?: string;
  };
  profile?: DossierProfile;
};

/** Only projects the public/demo payload. Never reads the viewer's private armory. */
export function dossierPreview(profile: DossierProfile): Preview {
  const result: Preview = {
    style: profile.build ? [profile.build] : [],
    weapon: [],
    equipment: [],
    martials: [],
    minds: [],
    arts: [],
  };
  for (const section of profile.sections) {
    for (const entry of section.items) {
      const item: PreviewItem = {
        name: entry.name,
        ...(entry.image ? { image: entry.image } : {}),
        ...(entry.note ? { caption: entry.note } : {}),
        main: !!entry.note?.includes('主修'),
      };
      if (section.kind === 'equipment') {
        const weapon = entry.image?.includes('EQUIPMENT_WEAPON_');
        item.caption = weapon ? (result.weapon.length ? '副武器' : '主武器') : (entry.note ?? '');
        const level = /([0-9]+)\s*級/.exec(entry.note ?? '');
        const rows = (entry.stats ?? []).map(([name, value]) => ({ name, value }));
        item.gear = {
          quality: '',
          ...(level ? { level: Number(level[1]) } : {}),
          base: rows.slice(0, 2),
          affixes: rows.slice(2),
          filled: 0,
          score: '',
          hideSummary: true,
        };
        result[weapon ? 'weapon' : 'equipment'].push(item);
      } else {
        const key =
          section.kind === 'martial' ? 'martials' : section.kind === 'mind' ? 'minds' : 'arts';
        result[key].push(item);
      }
    }
  }
  return result;
}

export function DossierLoadoutBridge() {
  const [entry, setEntry] = useState<{
    host: HTMLElement;
    preview?: Preview;
    error?: boolean;
  } | null>(null);
  useEffect(() => {
    let request: AbortController | undefined;
    const open = (event: Event) => {
      const { host, character, profile } = (event as CustomEvent<Detail>).detail;
      if (!host || (!character && !profile)) return;
      event.preventDefault();
      request?.abort();
      const confirmed = readLoadoutSnapshot(character?.snapshotJson);
      if (confirmed) {
        setEntry({ host, preview: confirmed });
        return;
      }
      if (profile && !character) {
        setEntry({ host, preview: dossierPreview(profile) });
        return;
      }
      const controller = new AbortController();
      request = controller;
      setEntry({ host });
      void fetch('/loadout/data/catalog.json', { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error('catalog unavailable');
          const catalog: unknown = await response.json();
          if (!controller.signal.aborted)
            setEntry({ host, preview: loadoutPreview(catalog, character!) });
        })
        .catch(() => {
          if (!controller.signal.aborted) setEntry({ host, error: true });
        });
    };
    const close = () => {
      request?.abort();
      setEntry(null);
    };
    document.addEventListener('lunjian:dossier-loadout', open);
    document.addEventListener('lunjian:dossier-close', close);
    return () => {
      request?.abort();
      document.removeEventListener('lunjian:dossier-loadout', open);
      document.removeEventListener('lunjian:dossier-close', close);
    };
  }, []);
  if (!entry) return null;
  return createPortal(
    entry.preview ? (
      <LoadoutPreview preview={entry.preview} />
    ) : (
      <p role={entry.error ? 'alert' : 'status'}>
        {entry.error ? '配置暫時無法讀取，請重新開啟選手資料。' : '正在讀取配置…'}
      </p>
    ),
    entry.host,
  );
}
