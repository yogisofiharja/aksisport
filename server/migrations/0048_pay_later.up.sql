-- DP-032: whether a player has paid is kept apart from their place in
-- the Session, so some can play first and pay after.

-- When an organizer confirmed this player's payment. NULL = not paid.
-- Meaningful only on a priced Session, for a player with an account.
ALTER TABLE session_participants ADD COLUMN paid_at TIMESTAMPTZ;

-- Until now a confirmed place on a priced Session meant paid (or an
-- organizer-added place that never paid). Keep every existing place as
-- it was: nobody is suddenly told to pay for an old Session.
UPDATE session_participants sp SET paid_at = sp.joined_at
FROM sessions s
WHERE s.id = sp.session_id AND s.price_model <> 'free' AND sp.user_id IS NOT NULL
  AND sp.status IN ('registered', 'checked_in', 'checked_out', 'no_show');

-- The built-in Reguler tag on a member: joins without approval.
ALTER TABLE club_members ADD COLUMN reguler BOOLEAN NOT NULL DEFAULT false;

-- The tag's one setting: Reguler members pay after playing. Off until
-- the Community turns it on.
ALTER TABLE clubs ADD COLUMN reguler_pay_later BOOLEAN NOT NULL DEFAULT false;

-- Home's "You haven't paid" reminder looks up a player's unpaid places.
CREATE INDEX session_participants_unpaid ON session_participants (user_id)
  WHERE paid_at IS NULL AND user_id IS NOT NULL;
