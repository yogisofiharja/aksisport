-- Online indicator — a new attribute on User. No push/websocket infra
-- exists anywhere in this app (every screen polls or refetches on
-- focus), so "online" is derived from last_active_at rather than a
-- stored boolean that would need explicit online/offline transitions:
-- authjwt.RequireAuth stamps this on every authenticated request, and
-- isOnline is computed at read time as "active within the last 2
-- minutes" — see (last_active_at IS NOT NULL AND last_active_at > now()
-- - interval '2 minutes') in internal/db/users.go.
ALTER TABLE users
  ADD COLUMN last_active_at TIMESTAMPTZ;
