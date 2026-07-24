-- DP-004: Session owns only a Default Match Format (the initial default a
-- new match's format picker seeds from). Match always owns its own format
-- once created — activities.config already does this fully; this column
-- only adds the session-level default that seeds it.
--
-- Opaque JSONB, same as activities.config/result — never parsed or
-- validated server-side, per the existing sport-specific-data convention
-- (docs/engineering/api-guidelines.md).
ALTER TABLE sessions ADD COLUMN default_match_format JSONB;
