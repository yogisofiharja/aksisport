-- DP-021 step 2: blocking and reporting.

-- Blocking is one-directional and silent: messages the blocked person
-- sends afterwards are stored but withheld from the blocker.
CREATE TABLE user_blocks (
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX user_blocks_blocked_idx ON user_blocks (blocked_id);

ALTER TABLE conversation_messages
  ADD COLUMN withheld BOOLEAN NOT NULL DEFAULT false,
  -- Removed by a Community's owner/admin after a report.
  ADD COLUMN removed_at TIMESTAMPTZ,
  ADD COLUMN removed_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- A report about a person, or one of their messages. The message's text
-- is copied at report time, so it stays readable if the message is
-- removed later.
CREATE TABLE reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id        UUID REFERENCES conversation_messages(id) ON DELETE SET NULL,
  message_body      TEXT,
  message_has_image BOOLEAN NOT NULL DEFAULT false,
  conversation_kind TEXT,
  reason            TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which Communities' owners/admins a report goes to, and whether each has
-- dealt with it. None: recorded, but it reaches no one.
CREATE TABLE report_clubs (
  report_id   UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (report_id, club_id)
);
CREATE INDEX report_clubs_open_idx ON report_clubs (club_id) WHERE resolved_at IS NULL;
