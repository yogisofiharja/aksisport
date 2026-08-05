import type { SportModule } from './types';
import { tennisSportModule } from './tennis';

/**
 * Tiny lookup so session-level code (e.g. core/sessions/scheduler.ts,
 * CreateSessionScreen's activity-type picker) can find a session's sport
 * module by id without importing a specific sport directly. DP-001's
 * Session Lifecycle derivation used to be a consumer here too, but as of
 * Milestone 2 that derivation moved server-side (internal/sports in Go) —
 * see docs/engineering/architecture.md. Tennis is still the only entry —
 * per CLAUDE.md, this isn't implementing another sport, just avoiding a
 * hardcoded import at call sites that need to go through the abstraction
 * rather than known-tennis code.
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
