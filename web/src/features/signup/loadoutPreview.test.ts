import { describe, expect, it } from 'vitest';
import catalog from '../../../public/loadout/data/catalog.json';
import sample from '../../../public/loadout/data/sample-95.json';
import { loadoutPreview, readPreviewData } from './loadoutPreviewModel';
import type { SavedRole } from '../sportsbook/registrationRolesRuntime.js';

const character = {
  style: '裂石鈞',
  weapon: '主 陌刀｜副 橫刀',
  equipment: '無',
  arts: '武學　十方破陣｜斬雪刀法\n心法　穿喉決（主修）\n屬性　最大裂石攻擊 41.3',
};
describe('visual loadout projection', () => {
  it('keeps an off-hand-only selection in its actual slot', () => {
    const preview = loadoutPreview(catalog, { ...character, weapon: '副 劍' });
    expect(preview.weapon.map((x) => [x.caption, x.name])).toEqual([
      ['主武器', '待配置'],
      ['副武器', '劍'],
    ]);
  });
  it('maps both weapons and the selected manuals without treating stats as arts', () => {
    const preview = loadoutPreview(catalog, character);
    expect(preview.style[0]?.image).toContain('LIESHI_JUN');
    expect(preview.weapon.map((x) => x.name)).toEqual(['陌刀', '橫刀']);
    expect(preview.weapon.every((x) => x.image?.startsWith('/loadout/assets/'))).toBe(true);
    expect(preview.martials).toHaveLength(2);
    expect(preview.minds.find((x) => x.main)?.name).toBe('穿喉決');
    expect(preview.arts).toHaveLength(0);
    const withArts = loadoutPreview(catalog, {
      ...character,
      arts: character.arts + '\n奇術　葉龍驤首',
    });
    expect(withArts.arts.map((x) => x.name)).toEqual(['葉龍驤首']);
  });
  it('only displays equipped items, never unused inventory', () => {
    const preview = loadoutPreview(catalog, character, {
      vault: [
        { id: 'a', k: 'EQUIPMENT_HEAD', label: '參賽冠胄' },
        { id: 'b', k: 'EQUIPMENT_CLOTH', label: '倉庫備品' },
      ],
      equip: { head: 'a' },
    });
    expect(preview.equipment.find((x) => x.caption === '冠胄')?.name).toBe('參賽冠胄');
    expect(preview.equipment.some((x) => x.name === '倉庫備品')).toBe(false);
  });
  it('preserves old confirmed summaries and rejects unsafe image URLs', () => {
    const preview = loadoutPreview(
      { builds: [{ name: '裂石鈞', img: '../../remote.png' }] },
      { ...character, equipment: '時雨套裝' },
    );
    expect(preview.style[0]?.image).toBeUndefined();
    expect(preview.equipment[0]?.name).toBe('時雨套裝');
  });
  it('keeps event and personal roles with the same id separate', () => {
    const role: SavedRole = { id: '1', source: 'event', name: '測試', character, ready: true };
    const storage = {
      getItem: (key: string) =>
        JSON.stringify({
          roles: [{ id: 1, data: { build: key.includes('.local.') ? 'event' : 'library' } }],
        }),
    };
    expect(readPreviewData(storage, role, 'spring', 'member')).toEqual({ build: 'event' });
    expect(readPreviewData(storage, { ...role, source: 'library' }, 'spring', 'member')).toEqual({
      build: 'library',
    });
  });
  it('resolves summary weapon images with set and level suffixes', () => {
    const preview = loadoutPreview(catalog, {
      ...character,
      weapon: '主 陌刀 95級｜副 橫刀・燕歸 95級',
    });
    expect(preview.weapon.every((x) => x.image?.startsWith('/loadout/assets/'))).toBe(true);
    expect(preview.weapon.every((x) => x.gear === undefined)).toBe(true);
  });
  it('projects all six affixes and the base stats from the equipped item, including zero values', () => {
    const source = sample.vault[0]!;
    const preview = loadoutPreview(catalog, character, {
      vault: [{ ...source, label: '測試武器', q: 'purple', first: [source.first[0], 0] }],
      equip: { w_off: source.id },
    });
    const off = preview.weapon[1]!;
    expect(off.name).toBe('測試武器');
    expect(off.image).toContain('EQUIPMENT_WEAPON_SWORD');
    expect(off.gear?.level).toBe(95);
    expect(off.gear?.quality).toBe('紫');
    expect(off.gear?.affixes).toHaveLength(6);
    expect(off.gear?.filled).toBe(6);
    expect(off.gear?.affixes[0]?.value).toBe('0');
    const base = catalog.gearBase.find((x) => x.key === source.k)!;
    expect(off.gear?.base[0]?.value).toBe(String(base.purple[0]!.v));
    expect(preview.weapon[0]?.gear).toBeUndefined();
  });
});
