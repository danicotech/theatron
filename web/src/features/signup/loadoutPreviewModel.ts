import { loadoutStorageKey, type SavedRole } from '../sportsbook/registrationRolesRuntime.js';

type Row = Record<string, unknown>;
export type PreviewStat = { name: string; value: string; kind?: 'pitch' };
export type PreviewItem = {
  name: string;
  image?: string;
  caption?: string;
  main?: boolean;
  gear?: {
    quality: string;
    hideSummary?: boolean;
    level?: number;
    set?: string;
    base: PreviewStat[];
    affixes: PreviewStat[];
    filled: number;
    score: string;
  };
};
export type Preview = {
  style: PreviewItem[];
  weapon: PreviewItem[];
  equipment: PreviewItem[];
  martials: PreviewItem[];
  minds: PreviewItem[];
  arts: PreviewItem[];
};
const record = (value: unknown): Row => (value && typeof value === 'object' ? (value as Row) : {});
const rows = (value: unknown): Row[] => (Array.isArray(value) ? value.map(record) : []);
const text = (value: unknown) => (typeof value === 'string' ? value : '');
function image(value: unknown) {
  const path = text(value);
  return /^[\w/-]+\.(png|webp)$/.test(path) && !path.includes('..')
    ? '/loadout/assets/' + path
    : undefined;
}
function item(meta: Row | undefined, name: string, caption?: string): PreviewItem {
  const src = image(meta?.img);
  return { name, ...(src ? { image: src } : {}), ...(caption ? { caption } : {}) };
}

const number = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const format = (value: number, percent?: unknown) =>
  (Math.round(value * 10) / 10).toFixed(Number.isInteger(value) ? 0 : 1) + (percent ? '%' : '');

function gearItem(c: Row, equipped: Row, caption: string): PreviewItem {
  const meta = rows(c.gearBase).find((entry) => entry.key === equipped.k);
  const weapon = rows(c.weapons).find((entry) => entry.key === equipped.k);
  const quality = equipped.q === 'purple' ? 'purple' : 'gold';
  const secondary: unknown[] = Array.isArray(equipped.sec) ? equipped.sec : [];
  const entries = [
    equipped.first,
    ...Array.from({ length: 4 }, (_, i) => secondary[i]),
    equipped.pitch,
  ];
  let filled = 0,
    got = 0,
    full = 0;
  const affixes = entries.map((entry, i): PreviewStat => {
    const pair: unknown[] = Array.isArray(entry) ? entry : [];
    const stat = rows(i === 5 ? c.pitches : c.tunings).find((row) => row.key === pair[0]);
    const value = pair[1];
    if (stat && number(value)) {
      filled++;
      got += value;
      full += number(stat.max) ? stat.max : 0;
    }
    return {
      name:
        text(stat?.name) || (i === 0 ? '首詞條未填' : i === 5 ? '定音未填' : `副詞條 ${i} 未填`),
      value: stat && number(value) ? format(value, stat.pct) : '—',
      ...(i === 5 ? { kind: 'pitch' as const } : {}),
    };
  });
  return {
    ...item(
      meta ?? weapon,
      text(equipped.label) || text(meta?.name) || text(weapon?.name) || caption,
      caption,
    ),
    gear: {
      quality: quality === 'purple' ? '紫' : '金',
      ...(number(equipped.tier) && equipped.tier > 0 ? { level: equipped.tier } : {}),
      set: text(rows(c.sets).find((row) => row.key === equipped.set)?.name),
      base: rows(meta?.[quality])
        .filter((row) => number(row.v))
        .map((row) => ({ name: text(row.n), value: format(row.v as number, row.pct) })),
      affixes,
      filled,
      score: full > 0 ? ((got / full) * 100).toFixed(1) + '%' : '—',
    },
  };
}

/** Read-only projection: never changes the role, confirmed snapshot or enrollment payload. */
export function loadoutPreview(
  catalog: unknown,
  character: SavedRole['character'],
  data?: unknown,
): Preview {
  const c = record(catalog),
    stored = record(data);
  const find = (group: string, name: string) => rows(c[group]).find((x) => x.name === name);
  const style = character.style ? [item(find('builds', character.style), character.style)] : [];
  const selectedWeapons = character.weapon
    .split('｜')
    .filter(Boolean)
    .map((value, index) => {
      const name = value.replace(/^(主|副)\s*/, '').trim();
      const caption = /^副/.test(value.trim())
        ? '副武器'
        : /^主/.test(value.trim()) || index === 0
          ? '主武器'
          : '副武器';
      // Serialized summaries include a set and level after the weapon name.
      const meta = rows(c.weapons)
        .filter((entry) => name.startsWith(text(entry.name)) && text(entry.name))
        .sort((a, b) => text(b.name).length - text(a.name).length)[0];
      return item(meta, name, caption);
    });
  const vault = rows(stored.vault),
    equip = record(stored.equip);
  const weapon = ['主武器', '副武器'].map((caption, index) => {
    const equipped = vault.find((entry) => entry.id === equip[index === 0 ? 'w_main' : 'w_off']);
    return equipped
      ? gearItem(c, equipped, caption)
      : (selectedWeapons.find((entry) => entry.caption === caption) ?? { name: '待配置', caption });
  });
  const equipment =
    !data && character.equipment && character.equipment !== '無'
      ? [{ name: character.equipment, caption: '已確認配置' }]
      : rows(c.gearSlots).map((slot) => {
          const equipped = vault.find((entry) => entry.id === equip[text(slot.id)]);
          if (!equipped) return { name: '未裝備', caption: text(slot.name) };
          return gearItem(c, equipped, text(slot.name));
        });
  const books: Pick<Preview, 'martials' | 'minds' | 'arts'> = { martials: [], minds: [], arts: [] };
  for (const line of character.arts.split('\n')) {
    const match = /^(武學|心法|奇術)\s+(.+)$/.exec(line);
    if (!match) continue;
    const group = match[1] === '武學' ? 'martials' : match[1] === '心法' ? 'minds' : 'arts';
    for (const value of match[2]!.split('｜')) {
      const candidates = rows(c[group]).filter((meta) => value.trim().startsWith(text(meta.name)));
      const meta = candidates.sort((a, b) => text(b.name).length - text(a.name).length)[0];
      const name = text(meta?.name) || value.replace(/（主修）/g, '').trim();
      if (name) books[group].push({ ...item(meta, name), main: value.includes('主修') });
    }
  }
  return { style, weapon, equipment, ...books };
}

export function readPreviewData(
  storage: Pick<Storage, 'getItem'>,
  role: SavedRole,
  slug: string,
  memberId: string,
): unknown {
  try {
    const saved = record(
      JSON.parse(storage.getItem(loadoutStorageKey(slug, memberId, role.source)) ?? '{}'),
    );
    return rows(saved.roles).find((entry) => String(entry.id) === role.id)?.data;
  } catch {
    return undefined;
  }
}
