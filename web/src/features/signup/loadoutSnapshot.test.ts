import { expect, it } from 'vitest';
import { loadoutPreview } from './loadoutPreviewModel';
import { readLoadoutSnapshot, serializeLoadoutSnapshot } from './loadoutSnapshot';

it('detaches equipped values at confirmation and excludes unequipped warehouse data', () => {
  const data = {
    equip: { w_main: 'equipped' },
    vault: [
      { id: 'equipped', k: 'sword', label: '參賽劍', first: ['attack', 114.1] },
      { id: 'private', k: 'sword', label: '私人倉庫項目', first: ['attack', 999] },
    ],
  };
  const catalog = {
    gearBase: [{ key: 'sword', gold: [{ n: '基礎攻擊', v: 232 }] }],
    tunings: [{ key: 'attack', name: '最大外功攻擊', max: 120 }],
    gearSlots: [],
  };
  const snapshot = serializeLoadoutSnapshot(
    loadoutPreview(catalog, { style: '裂石鈞', weapon: '劍', equipment: '', arts: '' }, data),
  );
  data.vault[0]!.first = ['attack', 1];
  data.vault[0]!.label = '後來修改的劍';
  expect(snapshot).not.toContain('私人倉庫');
  const restored = readLoadoutSnapshot(snapshot)!;
  expect(restored.weapon[0]!.name).toBe('參賽劍');
  expect(restored.weapon[0]!.gear!.affixes[0]!.value).toBe('114.1');
  expect(restored.weapon[0]!.gear!.base[0]!.value).toBe('232');
});
it('rejects invalid versions and unsafe artwork while permitting legacy summaries', () => {
  expect(readLoadoutSnapshot()).toBeUndefined();
  expect(readLoadoutSnapshot('{"version":2}')).toBeUndefined();
  const preview = loadoutPreview({}, { style: '測試', weapon: '', equipment: '', arts: '' });
  preview.style[0]!.image = 'https://example.com/private.png';
  expect(readLoadoutSnapshot(serializeLoadoutSnapshot(preview))).toBeUndefined();
});
