-- DP-023: every Session has one umpire, who starts and scores all of its
-- matches. The host (creator) by default; owners/admins can hand it over.
ALTER TABLE sessions ADD COLUMN umpire_user_id UUID REFERENCES users(id);
UPDATE sessions SET umpire_user_id = created_by;
ALTER TABLE sessions ALTER COLUMN umpire_user_id SET NOT NULL;
