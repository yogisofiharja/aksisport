-- Match Setup (scoring config) is defined once per Session/Template
-- instead of being reconfigured every time a match is generated.
-- default_match_format (added earlier) already covers the game-format
-- half of that config; this adds the other half, the deuce rule.
-- Nullable, defaulting to true at the application layer (not a DB
-- default) to match AddMatchScreen's existing pre-this-feature behavior
-- for any Session created before Match Setup existed.
ALTER TABLE sessions
  ADD COLUMN default_single_deuce BOOLEAN;

ALTER TABLE recurring_schedules
  ADD COLUMN default_single_deuce BOOLEAN;
