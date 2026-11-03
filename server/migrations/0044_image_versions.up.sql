-- Profile pictures are served from a fixed URL with a year-long
-- immutable Cache-Control, so a replaced picture kept showing the old
-- one. avatar_updated_at is sent to clients as avatarVersion and added to
-- the image URL (?v=), so every replacement gets a fresh URL. Receipts
-- already have receipt_uploaded_at for the same purpose.
ALTER TABLE users ADD COLUMN avatar_updated_at TIMESTAMPTZ;
ALTER TABLE clubs ADD COLUMN avatar_updated_at TIMESTAMPTZ;

UPDATE users SET avatar_updated_at = now() WHERE avatar_image_data IS NOT NULL;
UPDATE clubs SET avatar_updated_at = now() WHERE avatar_image_data IS NOT NULL;
