import type { TournamentDisplay } from '../landing/tournamentDisplay';
export interface BracketController {
  render(data: TournamentDisplay): void;
  destroy(): void;
}
/** Presentation adapter for generated lab code, not a backend contract. */
export function createBracketTree(options: {
  host: HTMLElement;
  onSelect?: (matchId: string, trigger: HTMLButtonElement) => void;
  onPlayer?: (playerId: string, matchId: string, trigger: HTMLButtonElement) => void;
  signal?: AbortSignal;
  previewEmpty?: boolean;
  championArt?: string;
  matchActionLabel?: string;
  playerActionLabel?: string;
}): BracketController;
