import type { MatchMode } from './scoringEngine';

/**
 * DP-003: minimum participants are owned by the Sport Engine, not the
 * screen that creates a match. For tennis, min *is* the exact required
 * count — a match can't start with 3 of 4 doubles players — so callers use
 * this both as the minimum and as the number required to proceed.
 */
export function minParticipants(mode: MatchMode): number {
  return mode === 'double' ? 4 : 2;
}
