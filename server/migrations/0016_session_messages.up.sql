-- Session Chat (DP-011) — the first slice of Communication (a previously
-- undefined domain, gap-analysis §2.6). Scoped narrowly: one chat per
-- Session, plain text, no editing/deleting, no attachments. Posting/
-- reading requires the same access as viewing the Session itself
-- (requireSessionAccess — any club member for a published Session, only
-- owner/admin for a Draft) — not narrowed further to "participants only",
-- since a member asking "can I still join?" needs to be able to post
-- before they've joined. No moderation tooling yet (organizer delete,
-- reporting) — a known, deliberate MVP gap.
CREATE TABLE session_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX session_messages_session_created_idx ON session_messages(session_id, created_at);
