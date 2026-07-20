CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid    TEXT NOT NULL UNIQUE,
  username        CITEXT NOT NULL UNIQUE,
  display_name    TEXT,
  email           TEXT,
  phone_number    TEXT,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE clubs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  invite_code     TEXT NOT NULL UNIQUE,
  is_personal     BOOLEAN NOT NULL DEFAULT false,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE club_members (
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('owner','admin','member')) DEFAULT 'member',
  invited_by      UUID REFERENCES users(id),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, user_id)
);
CREATE INDEX club_members_user_id_idx ON club_members(user_id);

CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  sport           TEXT NOT NULL,
  name            TEXT,
  location        TEXT,
  court_count     INT NOT NULL DEFAULT 1,
  status          TEXT NOT NULL CHECK (status IN ('open','in_progress','completed')) DEFAULT 'open',
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_club_id_idx ON sessions(club_id);

CREATE TABLE session_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id),
  guest_name      TEXT,
  status          TEXT NOT NULL CHECK (status IN ('registered','checked_in','participated')) DEFAULT 'registered',
  checked_in_at   TIMESTAMPTZ,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR guest_name IS NOT NULL)
);
CREATE UNIQUE INDEX session_participants_user_unique
  ON session_participants(session_id, user_id) WHERE user_id IS NOT NULL;

CREATE TABLE activities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sport             TEXT NOT NULL,
  activity_type     TEXT NOT NULL DEFAULT 'match',
  status            TEXT NOT NULL CHECK (status IN ('queued','live','completed')) DEFAULT 'queued',
  scorer_user_id    UUID REFERENCES users(id),
  config            JSONB NOT NULL,
  result            JSONB,
  point_log         JSONB NOT NULL DEFAULT '[]',
  created_by        UUID NOT NULL REFERENCES users(id),
  queue_position    INT,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX activities_session_id_idx ON activities(session_id);
CREATE INDEX activities_session_status_idx ON activities(session_id, status);

CREATE TABLE activity_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id     UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id),
  guest_name      TEXT,
  team            TEXT CHECK (team IN ('A','B')),
  slot_order      INT NOT NULL DEFAULT 0,
  CHECK (user_id IS NOT NULL OR guest_name IS NOT NULL)
);
CREATE UNIQUE INDEX activity_participants_user_unique
  ON activity_participants(activity_id, user_id) WHERE user_id IS NOT NULL;
