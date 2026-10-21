-- DP-025 (End match early) and DP-027: a match stopped before it was
-- decided is saved as 'unfinished' with its score so far. It counts as
-- neither a win nor a loss — stats read 'completed' only.
ALTER TABLE activities DROP CONSTRAINT activities_status_check;
ALTER TABLE activities ADD CONSTRAINT activities_status_check
  CHECK (status IN ('queued', 'live', 'completed', 'unfinished'));
