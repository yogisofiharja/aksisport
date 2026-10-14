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
  /**
   * Activity Type ids this sport offers at Session creation (e.g. tennis:
   * 'single' | 'double' | 'class') — distinct from MatchFormat, which
   * seeds a match's *scoring* format, not this. Opaque ids; the UI maps
   * each to a translated label (no labels live here — this is data, i18n
   * is a client concern).
   */
  activityTypes: string[];
  /**
   * A finished match's score as one line, from `team`'s side — for
   * history lists (DP-019). `result` is whatever the sport stores when a
   * match completes. Optional: a sport without it shows no score.
   */
  formatResult?(result: unknown, team: 'A' | 'B'): string | undefined;
}
