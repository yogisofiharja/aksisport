-- Host Playing: whether the Session's organizer (created_by) intends to
-- play, not just run, the Session. Mandatory at creation (defaults to
-- true at the DB level only as a safety net for existing rows — the API
-- always requires an explicit value going forward). Mirrored onto the
-- Recurring Schedule Template, same as every other organizer preference,
-- and copied onto each generated Session.
ALTER TABLE sessions
  ADD COLUMN host_playing BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE recurring_schedules
  ADD COLUMN host_playing BOOLEAN NOT NULL DEFAULT true;
