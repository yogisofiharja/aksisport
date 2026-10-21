-- DP-027: when a Session completes, its queued matches become 'not_played'.
-- They are kept, never start, and never count in results or stats.
ALTER TABLE activities DROP CONSTRAINT activities_status_check;
ALTER TABLE activities ADD CONSTRAINT activities_status_check
  CHECK (status IN ('queued', 'live', 'completed', 'unfinished', 'not_played'));
