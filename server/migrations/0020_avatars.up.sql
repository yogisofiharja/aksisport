-- Club and User profile pictures. Stored directly in Postgres (bytea),
-- same reasoning as DP-011 Session Chat's images and Milestone 5's
-- payment receipts (no object storage/CDN provisioned anywhere in this
-- app). Both users.avatar_url and club_members' derived avatar_url were
-- an earlier, never-wired string-URL stub (nothing ever set or read it
-- through a real upload path) — left in place, unused, rather than
-- ripped out as part of this change; these new bytea columns are the
-- real, working image storage going forward.
ALTER TABLE users
  ADD COLUMN avatar_image_data BYTEA,
  ADD COLUMN avatar_image_content_type TEXT;

ALTER TABLE clubs
  ADD COLUMN avatar_image_data BYTEA,
  ADD COLUMN avatar_image_content_type TEXT;
