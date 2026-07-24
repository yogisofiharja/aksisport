-- DP-001: Session Lifecycle. Adds the two genuinely new stored states —
-- 'draft' (explicit, pre-publish) and 'cancelled' (explicit, terminal).
-- 'open'/'in_progress'/'completed' are kept as the literal stored values
-- (no rename) — smallest change necessary, same reasoning as keeping
-- 'registered'/'checked_in' in migration 0004.
--
-- Recruiting/Ready/Full are NOT stored here. They're a derived display
-- layer computed client-side over the 'open' stored value (joined
-- participant count vs. the Sport Engine's minParticipants and the
-- session's max_participants) — DP-003 already established minimum
-- participants as Sport-Engine-owned, client-side only; deriving
-- Recruiting/Ready/Full server-side would mean duplicating that rule in
-- Go. See docs/engineering/architecture.md.
--
-- Default changes from 'open' to 'draft' — every new session now starts
-- unpublished per the approved DP-001 model (explicit Publish required).
ALTER TABLE sessions DROP CONSTRAINT sessions_status_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('draft', 'open', 'in_progress', 'completed', 'cancelled'));
ALTER TABLE sessions ALTER COLUMN status SET DEFAULT 'draft';
