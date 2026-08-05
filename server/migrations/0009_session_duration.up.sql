-- DP-009: Session Duration. Only meaningful together with starts_at
-- (added in 0007) — both are required together at creation, enforced in
-- Go (sessions_handler.go), not as a DB constraint, since existing rows
-- predate this and shouldn't be broken by a NOT NULL migration.
ALTER TABLE sessions
  ADD COLUMN duration_minutes INT;
