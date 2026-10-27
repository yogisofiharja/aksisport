-- DP-028: inviting friends to a Community or one of its Sessions.

-- A shareable link: one live link per inviter per target. It never
-- expires; an owner/admin's reset revokes every link for the target and
-- each inviter gets a fresh one next time. club_id is the target's
-- Community (the target itself for a club link), so whether the inviter
-- may skip approval is one lookup when the link is used.
CREATE TABLE invite_links (
  token       TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('club', 'session')),
  target_id   UUID NOT NULL,
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX invite_links_one_live_per_inviter
  ON invite_links (created_by, target_type, target_id)
  WHERE revoked_at IS NULL;
CREATE INDEX invite_links_target ON invite_links (target_type, target_id);

-- Someone invited to a target, in the app (a search and a notification)
-- or by opening a link while signed in. A Session invitation is also what
-- lets a non-member see that Session before asking for a spot. One row
-- per person per target; the latest inviter wins.
CREATE TABLE invitations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type  TEXT NOT NULL CHECK (target_type IN ('club', 'session')),
  target_id    UUID NOT NULL,
  club_id      UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  via          TEXT NOT NULL CHECK (via IN ('app', 'link')),
  link_token   TEXT REFERENCES invite_links(token) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  response     TEXT CHECK (response IN ('joined', 'dismissed')),
  UNIQUE (to_user, target_type, target_id)
);

CREATE INDEX invitations_pending ON invitations (to_user) WHERE responded_at IS NULL;

-- In-app invitations notify (DP-018); they fall under the existing
-- Communities and Sessions switches, so the categories don't change.
