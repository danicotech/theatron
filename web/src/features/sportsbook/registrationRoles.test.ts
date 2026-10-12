import { readFileSync } from 'node:fs';
import { beforeEach, expect, it } from 'vitest';
import { loadoutStorageKey, readRegistrationRoles } from './registrationRolesRuntime.js';
const catalog = JSON.parse(readFileSync('web/public/loadout/data/catalog.json', 'utf8')) as {
  builds: { key: string; name: string }[];
};
const build = catalog.builds[0]!;
beforeEach(() => localStorage.clear());
const put = (key: string, name: string) =>
  localStorage.setItem(
    key,
    JSON.stringify({ v: 3, roles: [{ id: 1, name, data: { v: 3, build: build.key } }] }),
  );
it('只列出同會員同活動與本機角色庫，一次投影完整四欄', () => {
  put(loadoutStorageKey('e', 'u'), '此活動角色');
  put(loadoutStorageKey('other', 'u'), '其他活動');
  put(loadoutStorageKey('e', 'other'), '其他會員');
  put('lunjian.loadout.v3', '本機角色');
  const roles = readRegistrationRoles(localStorage, catalog, 'e', 'u');
  expect(roles.map((r) => r.name)).toEqual(['此活動角色', '本機角色']);
  expect(roles[0]!.character.style).toBe(build.name);
  expect(roles[0]!.character.weapon).toContain('主 ');
  expect(roles[0]!.character.equipment).toBe('無');
  expect(roles[0]!.character.arts).toContain('武學');
  expect(roles[0]!.ready).toBe(true);
  expect(readRegistrationRoles(localStorage, catalog, 'e', '')).toEqual([]);
});
it('尚未配置的角色不能套用；損壞角色不阻斷其他角色', () => {
  localStorage.setItem(
    loadoutStorageKey('e', 'u'),
    JSON.stringify({
      v: 3,
      roles: [
        { id: 1, name: '空白', data: { v: 3 } },
        { id: 2, name: '損壞', data: { minds: 123 } },
        { id: 3, name: '完成', data: { v: 3, build: build.key } },
      ],
    }),
  );
  const roles = readRegistrationRoles(localStorage, catalog, 'e', 'u');
  expect(roles.map((r) => r.ready)).toEqual([false, true]);
});
it('儲存失敗或損壞資料顯示錯誤，不當成沒有角色', () => {
  localStorage.setItem(loadoutStorageKey('e', 'u'), '{bad');
  expect(() => readRegistrationRoles(localStorage, catalog, 'e', 'u')).toThrow('無法讀取');
  expect(() =>
    readRegistrationRoles(
      {
        getItem() {
          throw new Error('拒絕讀取');
        },
      },
      catalog,
      'e',
      'u',
    ),
  ).toThrow('拒絕讀取');
});
