/**
 * Shared contract a sport module implements. Deliberately minimal — only
 * `rules.minParticipants` exists because DP-003 needs it now. Scoring and
 * result-formatting stay sport-specific (src/sports/tennis/scoringEngine.ts)
 * rather than being forced into this shared shape prematurely; add fields
 * here only when a second sport actually needs the same contract, per
 * CLAUDE.md's "do not implement other sports yet."
 */

export interface SportRules {
  /** Minimum participants required to start a match in this mode. */
  minParticipants(mode: string): number;
}

export interface SportModule {
  id: string;
  rules: SportRules;
}
