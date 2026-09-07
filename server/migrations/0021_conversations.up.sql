-- Unifies DP-011 Session Chat and DP-013 Contact Organizer onto one
-- messaging engine — per explicit product direction, the only real
-- differences between them are (a) who the participants are and (b)
-- whether a posting window applies; the message mechanics themselves
-- (compose, list, poll, optional image) are identical, so they now share
-- one schema instead of two near-duplicate ones.
--
-- A conversation's participants are never stored as a roster — they're
-- resolved from context at request time, same as before:
--   - session_chat:    member_user_id IS NULL — anyone who can already
--                       see the Session (requireSessionAccess).
--   - session_contact: member_user_id set — that member, or any
--                       owner/admin of the Session's Club.
-- This also gives Direct Messages (still Planning) a natural home later:
-- a third kind with session_id NULL and its own participant resolution,
-- sharing this same conversation_messages engine.
CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            TEXT NOT NULL CHECK (kind IN ('session_chat', 'session_contact')),
  session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  member_user_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conversations_member_matches_kind CHECK (
    (kind = 'session_chat' AND member_user_id IS NULL) OR
    (kind = 'session_contact' AND member_user_id IS NOT NULL)
  )
);

-- Exactly one shared session_chat conversation per Session.
CREATE UNIQUE INDEX conversations_session_chat_unique_idx
  ON conversations (session_id) WHERE kind = 'session_chat';

-- Exactly one session_contact conversation per (Session, member).
CREATE UNIQUE INDEX conversations_session_contact_unique_idx
  ON conversations (session_id, member_user_id) WHERE kind = 'session_contact';

CREATE TABLE conversation_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body                TEXT NOT NULL DEFAULT '',
  image_data          BYTEA,
  image_content_type  TEXT,
  image_size_bytes    INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX conversation_messages_conversation_created_idx ON conversation_messages (conversation_id, created_at);

-- Fold existing Session Chat history into the unified schema — this app
-- has been deployed (see docs/IMPLEMENTATION_ROADMAP.md) since before
-- this migration, so session_messages may hold real data.
INSERT INTO conversations (session_id, kind, created_at)
SELECT session_id, 'session_chat', MIN(created_at) FROM session_messages GROUP BY session_id;

INSERT INTO conversation_messages (conversation_id, sender_id, body, image_data, image_content_type, image_size_bytes, created_at)
SELECT c.id, sm.user_id, sm.body, sm.image_data, sm.image_content_type, sm.image_size_bytes, sm.created_at
FROM session_messages sm
JOIN conversations c ON c.session_id = sm.session_id AND c.kind = 'session_chat';

DROP TABLE session_messages;
