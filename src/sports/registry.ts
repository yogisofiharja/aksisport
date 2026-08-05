import type { SportModule } from './types';
import { tennisSportModule } from './tennis';

/**
 * Tiny lookup so session-level code (DP-001's status derivation) can find
 * a session's sport module by id without importing a specific sport
 * directly. Tennis is still the only entry — per CLAUDE.md, this isn't
 * implementing another sport, just avoiding a hardcoded import at the one
 * call site that needs to go through the abstraction rather than known-
 * tennis code.
 */
const registry: Record<string, SportModule> = {
  tennis: tennisSportModule,
};

export function getSportModule(sportId: string): SportModule | undefined {
  return registry[sportId];
}

// Registered sport ids, so screens (e.g. Skill Levels, Session/Schedule
// level pickers) don't hardcode a sport list of their own.
export function listSportIds(): string[] {
  return Object.keys(registry);
}
