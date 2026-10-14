-- DP-021 (v0.22.0): a group needs no name — it is shown by its members'
-- names unless its creator gives it one.
ALTER TABLE conversations DROP CONSTRAINT conversations_shape_matches_kind;
ALTER TABLE conversations ADD CONSTRAINT conversations_shape_matches_kind CHECK (
  (kind = 'session_chat' AND session_id IS NOT NULL AND member_user_id IS NULL AND user_low IS NULL AND user_high IS NULL AND club_id IS NULL) OR
  (kind = 'session_contact' AND session_id IS NOT NULL AND member_user_id IS NOT NULL AND user_low IS NULL AND user_high IS NULL AND club_id IS NULL) OR
  (kind = 'direct' AND session_id IS NULL AND member_user_id IS NULL AND user_low IS NOT NULL AND user_high IS NOT NULL AND user_low < user_high AND club_id IS NULL) OR
  (kind = 'group' AND session_id IS NULL AND member_user_id IS NULL AND user_low IS NULL AND user_high IS NULL AND club_id IS NULL) OR
  (kind = 'club' AND session_id IS NULL AND member_user_id IS NULL AND user_low IS NULL AND user_high IS NULL AND club_id IS NOT NULL)
);
