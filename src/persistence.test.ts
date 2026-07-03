import { describe, expect, it } from 'vitest';
import { PersistedAppState } from './appTypes';
import {
  clearPersistedStateFromStorage,
  loadPersistedStateFromStorage,
  parsePersistedState,
  savePersistedStateToStorage,
  StorageLike,
} from './persistence';

const validState: PersistedAppState = {
  version: 1,
  setup: {
    mode: 'single',
    singleDeuceSuddenDeath: false,
    players: ['Alice', 'Bob'],
    matchFormat: { type: 'open' },
  },
  teamASide: 'left',
  matchState: null,
  history: [],
  backgroundPhotoDataUrl: null,
  playerPlayCounts: {},
  matchHistory: [],
  sessionCode: null,
};

class MemoryStorage implements StorageLike {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

describe('persistence helpers', () => {
  it('parses valid persisted state', () => {
    const parsed = parsePersistedState(JSON.stringify(validState));
    expect(parsed).toEqual(validState);
  });

  it('returns null for invalid JSON', () => {
    expect(parsePersistedState('{broken')).toBeNull();
  });

  it('returns null for unsupported version', () => {
    const payload = JSON.stringify({ ...validState, version: 2 });
    expect(parsePersistedState(payload)).toBeNull();
  });

  it('fills missing backgroundPhotoDataUrl and teamASide for backward compatibility', () => {
    const oldPayload = JSON.stringify({
      version: 1,
      setup: { mode: 'single', singleDeuceSuddenDeath: false, players: ['Alice', 'Bob'] },
      matchState: null,
      history: [],
    });

    const parsed = parsePersistedState(oldPayload);
    expect(parsed?.backgroundPhotoDataUrl).toBeNull();
    expect(parsed?.teamASide).toBe('left');
    expect(parsed?.setup.players).toEqual(['Alice', 'Bob']);
  });

  it('migrates oldest legacy playerA1/B1 setup to players array', () => {
    const oldPayload = JSON.stringify({
      version: 1,
      setup: {
        mode: 'single',
        singleDeuceSuddenDeath: false,
        teamASide: 'left',
        playerA1: 'Alice',
        playerA2: '',
        playerB1: 'Bob',
        playerB2: '',
      },
      matchState: null,
      history: [],
    });

    const parsed = parsePersistedState(oldPayload);
    expect(parsed?.setup.players).toContain('Alice');
    expect(parsed?.setup.players).toContain('Bob');
  });

  it('migrates playerPoolA/B legacy setup to players array', () => {
    const oldPayload = JSON.stringify({
      version: 1,
      setup: {
        mode: 'double',
        singleDeuceSuddenDeath: false,
        playerPoolA: 'Alice, Clara',
        playerPoolB: 'Bob, Doni',
        activePlayersA: ['Alice', 'Clara'],
        activePlayersB: ['Bob', 'Doni'],
      },
      matchState: null,
      history: [],
    });

    const parsed = parsePersistedState(oldPayload);
    expect(parsed?.setup.players).toContain('Alice');
    expect(parsed?.setup.players).toContain('Clara');
    expect(parsed?.setup.players).toContain('Bob');
    expect(parsed?.setup.players).toContain('Doni');
  });

  it('saves and loads state from storage', () => {
    const storage = new MemoryStorage();
    const key = 'test-key';

    const saveOk = savePersistedStateToStorage(storage, validState, key);
    const loaded = loadPersistedStateFromStorage(storage, key);

    expect(saveOk).toBe(true);
    expect(loaded).toEqual(validState);
  });

  it('clears state from storage', () => {
    const storage = new MemoryStorage();
    const key = 'test-key';

    savePersistedStateToStorage(storage, validState, key);
    const clearOk = clearPersistedStateFromStorage(storage, key);

    expect(clearOk).toBe(true);
    expect(storage.getItem(key)).toBeNull();
  });
});
