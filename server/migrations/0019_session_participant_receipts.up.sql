-- Milestone 5 (Session Finance) — a participant can attach a payment
-- receipt image to their own row on a priced Session. Stored directly in
-- Postgres (bytea), same reasoning as DP-011 Session Chat's images (no
-- object storage/CDN provisioned anywhere in this app). Deliberately
-- narrower visibility than chat images: only the uploading participant
-- and the Club's owner/admin can ever fetch the bytes — every other
-- participant sees only the existing session_participants.status
-- (registered = confirmed, waitlist = awaiting), never this image.
ALTER TABLE session_participants
  ADD COLUMN receipt_image_data BYTEA,
  ADD COLUMN receipt_image_content_type TEXT,
  ADD COLUMN receipt_uploaded_at TIMESTAMPTZ;
