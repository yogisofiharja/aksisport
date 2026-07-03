import { PersistedAppState, SetupForm, TeamASide } from './appTypes';
import { MatchFormat } from './scoring';

export const STORAGE_KEY = 'poinyuk.weekend.v1';

export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export function parsePersistedState(raw: string | null): PersistedAppState | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PersistedAppState;

    if (parsed.version !== 1) {
      return null;
    }

    if (!parsed.setup || !Array.isArray(parsed.history)) {
      return null;
    }

    if (typeof parsed.backgroundPhotoDataUrl === 'undefined') {
      parsed.backgroundPhotoDataUrl = null;
    }

    if (typeof parsed.teamASide === 'undefined') {
      parsed.teamASide = 'left';
    }

    if (typeof parsed.playerPlayCounts === 'undefined' || !parsed.playerPlayCounts) {
      parsed.playerPlayCounts = {};
    }

    if (!Array.isArray(parsed.matchHistory)) {
      parsed.matchHistory = [];
    }

    if (typeof parsed.sessionCode === 'undefined') {
      parsed.sessionCode = null;
    }

    parsed.setup = normalizeSetup(parsed.setup as Record<string, unknown>);

    if (parsed.matchState && typeof parsed.matchState.deuceCount === 'undefined') {
      parsed.matchState.deuceCount = 0;
    }

    if (parsed.matchState && typeof parsed.matchState.sets === 'undefined') {
      parsed.matchState.sets = { A: 0, B: 0 };
    }

    if (parsed.matchState && !Array.isArray(parsed.matchState.completedSets)) {
      parsed.matchState.completedSets = [];
    }

    if (parsed.matchState && !parsed.matchState.config.matchFormat) {
      parsed.matchState.config.matchFormat = { type: 'open' };
    }

    if (parsed.matchState && typeof parsed.matchState.tiebreak === 'undefined') {
      parsed.matchState.tiebreak = null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function normalizeMatchFormat(raw: unknown): MatchFormat {
  if (raw && typeof raw === 'object' && 'type' in raw) {
    const fmt = raw as Record<string, unknown>;
    if (fmt.type === 'fixed-games' && typeof fmt.totalGames === 'number') {
      return { type: 'fixed-games', totalGames: fmt.totalGames, goldenGameOnTie: Boolean(fmt.goldenGameOnTie) };
    }
    if (fmt.type === 'race-to' && typeof fmt.raceTo === 'number') {
      return { type: 'race-to', raceTo: fmt.raceTo };
    }
    if (fmt.type === 'best-of-sets' && typeof fmt.setsToWin === 'number') {
      return { type: 'best-of-sets', setsToWin: fmt.setsToWin, superTiebreak: Boolean(fmt.superTiebreak) };
    }
  }
  return { type: 'open' };
}

function normalizeSetup(rawSetup: Record<string, unknown>): SetupForm {
  const mode = rawSetup.mode === 'double' ? 'double' : 'single';
  const singleDeuceSuddenDeath = Boolean(rawSetup.singleDeuceSuddenDeath);
  const matchFormat = normalizeMatchFormat(rawSetup.matchFormat);

  // Current format: players is a flat string array.
  if (Array.isArray(rawSetup.players)) {
    return {
      mode,
      singleDeuceSuddenDeath,
      players: rawSetup.players.filter((name): name is string => typeof name === 'string' && name.trim() !== ''),
      matchFormat,
    };
  }

  // Previous format: playerPoolA / playerPoolB comma strings.
  if (typeof rawSetup.playerPoolA === 'string' || typeof rawSetup.playerPoolB === 'string') {
    const poolA = splitPool(String(rawSetup.playerPoolA ?? ''));
    const poolB = splitPool(String(rawSetup.playerPoolB ?? ''));
    return { mode, singleDeuceSuddenDeath, players: [...poolA, ...poolB], matchFormat };
  }

  // Oldest format: playerA1 / playerA2 / playerB1 / playerB2 individual fields.
  const players = [rawSetup.playerA1, rawSetup.playerA2, rawSetup.playerB1, rawSetup.playerB2]
    .filter((name): name is string => typeof name === 'string' && name.trim() !== '')
    .map((name) => name.trim());

  return { mode, singleDeuceSuddenDeath, players, matchFormat };
}

function splitPool(raw: string): string[] {
  return raw.split(',').map((name) => name.trim()).filter((name) => Boolean(name));
}

export function parseTeamASide(raw: unknown): TeamASide {
  return raw === 'right' ? 'right' : 'left';
}

export function loadPersistedStateFromStorage(
  storage: StorageLike,
  key: string = STORAGE_KEY,
): PersistedAppState | null {
  const raw = storage.getItem(key);
  return parsePersistedState(raw);
}

export function savePersistedStateToStorage(
  storage: StorageLike,
  state: PersistedAppState,
  key: string = STORAGE_KEY,
): boolean {
  try {
    storage.setItem(key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearPersistedStateFromStorage(
  storage: StorageLike,
  key: string = STORAGE_KEY,
): boolean {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
