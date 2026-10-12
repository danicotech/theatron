import type { Character } from './model';
export type SavedRole = {
  id: string;
  source: 'event' | 'library';
  name: string;
  character: Character;
  ready: boolean;
};
export function loadoutStorageKey(eventId: string, userId: string, source?: string): string;
export function readRegistrationRoles(
  storage: Pick<Storage, 'getItem'>,
  catalog: unknown,
  eventId: string,
  userId: string,
): SavedRole[];
