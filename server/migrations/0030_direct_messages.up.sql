-- DP-020 Direct Messages: a private conversation between exactly two
-- players, on the same messaging engine as Session Chat and Contact
-- Organizer. A direct conversation belongs to no Session, so session_id
-- becomes optional, and its two people are stored as an ordered pair
-- (user_low < user_high) so each pair has exactly one conversation
-- whichever of them starts it.
ALTER TABLE conversations ALTER COLUMN session_id DROP NOT NULL;
ALTER TABLE conversations DROP CONSTRAINT conversations_kind_check;
ALTER TABLE conversations DROP CONSTRAINT conversations_member_matches_kind;
ALTER TABLE conversations
  ADD COLUMN user_low UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN user_high UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE conversations ADD CONSTRAINT conversations_kind_check
  CHECK (kind IN ('session_chat', 'session_contact', 'direct'));
ALTER TABLE conversations ADD CONSTRAINT conversations_shape_matches_kind CHECK (
  (kind = 'session_chat' AND session_id IS NOT NULL AND member_user_id IS NULL AND user_low IS NULL AND user_high IS NULL) OR
  (kind = 'session_contact' AND session_id IS NOT NULL AND member_user_id IS NOT NULL AND user_low IS NULL AND user_high IS NULL) OR
  (kind = 'direct' AND session_id IS NULL AND member_user_id IS NULL AND user_low IS NOT NULL AND user_high IS NOT NULL AND user_low < user_high)
);
CREATE UNIQUE INDEX conversations_direct_unique_idx
  ON conversations (user_low, user_high) WHERE kind = 'direct';
