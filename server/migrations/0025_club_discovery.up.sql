-- DP-017 Community Discovery & Joining.
--
-- visibility: 'public' (anyone joins instantly) or 'private' (joining
-- creates a request an owner/admin approves). Public is the default, and
-- so every Club that predates this becomes public.
--
-- location: free text ("Jakarta Selatan") shown in search results.
-- Nullable only because existing Clubs have none; new Clubs must give one.
ALTER TABLE clubs
  ADD COLUMN location TEXT,
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private'));

-- One row per request to join a private Club. A person has at most one
-- *pending* request per Club (the partial unique index); decided rows are
-- kept as history, and a declined person may request again.
CREATE TABLE club_join_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'declined', 'cancelled')) DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at  TIMESTAMPTZ,
  decided_by  UUID REFERENCES users(id)
);
CREATE UNIQUE INDEX club_join_requests_pending_unique
  ON club_join_requests (club_id, user_id) WHERE status = 'pending';
CREATE INDEX club_join_requests_club_pending_idx
  ON club_join_requests (club_id, created_at) WHERE status = 'pending';
