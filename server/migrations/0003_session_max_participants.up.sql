-- DP-003: Session only defines Maximum Participants; minimum is owned by
-- the Sport Engine (client-side). Nullable — no session has one set until
-- a screen exposes setting it, which is not part of this change.
ALTER TABLE sessions ADD COLUMN max_participants INT;
