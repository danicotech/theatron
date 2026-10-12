// Generated from lab/registration-roles.js; do not edit.
import {fromJSON, indexOf, enrollmentCharacter} from './loadoutNoteRuntime.js';

export function loadoutStorageKey(eventId, userId, source = 'event') {
  return source === 'library' ? 'lunjian.loadout.v3' : 'lunjian.loadout.v3.local.' + encodeURIComponent(eventId) + '.' + encodeURIComponent(userId);
}
export function readRegistrationRoles(storage, catalog, eventId, userId) {
  if (!eventId || !userId) return [];
  const idx = indexOf(catalog), roles = [];
  for (const source of ['event', 'library']) {
    const raw = storage.getItem(loadoutStorageKey(eventId, userId, source));
    if (!raw) continue;
    let saved;
    try { saved = JSON.parse(raw); } catch { throw new Error('備戰角色資料無法讀取，請前往備戰方案檢查。'); }
    if (saved?.v !== 3 || !Array.isArray(saved.roles)) continue;
    for (const role of saved.roles) {
      if (!role || !Number.isSafeInteger(role.id) || !role.data || typeof role.data !== 'object') continue;
      try {
        const state = fromJSON(role.data, catalog, idx);
        const character = enrollmentCharacter(state, catalog, idx);
        roles.push({id: String(role.id), source, name: String(role.name || '未命名角色').slice(0, 80), character,
          ready: Object.values(character).every(value => value.trim() && value.length <= 4000)});
      } catch { /* A damaged role must not prevent other saved roles from being selected. */ }
    }
  }
  return roles;
}
