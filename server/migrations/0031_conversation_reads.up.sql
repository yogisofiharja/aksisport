-- DP-021: how far each person has read in each conversation — the source
-- of unread counts and of read receipts ("Seen", "Seen by N"). One row
-- per (conversation, person), moved forward whenever they open it.
CREATE TABLE conversation_reads (
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at     TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX conversation_reads_user_idx ON conversation_reads (user_id);
