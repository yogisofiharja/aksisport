-- Free-text Session description, and the matching field on Recurring
-- Schedule Templates (copied onto each generated Session, same as every
-- other Template field). Optional — not part of the "mandatory at
-- creation" set (name/location/startsAt/durationMinutes/skillLevel*).
ALTER TABLE sessions
  ADD COLUMN description TEXT;

ALTER TABLE recurring_schedules
  ADD COLUMN description TEXT;
