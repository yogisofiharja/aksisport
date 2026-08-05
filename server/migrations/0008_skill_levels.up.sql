-- DP-008: Player Skill Level.
--
-- The scale itself is data, not a fixed enum, and scoped per Sport (Sport
-- Module territory per DP-ARCH-002) — Tennis uses named tiers, other
-- sports (e.g. Padel) commonly use a numeric ladder instead. Renaming,
-- reordering, or extending a sport's scale is a data change here, never a
-- migration.
CREATE TABLE skill_levels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport      TEXT NOT NULL,
  slug       TEXT NOT NULL,
  name       TEXT NOT NULL,
  rank       INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sport, slug),
  UNIQUE (sport, rank)
);

-- Tennis only — the only real, selectable sport today. Other sports' scales
-- are added the same way once those sports actually exist (DP-008 v0.4.1).
INSERT INTO skill_levels (sport, slug, name, rank) VALUES
  ('tennis', 'newbie', 'Newbie', 1),
  ('tennis', 'beginner', 'Beginner', 2),
  ('tennis', 'upper_beginner', 'Upper Beginner', 3),
  ('tennis', 'intermediate', 'Intermediate', 4),
  ('tennis', 'upper_intermediate', 'Upper Intermediate', 5),
  ('tennis', 'advanced', 'Advanced', 6);

-- One Skill Level per (player, sport), self-reported (DP-008). `sport` is
-- kept as its own column, redundant with skill_level_id's own sport,
-- purely so the (user_id, sport) uniqueness constraint can exist at all —
-- Postgres can't express "unique per sport" through a join. Consistency
-- between the two is validated in Go, not here.
CREATE TABLE user_skill_levels (
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport          TEXT NOT NULL,
  skill_level_id UUID NOT NULL REFERENCES skill_levels(id),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sport)
);

-- Session's optional Skill Level requirement. Range-order (min.rank <=
-- max.rank), "enforcement requires both IDs", and "both IDs belong to the
-- session's own sport" are validated in Go, not as DB constraints.
ALTER TABLE sessions
  ADD COLUMN skill_level_min_id UUID REFERENCES skill_levels(id),
  ADD COLUMN skill_level_max_id UUID REFERENCES skill_levels(id),
  ADD COLUMN skill_level_enforcement TEXT CHECK (skill_level_enforcement IN ('strict', 'guidance'));

-- Recurring Schedule Template mirrors the same fields (Template = DP-004
-- preferences + this), copied onto each generated Session at generation
-- time, same as every other Template field.
ALTER TABLE recurring_schedules
  ADD COLUMN skill_level_min_id UUID REFERENCES skill_levels(id),
  ADD COLUMN skill_level_max_id UUID REFERENCES skill_levels(id),
  ADD COLUMN skill_level_enforcement TEXT CHECK (skill_level_enforcement IN ('strict', 'guidance'));
