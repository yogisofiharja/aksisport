-- DP-021 amendment: senders edit and delete their own messages, and
-- anyone hides a message for themself — WhatsApp's rules.
ALTER TABLE conversation_messages
  ADD COLUMN edited_at TIMESTAMPTZ,
  -- Deleted for everyone by its sender: text and image cleared.
  ADD COLUMN deleted_at TIMESTAMPTZ;

-- "Delete for me": hidden for that one person only.
CREATE TABLE conversation_message_hides (
  message_id UUID NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, user_id)
);
