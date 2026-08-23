-- DP-011 Session Chat — image attachments. Stored directly in Postgres
-- (bytea), not an object store: this app has no cloud storage/CDN
-- provisioned anywhere, and the client-facing bucket config that does
-- exist (EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET) was never actually wired
-- up, requires the paid Firebase Blaze plan, and would need its own
-- versioned security rules this repo has no way to deploy. Bytea is the
-- pragmatic zero-new-infra choice at this app's scale; served through
-- its own authenticated endpoint (GET .../messages/:messageId/image),
-- never embedded in the message list response, so polling the chat
-- never re-transfers image bytes.
ALTER TABLE session_messages
  ADD COLUMN image_data BYTEA,
  ADD COLUMN image_content_type TEXT,
  ADD COLUMN image_size_bytes INTEGER;
