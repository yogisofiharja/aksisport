-- DP-031 Venues. A venue is Aksi's own record: the name an organizer
-- typed or confirmed, and, when picked from Google Maps, its place ID —
-- the only Google content we may keep indefinitely. No address or
-- coordinates are stored.
CREATE TABLE venues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  google_place_id TEXT UNIQUE,
  -- The town it was added from, to suggest local venues first.
  city_code       TEXT REFERENCES cities(code),
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One typed (non-Google) venue per name and town.
CREATE UNIQUE INDEX venues_typed_name_unique
  ON venues (lower(btrim(name)), COALESCE(city_code, ''))
  WHERE google_place_id IS NULL;

ALTER TABLE sessions ADD COLUMN venue_id UUID REFERENCES venues(id) ON DELETE SET NULL;
ALTER TABLE recurring_schedules ADD COLUMN venue_id UUID REFERENCES venues(id) ON DELETE SET NULL;
CREATE INDEX sessions_venue_idx ON sessions (venue_id);

-- Every distinct venue already typed becomes a venue (no map), in the
-- town of the Community that used it.
INSERT INTO venues (name, city_code)
SELECT DISTINCT ON (lower(btrim(t.location)), COALESCE(c.city_code, ''))
       btrim(t.location), c.city_code
FROM (
  SELECT club_id, location FROM sessions
  UNION ALL
  SELECT club_id, location FROM recurring_schedules
) t
JOIN clubs c ON c.id = t.club_id
WHERE t.location IS NOT NULL AND length(btrim(t.location)) BETWEEN 1 AND 120
ON CONFLICT DO NOTHING;

UPDATE sessions s SET venue_id = v.id
FROM clubs c, venues v
WHERE c.id = s.club_id AND v.google_place_id IS NULL
  AND lower(btrim(v.name)) = lower(btrim(s.location))
  AND COALESCE(v.city_code, '') = COALESCE(c.city_code, '');

UPDATE recurring_schedules r SET venue_id = v.id
FROM clubs c, venues v
WHERE c.id = r.club_id AND v.google_place_id IS NULL
  AND lower(btrim(v.name)) = lower(btrim(r.location))
  AND COALESCE(v.city_code, '') = COALESCE(c.city_code, '');
