-- DP-007: Recurring Schedules (Milestone D.1 — generation core, no sync).
--
-- Recurring Schedule generates Sessions on a recurrence pattern. Its Template
-- is DP-004's Organizer Preferences (sport/name/location/court_count/
-- max_participants/default_match_format) — deliberately does NOT include a
-- start time. starts_at is a core Session property, not a preference: ad-hoc
-- Sessions set it at creation, Recurring Schedule generation populates it
-- from the computed occurrence timestamp. Same field either way.
--
-- recurrence_rule is intentionally opaque JSONB (same convention as
-- default_match_format/activities.config) — MVP shape is weekly-only
-- ({"weekday":0-6,"time":"HH:MM","durationMinutes":n,"timezone":"..."}),
-- not product-specified, parsed only in Go.
--
-- Occurrence tracking is explicitly NOT a first-class domain object per
-- DP-007 — recurring_schedule_skips is an internal tombstone table only,
-- with no dedicated CRUD API. The occurrence's own timestamp doubles as the
-- generated Session's starts_at, so "has this occurrence been generated" is
-- answered by sessions itself (no separate occurrence-log needed for the
-- happy path) and "was it skipped" by this table.
CREATE TABLE recurring_schedules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id               UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  sport                 TEXT NOT NULL,
  name                  TEXT,
  location              TEXT,
  court_count           INT NOT NULL DEFAULT 1,
  max_participants      INT,
  default_match_format  JSONB,
  recurrence_rule       JSONB NOT NULL,
  generation_lead_days  INT NOT NULL,
  -- "HH:MM" text, not a native TIME column — consistent with the rest of
  -- this schema's TEXT-for-simple-structured-values convention, and avoids
  -- introducing a new pgx type mapping for a single field.
  generation_time       TEXT,
  status                TEXT NOT NULL CHECK (status IN ('active', 'paused')) DEFAULT 'active',
  end_date              DATE,
  created_by            UUID NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sessions
  ADD COLUMN starts_at TIMESTAMPTZ,
  ADD COLUMN recurring_schedule_id UUID REFERENCES recurring_schedules(id) ON DELETE SET NULL;

-- Product invariant: one occurrence generates at most one Session.
CREATE UNIQUE INDEX sessions_recurring_schedule_occurrence_uniq
  ON sessions (recurring_schedule_id, starts_at)
  WHERE recurring_schedule_id IS NOT NULL;

-- Product invariant: a skipped occurrence must never generate a Session.
-- Written either pre-generation (organizer skips a future occurrence) or
-- post-generation (organizer deletes an already-generated Session) — both
-- go through the same "skip occurrence" operation.
CREATE TABLE recurring_schedule_skips (
  recurring_schedule_id UUID NOT NULL REFERENCES recurring_schedules(id) ON DELETE CASCADE,
  occurrence_starts_at  TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (recurring_schedule_id, occurrence_starts_at)
);
