import type { Preview } from './loadoutPreviewModel';
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const array = (value: unknown): value is unknown[] => Array.isArray(value);

/** A detached display snapshot, not the editable role or its unequipped warehouse. */
export function serializeLoadoutSnapshot(preview: Preview): string {
  return JSON.stringify({ version: 1, preview });
}

export function readLoadoutSnapshot(raw?: string): Preview | undefined {
  if (!raw || raw.length > 65536) return;
  try {
    const snapshot: unknown = JSON.parse(raw);
    if (!record(snapshot) || snapshot.version !== 1 || !record(snapshot.preview)) return;
    const groups = { style: 1, weapon: 2, equipment: 6, martials: 2, minds: 4, arts: 4 };
    const text = (value: unknown, limit = 200) =>
      typeof value === 'string' && value.length <= limit;
    const optionalText = (value: unknown) => value === undefined || text(value);
    for (const [key, max] of Object.entries(groups)) {
      const items = snapshot.preview[key];
      if (!array(items) || items.length > max) return;
      for (const item of items) {
        if (!record(item) || !text(item.name) || !optionalText(item.caption)) return;
        if (
          item.image !== undefined &&
          (typeof item.image !== 'string' ||
            !/^\/loadout\/assets\/[\w/-]+\.(png|webp)$/.test(item.image))
        )
          return;
        if (item.main !== undefined && typeof item.main !== 'boolean') return;
        if (item.gear) {
          const g = item.gear;
          if (!record(g) || typeof g.filled !== 'number') return;
          if (
            !['weapon', 'equipment'].includes(key) ||
            !text(g.quality) ||
            !text(g.score) ||
            !optionalText(g.set) ||
            !Number.isInteger(g.filled) ||
            g.filled < 0 ||
            g.filled > 6
          )
            return;
          if (
            g.level !== undefined &&
            (typeof g.level !== 'number' ||
              !Number.isFinite(g.level) ||
              g.level < 0 ||
              g.level > 1000)
          )
            return;
          for (const [stats, maxRows] of [
            [g.base, 8],
            [g.affixes, 6],
          ] as const) {
            if (!array(stats) || stats.length > maxRows) return;
            for (const stat of stats)
              if (
                !record(stat) ||
                !text(stat.name) ||
                !text(stat.value) ||
                (stat.kind !== undefined && stat.kind !== 'pitch')
              )
                return;
          }
        }
      }
    }
    return snapshot.preview as unknown as Preview;
  } catch {
    return;
  }
}
