'use client';
import { useSyncExternalStore } from 'react';
import { tournamentRealtime } from './tournamentRealtime';

export function useTournamentRealtime(slug: string) {
  const store = tournamentRealtime(slug);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
