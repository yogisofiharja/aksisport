-- Session (and Recurring Schedule Template) Activity Type — e.g. tennis
-- "single"/"double"/"class". Distinct from defaultMatchFormat, which seeds
-- a match's *scoring* format (AddMatchScreen), not this. Opaque TEXT, same
-- convention as the `sport` column itself — Sport Module owns the set of
-- valid values (DP-ARCH-002), not validated in Go.
ALTER TABLE sessions
  ADD COLUMN activity_type TEXT;

ALTER TABLE recurring_schedules
  ADD COLUMN activity_type TEXT;
