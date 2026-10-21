-- DP-027 one-time cleanup: matches still queued on a Session that already
-- completed become Not played, as they would have when it completed.
-- (Live matches past their grace hour are saved as Unfinished by the
-- scheduler's first tick, which reads their last score from Firebase.)
UPDATE activities a SET status = 'not_played'
FROM sessions s
WHERE s.id = a.session_id AND s.status = 'completed' AND a.status = 'queued';
