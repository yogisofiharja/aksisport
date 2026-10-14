-- DP-021 step 3: group chats and one chat per Community.
--   group: named, up to 50 people listed in conversation_members, managed
--          by its creator (created_by).
--   club:  every member of the Community, one per Community.
ALTER TABLE conversations
  ADD COLUMN club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  ADD COLUMN title TEXT,
  ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE conversations DROP CONSTRAINT conversations_kind_check;
ALTER TABLE conversations DROP CONSTRAINT conversations_shape_matches_kind;
ALTER TABLE conversations ADD CONSTRAINT conversations_kind_check
  CHECK (kind IN ('session_chat', 'session_contact', 'direct', 'group', 'club'));
ALTER TABLE conversations ADD CONSTRAINT conversations_shape_matches_kind CHECK (
  (kind = 'session_chat' AND session_id IS NOT NULL AND member_user_id IS NULL AND user_low IS NULL AND user_high IS NULL AND club_id IS NULL) OR
  (kind = 'session_contact' AND session_id IS NOT NULL AND member_user_id IS NOT NULL AND user_low IS NULL AND user_high IS NULL AND club_id IS NULL) OR
  (kind = 'direct' AND session_id IS NULL AND member_user_id IS NULL AND user_low IS NOT NULL AND user_high IS NOT NULL AND user_low < user_high AND club_id IS NULL) OR
  (kind = 'group' AND session_id IS NULL AND member_user_id IS NULL AND user_low IS NULL AND user_high IS NULL AND club_id IS NULL AND title IS NOT NULL) OR
  (kind = 'club' AND session_id IS NULL AND member_user_id IS NULL AND user_low IS NULL AND user_high IS NULL AND club_id IS NOT NULL)
);
CREATE UNIQUE INDEX conversations_club_unique_idx ON conversations (club_id) WHERE kind = 'club';

-- Who is in a group chat.
CREATE TABLE conversation_members (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX conversation_members_user_idx ON conversation_members (user_id);

-- Owners/admins can turn their Community's chat off (DP-021).
ALTER TABLE clubs ADD COLUMN chat_enabled BOOLEAN NOT NULL DEFAULT true;
