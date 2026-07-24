-- DP-002: Participant Lifecycle — Joined, Checked In, Checked Out,
-- Cancelled, No Show.
--
-- 'registered' and 'checked_in' are kept as-is (already mean "Joined" and
-- "Checked In" respectively) rather than renamed, to avoid touching every
-- existing call site for a vocabulary-only change — smallest change
-- necessary, per CLAUDE.md. 'participated' is dropped: declared in the
-- original CHECK constraint but never set by any code path (confirmed
-- against server/internal/db/session_participants.go before writing this
-- migration), and not part of DP-002's five states.
--
-- Assumes the constraint Postgres auto-named for the original inline
-- CHECK on session_participants.status is session_participants_status_check
-- (its standard <table>_<column>_check convention) — worth confirming
-- against the actual database before this migration runs for the first
-- time, since it was never explicitly named in 0001_init.up.sql.
ALTER TABLE session_participants DROP CONSTRAINT session_participants_status_check;
ALTER TABLE session_participants ADD CONSTRAINT session_participants_status_check
  CHECK (status IN ('registered', 'checked_in', 'checked_out', 'cancelled', 'no_show'));

ALTER TABLE session_participants ADD COLUMN checked_out_at TIMESTAMPTZ;
